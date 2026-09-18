import { NextResponse } from "next/server";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import { getTelegramPollerStatus } from "@/lib/telegram-service";
import fs from "fs/promises";
import path from "path";
import { getHermesHome } from "@/lib/hermes";

const execAsync = promisify(exec);

let activeGatewayProcess: ReturnType<typeof spawn> | null = null;

export async function GET() {
  const hermesHome = getHermesHome();
  const stateFile = path.join(hermesHome, "gateway_state.json");
  let gatewayState: any = { running: false };

  try {
    const raw = await fs.readFile(stateFile, "utf-8");
    const parsed = JSON.parse(raw);
    gatewayState = parsed;
    // Check if recorded PID is actually alive on Windows
    if (parsed.pid) {
      try {
        const { stdout } = await execAsync(`tasklist /FI "PID eq ${parsed.pid}" /NH`);
        gatewayState.running = stdout.includes(String(parsed.pid));
      } catch {
        gatewayState.running = false;
      }
    }
  } catch {
    gatewayState.running = false;
  }

  // Also check internal gateway process if spawned from UI
  if (activeGatewayProcess && !activeGatewayProcess.killed) {
    gatewayState.running = true;
  }

  const telegramPoller = getTelegramPollerStatus();

  return NextResponse.json({
    gateway: gatewayState,
    telegramPoller,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action } = body;

    if (action === "start") {
      if (activeGatewayProcess && !activeGatewayProcess.killed) {
        return NextResponse.json({ success: true, message: "Gateway is already running" });
      }

      // Start hermes gateway in background with accept-hooks
      const child = spawn("hermes", ["gateway", "run", "--accept-hooks"], {
        windowsHide: true,
        detached: true,
        stdio: "ignore",
      });
      child.unref();
      activeGatewayProcess = child;

      return NextResponse.json({
        success: true,
        message: "Hermes gateway service launched in background",
      });
    }

    if (action === "stop") {
      if (activeGatewayProcess) {
        try {
          activeGatewayProcess.kill();
        } catch {}
        activeGatewayProcess = null;
      }
      try {
        await execAsync("hermes gateway stop");
      } catch {}

      return NextResponse.json({
        success: true,
        message: "Hermes gateway service stopped",
      });
    }

    if (action === "install_service") {
      try {
        const { stdout } = await execAsync("hermes gateway install --start-now --start-on-login --force");
        return NextResponse.json({ success: true, message: stdout.trim() });
      } catch (err) {
        return NextResponse.json({
          success: false,
          error: err instanceof Error ? err.message : "Failed to install service",
        }, { status: 500 });
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gateway error" },
      { status: 500 }
    );
  }
}
