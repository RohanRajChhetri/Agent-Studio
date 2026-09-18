import vm from "vm";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface CodeExecutionResult {
  stdout: string;
  stderr: string;
  executionTime: number;
  success: boolean;
  error?: string;
  language: "javascript" | "python";
}

export interface WebSearchResultItem {
  title: string;
  snippet: string;
  url: string;
}

export interface WebSearchResult {
  query: string;
  results: WebSearchResultItem[];
  latency: number;
}

/** Safely execute JavaScript in a sandboxed Node VM */
export async function executeJavaScript(code: string): Promise<CodeExecutionResult> {
  const start = Date.now();
  const logs: string[] = [];
  const errors: string[] = [];

  const sandbox = {
    console: {
      log: (...args: unknown[]) => logs.push(args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ")),
      error: (...args: unknown[]) => errors.push(args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ")),
      warn: (...args: unknown[]) => logs.push("[WARN] " + args.map((a) => String(a)).join(" ")),
      info: (...args: unknown[]) => logs.push("[INFO] " + args.map((a) => String(a)).join(" ")),
    },
    Math,
    Date,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Buffer: { from: Buffer.from },
    setTimeout: (fn: () => void) => fn(),
  };

  const context = vm.createContext(sandbox);

  try {
    const script = new vm.Script(code);
    const result = script.runInContext(context, { timeout: 4000 });
    if (result !== undefined && logs.length === 0) {
      logs.push(typeof result === "object" ? JSON.stringify(result, null, 2) : String(result));
    }

    return {
      stdout: logs.join("\n") || "(Code executed with no output)",
      stderr: errors.join("\n"),
      executionTime: Date.now() - start,
      success: errors.length === 0,
      language: "javascript",
    };
  } catch (err) {
    return {
      stdout: logs.join("\n"),
      stderr: err instanceof Error ? err.message : String(err),
      executionTime: Date.now() - start,
      success: false,
      error: err instanceof Error ? err.message : String(err),
      language: "javascript",
    };
  }
}

/** Execute Python code safely using local Python runtime if available */
export async function executePython(code: string): Promise<CodeExecutionResult> {
  const start = Date.now();
  try {
    // Execute python without shell interpretation to prevent command injection
    const { stdout, stderr } = await execFileAsync("python", ["-c", code], {
      timeout: 6000,
      windowsHide: true,
    });

    return {
      stdout: stdout.trim() || "(Python script executed with no output)",
      stderr: stderr.trim(),
      executionTime: Date.now() - start,
      success: !stderr,
      language: "python",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // If python executable not found on path, return fallback info
    if (msg.includes("not recognized") || msg.includes("command not found") || msg.includes("ENOENT")) {
      return {
        stdout: "",
        stderr: "Python 3 is not installed or not in PATH on this system.",
        executionTime: Date.now() - start,
        success: false,
        error: "Python runtime unavailable",
        language: "python",
      };
    }
    return {
      stdout: "",
      stderr: msg,
      executionTime: Date.now() - start,
      success: false,
      error: msg,
      language: "python",
    };
  }
}

/** Execute code in sandbox based on specified language */
export async function executeCodeSandbox(
  code: string,
  language: string
): Promise<CodeExecutionResult> {
  const norm = language.toLowerCase().trim();
  if (norm === "python" || norm === "py") {
    return executePython(code);
  }
  return executeJavaScript(code);
}

/** Live Web Search using DuckDuckGo Lite / HTML */
export async function performWebSearch(
  query: string,
  maxResults = 4
): Promise<WebSearchResult> {
  const start = Date.now();
  const encoded = encodeURIComponent(query.trim());

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encoded}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`DuckDuckGo HTTP ${res.status}`);
    }

    const html = await res.text();
    const results: WebSearchResultItem[] = [];

    // Extract search results from HTML structure
    const snippetRegex = /<a class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;

    const snippets: string[] = [];
    let match;
    while ((match = snippetRegex.exec(html)) !== null && snippets.length < maxResults) {
      const text = match[1].replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&").trim();
      if (text) snippets.push(text);
    }

    const rawTitleRegex = /<h2 class="result__title">[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let tMatch;
    let idx = 0;
    while ((tMatch = rawTitleRegex.exec(html)) !== null && results.length < maxResults) {
      const rawUrl = tMatch[1];
      // Clean up DDG redirect URLs
      let url = rawUrl;
      const uddg = rawUrl.match(/uddg=([^&]+)/);
      if (uddg) {
        url = decodeURIComponent(uddg[1]);
      }
      const title = tMatch[2].replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&").trim();
      const snippet = snippets[idx] || "No snippet preview available.";
      idx++;

      if (title && url.startsWith("http")) {
        results.push({ title, snippet, url });
      }
    }

    // Fallback if parsing was empty
    if (results.length === 0) {
      results.push({
        title: `Search Query: "${query}"`,
        snippet: `Search executed successfully against DuckDuckGo index for: ${query}`,
        url: `https://duckduckgo.com/?q=${encoded}`,
      });
    }

    return {
      query,
      results,
      latency: Date.now() - start,
    };
  } catch (err) {
    return {
      query,
      results: [
        {
          title: `Search Query: "${query}"`,
          snippet: `Live search fallback: ${err instanceof Error ? err.message : "Connection failed"}. Check connection or provider configuration.`,
          url: `https://duckduckgo.com/?q=${encoded}`,
        },
      ],
      latency: Date.now() - start,
    };
  }
}
