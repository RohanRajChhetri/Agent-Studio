import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const start = Date.now();
  try {
    const { id } = await params;
    const body = await request.json();
    let command = (body.command || "").trim();

    if (!command) {
      return NextResponse.json(
        { error: "Command string is required" },
        { status: 400 }
      );
    }

    // Strip leading 'hermes ' if the user typed it
    if (command.toLowerCase().startsWith("hermes ")) {
      command = command.slice(7).trim();
    }

    // Security check: Disallow shell chaining / injection characters
    const DANGEROUS_SHELL_CHARS = /[;&|`$<>\\\/]/;
    if (DANGEROUS_SHELL_CHARS.test(command)) {
      return NextResponse.json(
        { error: "Invalid command: shell metacharacters (; & | ` $ < > \\ /) are forbidden." },
        { status: 400 }
      );
    }

    // Security check: Whitelist valid Hermes subcommands
    const allowedSubcommands = [
      "profile",
      "config",
      "tool",
      "tools",
      "gateway",
      "chat",
      "version",
      "help",
      "status",
      "eval",
      "skill",
      "skills",
      "cron",
      "model",
      "models",
    ];
    const firstWord = command.split(/\s+/)[0]?.toLowerCase();
    if (firstWord && !allowedSubcommands.includes(firstWord)) {
      return NextResponse.json(
        { error: `Unauthorized command: '${firstWord}'. Only Hermes CLI subcommands are permitted.` },
        { status: 403 }
      );
    }

    const agent = await prisma.agent.findUnique({
      where: { id },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const profileName = agent.name;
    const env = {
      ...process.env,
      HERMES_PROFILE: profileName,
    };

    // Auto-append profile name if running profile commands without target name
    if (command === "profile show" || command === "profile describe") {
      command = `${command} ${profileName}`;
    }

    const fullCmd = `hermes ${command}`;

    try {
      const { stdout, stderr } = await execAsync(fullCmd, {
        env,
        timeout: 45000,
        windowsHide: true,
      });

      return NextResponse.json({
        success: true,
        command: fullCmd,
        profile: profileName,
        stdout: stdout || "(Command finished with no output)",
        stderr: stderr || "",
        latency: Date.now() - start,
      });
    } catch (execErr: unknown) {
      const err = execErr as { stdout?: string; stderr?: string; message?: string; code?: number };
      return NextResponse.json({
        success: false,
        command: fullCmd,
        profile: profileName,
        stdout: err.stdout || "",
        stderr: err.stderr || err.message || "Command execution error",
        exitCode: err.code || 1,
        latency: Date.now() - start,
      });
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: "Internal server error running Hermes command",
        details: error instanceof Error ? error.message : "Unknown error",
        latency: Date.now() - start,
      },
      { status: 500 }
    );
  }
}
