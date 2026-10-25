import { NextRequest, NextResponse } from "next/server";
import { crawlSite, isScraplingAvailable } from "@/lib/scrapling-bridge";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/tools/crawl
 * Crawl multiple pages from a starting URL using Scrapling concurrent crawler.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { start_url, max_pages = 10, selectors, output_format = "json" } = body;

    const url = start_url || body.url;
    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Missing required field: start_url" },
        { status: 400 }
      );
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: `Invalid URL: "${url}"` },
        { status: 400 }
      );
    }

    const available = await isScraplingAvailable();
    if (!available) {
      return NextResponse.json(
        {
          error: "Scrapling is not installed on this system. Install with: pip install scrapling && scrapling install",
          installCommand: "pip install scrapling && scrapling install",
        },
        { status: 503 }
      );
    }

    const result = await crawlSite(url, {
      maxPages: typeof max_pages === "number" ? Math.min(Math.max(1, max_pages), 50) : 10,
      selectors,
      outputFormat: output_format,
    });

    await prisma.activityLog.create({
      data: {
        type: "agent_action",
        message: `Web crawl: ${url.slice(0, 70)} (${result.pagesScraped} pages, ${result.latency}ms)`,
      },
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[Crawl API] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Crawl execution failed" },
      { status: 500 }
    );
  }
}
