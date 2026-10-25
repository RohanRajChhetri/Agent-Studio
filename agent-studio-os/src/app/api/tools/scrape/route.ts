import { NextRequest, NextResponse } from "next/server";
import { scrapePage, isScraplingAvailable } from "@/lib/scrapling-bridge";
import { writeVaultFile, ensureVaultExists } from "@/lib/vault";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/tools/scrape
 * Execute a one-shot web scrape using Scrapling bridge.
 * Optionally saves results to the Obsidian vault.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      url,
      selectors,
      toMarkdown = true,
      stealthMode = false,
      saveToVault = false,
    } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Missing required field: url" },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: `Invalid URL: "${url}"` },
        { status: 400 }
      );
    }

    // Check Scrapling availability
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

    const result = await scrapePage(url, {
      selectors: Array.isArray(selectors) ? selectors : undefined,
      toMarkdown,
      stealthMode,
    });

    // Save to vault if requested and scrape succeeded
    if (saveToVault && result.success && result.content) {
      try {
        await ensureVaultExists();
        const slug = (result.title || url)
          .replace(/[^a-zA-Z0-9\s-]/g, "")
          .trim()
          .replace(/\s+/g, "-")
          .toLowerCase()
          .slice(0, 60);
        const vaultPath = `research/${slug || "scraped-page"}.md`;
        const vaultContent = `---
source: ${url}
scraped_at: ${new Date().toISOString()}
type: web_scrape
---

# ${result.title || url}

${result.markdown || result.content}

---
*Scraped by Agent Studio OS via Scrapling*
`;
        await writeVaultFile(vaultPath, vaultContent);
        (result as any).vaultPath = vaultPath;
      } catch (vaultErr) {
        console.warn("[Scrape API] Vault save failed:", vaultErr);
      }
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        type: "agent_action",
        message: `Web scrape executed: ${url.slice(0, 80)} (${result.success ? "success" : "failed"}, ${result.latency}ms)`,
      },
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[Scrape API] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Scrape execution failed" },
      { status: 500 }
    );
  }
}
