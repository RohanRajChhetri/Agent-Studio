import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execFileAsync = promisify(execFile);

/** Resolve the Python executable, prioritizing the project's local virtual environment (.venv) */
export function getPythonBinary(): string {
  const candidates = [
    path.resolve(process.cwd(), ".venv/Scripts/python.exe"),
    path.resolve(process.cwd(), "../.venv/Scripts/python.exe"),
    path.resolve(process.cwd(), ".venv/bin/python"),
    path.resolve(process.cwd(), "../.venv/bin/python"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return "python";
}

export interface ScrapeResult {
  url: string;
  title: string;
  content: string;
  markdown?: string;
  extractedData?: Record<string, string[]>;
  success: boolean;
  error?: string;
  latency: number;
}

export interface CrawlResult {
  startUrl: string;
  pagesScraped: number;
  items: Record<string, unknown>[];
  success: boolean;
  error?: string;
  latency: number;
}

/**
 * Direct Python bridge to Scrapling for quick one-shot scrapes.
 * Used when full MCP session is overkill — e.g. scraping a single URL
 * from the dashboard command bar.
 */
export async function scrapePage(
  url: string,
  options?: {
    selectors?: string[];
    toMarkdown?: boolean;
    stealthMode?: boolean;
  }
): Promise<ScrapeResult> {
  const start = Date.now();
  const sanitizedUrl = url.replace(/'/g, "\\'");
  const fetcherClass = options?.stealthMode ? "StealthyFetcher" : "Fetcher";

  // Build selector extraction code if selectors provided
  let selectorCode = "";
  if (options?.selectors && options.selectors.length > 0) {
    const escapedSelectors = JSON.stringify(options.selectors);
    selectorCode = `
    extracted = {}
    for sel in ${escapedSelectors}:
        try:
            extracted[sel] = page.css(sel + '::text').getall()
        except Exception:
            extracted[sel] = []
    result["extractedData"] = extracted`;
  }

  const contentExtraction = options?.toMarkdown
    ? 'page.to_markdown() if hasattr(page, "to_markdown") else page.get_all_text()'
    : "page.get_all_text()";

  const script = `
import json, sys
try:
    from scrapling.fetchers import ${fetcherClass}
    fetch_fn = getattr(${fetcherClass}, 'fetch', getattr(${fetcherClass}, 'get', None))
    page = fetch_fn('${sanitizedUrl}')
    result = {
        "url": "${sanitizedUrl}",
        "title": page.css('title::text').get(''),
        "content": ${contentExtraction},
        "success": True,
    }${selectorCode}
    print(json.dumps(result, ensure_ascii=False))
except ImportError:
    print(json.dumps({"url": "${sanitizedUrl}", "success": False, "error": "Scrapling is not installed. Run: pip install scrapling"}))
except Exception as e:
    print(json.dumps({"url": "${sanitizedUrl}", "success": False, "error": str(e)}))
`;

  try {
    const pythonBin = getPythonBinary();
    const { stdout, stderr } = await execFileAsync(pythonBin, ["-c", script], {
      timeout: 30000,
      windowsHide: true,
    });

    if (stderr && !stdout.trim()) {
      return {
        url,
        title: "",
        content: "",
        success: false,
        error: stderr.trim(),
        latency: Date.now() - start,
      };
    }

    // Extract JSON payload from stdout even if preceded by logger statements
    const jsonStart = stdout.indexOf("{");
    const jsonEnd = stdout.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      return {
        url,
        title: "",
        content: stdout.trim(),
        success: false,
        error: "Invalid JSON response from Scrapling process",
        latency: Date.now() - start,
      };
    }

    const data = JSON.parse(stdout.slice(jsonStart, jsonEnd + 1));
    return {
      ...data,
      markdown: options?.toMarkdown ? data.content : undefined,
      latency: Date.now() - start,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Python not available or Scrapling not installed
    if (msg.includes("ENOENT") || msg.includes("not recognized") || msg.includes("command not found")) {
      return {
        url,
        title: "",
        content: "",
        success: false,
        error: "Python 3 is not installed or not in PATH. Install Python and Scrapling: pip install scrapling",
        latency: Date.now() - start,
      };
    }
    return {
      url,
      title: "",
      content: "",
      success: false,
      error: msg,
      latency: Date.now() - start,
    };
  }
}

/**
 * Crawl multiple pages from a starting URL using Scrapling's Spider system.
 * Returns structured data from all crawled pages.
 */
export async function crawlSite(
  startUrl: string,
  options?: {
    maxPages?: number;
    selectors?: Record<string, string>;
    outputFormat?: "json" | "csv" | "jsonl";
  }
): Promise<CrawlResult> {
  const start = Date.now();
  const sanitizedUrl = startUrl.replace(/'/g, "\\'");
  const maxPages = options?.maxPages || 10;

  // Build CSS selector extraction map
  let selectorMap = '{"text": ".text::text", "link": "a::attr(href)"}';
  if (options?.selectors) {
    selectorMap = JSON.stringify(options.selectors);
  }

  const script = `
import json, sys
try:
    from scrapling.fetchers import Fetcher
    page = Fetcher.get('${sanitizedUrl}')
    selectors = ${selectorMap}
    items = []
    
    # Extract from main page
    item = {"url": "${sanitizedUrl}"}
    for key, sel in selectors.items():
        try:
            item[key] = page.css(sel).getall()
        except Exception:
            item[key] = []
    items.append(item)
    
    # Follow links up to maxPages
    links = page.css('a::attr(href)').getall()[:${maxPages - 1}]
    for link in links:
        if not link.startswith('http'):
            continue
        try:
            sub_page = Fetcher.get(link)
            sub_item = {"url": link}
            for key, sel in selectors.items():
                try:
                    sub_item[key] = sub_page.css(sel).getall()
                except Exception:
                    sub_item[key] = []
            items.append(sub_item)
        except Exception:
            continue
    
    print(json.dumps({"startUrl": "${sanitizedUrl}", "pagesScraped": len(items), "items": items, "success": True}, ensure_ascii=False))
except ImportError:
    print(json.dumps({"startUrl": "${sanitizedUrl}", "pagesScraped": 0, "items": [], "success": False, "error": "Scrapling is not installed. Run: pip install scrapling"}))
except Exception as e:
    print(json.dumps({"startUrl": "${sanitizedUrl}", "pagesScraped": 0, "items": [], "success": False, "error": str(e)}))
`;

  try {
    const pythonBin = getPythonBinary();
    const { stdout } = await execFileAsync(pythonBin, ["-c", script], {
      timeout: 60000,
      windowsHide: true,
    });

    const jsonStart = stdout.indexOf("{");
    const jsonEnd = stdout.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      return {
        startUrl,
        pagesScraped: 0,
        items: [],
        success: false,
        error: "Invalid JSON response from Scrapling process",
        latency: Date.now() - start,
      };
    }

    const data = JSON.parse(stdout.slice(jsonStart, jsonEnd + 1));
    return { ...data, latency: Date.now() - start };
  } catch (err) {
    return {
      startUrl,
      pagesScraped: 0,
      items: [],
      success: false,
      error: err instanceof Error ? err.message : String(err),
      latency: Date.now() - start,
    };
  }
}

/**
 * Quick check if Scrapling Python package is available on this system.
 */
export async function isScraplingAvailable(): Promise<boolean> {
  try {
    const pythonBin = getPythonBinary();
    await execFileAsync(pythonBin, ["-c", "import scrapling; print('ok')"], {
      timeout: 5000,
      windowsHide: true,
    });
    return true;
  } catch {
    return false;
  }
}
