import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getVaultPath, ensureVaultExists } from "@/lib/vault";

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;

    const session = await prisma.chatSession.findUnique({
      where: { id },
      include: {
        agent: true,
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Chat session not found" },
        { status: 404 }
      );
    }

    await ensureVaultExists();
    const vaultPath = getVaultPath();
    const sessionsDir = path.join(vaultPath, "sessions");
    await fs.mkdir(sessionsDir, { recursive: true });

    const safeTitle = session.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `${dateStr}-${session.agent.name}-${safeTitle || "chat"}.md`;
    const fullPath = path.join(sessionsDir, filename);
    const relPath = `sessions/${filename}`;

    // Format markdown transcript
    const lines: string[] = [
      "---",
      `title: "${session.title}"`,
      `agent: "${session.agent.displayName}"`,
      `agent_id: "${session.agent.id}"`,
      `model: "${session.model || "default"}"`,
      `session_id: "${session.id}"`,
      `date: "${session.createdAt.toISOString()}"`,
      "tags:",
      "  - agent-session",
      `  - agent/${session.agent.name}`,
      "---",
      "",
      `# ${session.title}`,
      "",
      `> **Agent:** ${session.agent.avatar} ${session.agent.displayName} (${session.agent.role || "Specialist"})  `,
      `> **Model:** \`${session.model || "omniroute"}\` | **Exported:** ${new Date().toLocaleString()}  `,
      "",
      "---",
      "",
    ];

    if (session.messages.length === 0) {
      lines.push("*Empty session &mdash; no dialogue recorded.*");
    } else {
      for (const msg of session.messages) {
        const roleHeader =
          msg.role === "user"
            ? "### 👤 User"
            : `### ${session.agent.avatar} ${session.agent.displayName}`;
        const timeBadge = new Date(msg.createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });

        lines.push(`${roleHeader} *(${timeBadge})*`);
        lines.push("");
        lines.push(msg.content.trim());
        lines.push("");
        lines.push("---");
        lines.push("");
      }
    }

    const markdownContent = lines.join("\n");
    await fs.writeFile(fullPath, markdownContent, "utf-8");

    // Log to activity log
    try {
      await prisma.activityLog.create({
        data: {
          type: "note_created",
          message: `Exported session "${session.title}" to Vault (${relPath})`,
          agentId: session.agent.id,
        },
      });
    } catch {
      // Ignore
    }

    return NextResponse.json({
      success: true,
      vaultPath: relPath,
      filename,
      message: `Session exported to ${relPath}`,
    });
  } catch (error) {
    console.error("[Session Export] Error:", error);
    return NextResponse.json(
      { error: "Failed to export chat session to Obsidian Vault" },
      { status: 500 }
    );
  }
}
