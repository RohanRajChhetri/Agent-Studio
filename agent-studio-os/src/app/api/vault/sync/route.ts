import { NextResponse } from "next/server";
import { ensureVaultExists, writeVaultFile } from "@/lib/vault";
import { slugify } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const { title, content, category = "research", tags = [], author = "user" } = await request.json();

    if (!title || !content) {
      return NextResponse.json(
        { error: "Title and content are required" },
        { status: 400 }
      );
    }

    await ensureVaultExists();

    const cleanTitle = title.trim();
    const cleanCategory = category.trim().toLowerCase();
    const tagList = Array.isArray(tags) ? tags : [tags].filter(Boolean);
    if (!tagList.includes(cleanCategory)) {
      tagList.push(cleanCategory);
    }

    const filename = `${cleanCategory}/${slugify(cleanTitle)}.md`;
    const frontmatter = `---
title: "${cleanTitle.replace(/"/g, '\\"')}"
category: "${cleanCategory}"
agent: "${author}"
date: "${new Date().toISOString()}"
tags: [${tagList.map((t: string) => `"#${t.replace(/^#/, "")}"`).join(", ")}]
---

# ${cleanTitle}

${content.trim()}
`;

    await writeVaultFile(filename, frontmatter);

    return NextResponse.json({
      success: true,
      title: cleanTitle,
      category: cleanCategory,
      relPath: filename,
      path: filename,
      tags: tagList,
    });
  } catch (error) {
    console.error("[Vault Sync API] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to synchronize note into vault",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
