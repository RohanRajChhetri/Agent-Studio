import { NextResponse } from "next/server";
import { spawn, exec } from "child_process";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { getHermesHome, writeEnvKey } from "@/lib/hermes";
import {
  startWhatsAppBridge,
  stopWhatsAppBridge,
  checkBridgeHealth,
  sendWhatsAppTestMessage,
  getWhatsAppServiceStatus,
  getWhatsAppConfigs,
  autoBootWhatsAppIfConfigured,
  getBridgePaths,
} from "@/lib/whatsapp-service";

// Cache active pairing process across requests by agentId
const activePairProcesses = new Map<string, ReturnType<typeof spawn>>();
const latestPairStates = new Map<string, {
  status: "idle" | "generating" | "qr_ready" | "connected" | "error";
  qr?: string;
  qrDataUrl?: string;
  user?: any;
  error?: string;
  startedAt?: number;
}>();

export async function GET(request: Request) {
  const url = new URL(request.url);
  const agentId = url.searchParams.get("agentId");

  // Non-blocking background boot
  void autoBootWhatsAppIfConfigured().catch((err) => {
    console.error("[WhatsApp Auto-Boot Error]:", err);
  });

  const configs = await getWhatsAppConfigs();

  if (agentId) {
    const config = configs.find(c => c.agentId === agentId);
    const { sessionDir, credsFile } = getBridgePaths(agentId);
    const hasSession = existsSync(credsFile);
    const state = latestPairStates.get(agentId) || { status: "idle" };
    const service = getWhatsAppServiceStatus(agentId);
    let health = { running: false };
    if (service) {
       health = await checkBridgeHealth(service.bridgePort);
    }
    return NextResponse.json({
      hasSession,
      sessionDir,
      state,
      service,
      health,
      config,
    });
  }

  // Return all configs if no specific agent requested
  return NextResponse.json({ configs });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, agentId } = body;
    
    if (!agentId) {
      return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    }

    const { sessionDir, bridgeDir, bridgeScript, credsFile, home } = getBridgePaths(agentId);

    if (action === "check_status") {
      const hasSession = existsSync(credsFile);
      const state = latestPairStates.get(agentId) || { status: "idle" };
      if (hasSession && state.status !== "connected") {
        latestPairStates.set(agentId, { status: "connected" });
      }
      return NextResponse.json({
        hasSession,
        state: latestPairStates.get(agentId),
      });
    }

    if (action === "launch_terminal") {
      try {
        exec('cmd.exe /c start cmd.exe /k "hermes whatsapp"');
        return NextResponse.json({ success: true });
      } catch (err) {
        return NextResponse.json({ success: false }, { status: 500 });
      }
    }

    if (action === "start_pair") {
      if (existsSync(credsFile) && !body.force) {
        return NextResponse.json({
          status: "connected",
          hasSession: true,
        });
      }

      if (activePairProcesses.has(agentId)) {
        try { activePairProcesses.get(agentId)?.kill(); } catch {}
        activePairProcesses.delete(agentId);
      }

      await fs.mkdir(sessionDir, { recursive: true });

      if (body.force && existsSync(credsFile)) {
        try {
          await fs.rm(sessionDir, { recursive: true, force: true });
          await fs.mkdir(sessionDir, { recursive: true });
        } catch {}
      }

      latestPairStates.set(agentId, { status: "generating", startedAt: Date.now() });

      return new Promise<Response>((resolve) => {
        let resolved = false;

        const child = spawn(
          "node",
          [bridgeScript, "--pair-only", "--pair-json", "--session", sessionDir],
          {
            cwd: bridgeDir,
            env: { ...process.env, WHATSAPP_MODE: body.mode || "bot" },
            windowsHide: true,
          }
        );

        activePairProcesses.set(agentId, child);

        child.stderr?.on("data", (errChunk) => {
          console.error(`[WhatsApp Bridge ${agentId} stderr]:`, errChunk.toString("utf-8"));
        });

        child.on("error", (spawnErr) => {
          console.error(`[WhatsApp Bridge ${agentId} spawn error]:`, spawnErr);
          latestPairStates.set(agentId, { status: "error", error: spawnErr.message });
          if (!resolved) {
            resolved = true;
            resolve(NextResponse.json({ status: "error", error: spawnErr.message }));
          }
        });

        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve(NextResponse.json({ status: "timeout" }));
          }
        }, 30000);

        let buffer = "";
        child.stdout.on("data", async (chunk) => {
          buffer += chunk.toString("utf-8");
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("{")) continue;

            try {
              const event = JSON.parse(trimmed);

              if (event.event === "qr" && event.qr) {
                const qrDataUrl = await QRCode.toDataURL(event.qr, { margin: 2, scale: 8, color: { dark: "#0f172a", light: "#ffffff" } });
                latestPairStates.set(agentId, { status: "qr_ready", qr: event.qr, qrDataUrl, startedAt: Date.now() });
                if (!resolved) {
                  resolved = true;
                  clearTimeout(timeout);
                  resolve(NextResponse.json({ status: "qr_ready", qr: event.qr, qrDataUrl }));
                }
              }

              if (event.event === "connected") {
                latestPairStates.set(agentId, { status: "connected", user: event.user });

                const existing = await prisma.agentIntegration.findUnique({ where: { agentId_platform: { agentId, platform: "whatsapp" } } });
                let currentConfig = {};
                if (existing?.config) try { currentConfig = JSON.parse(existing.config); } catch {}
                
                const newConfig = { ...currentConfig, paired: true, user: event.user };
                await prisma.agentIntegration.upsert({
                  where: { agentId_platform: { agentId, platform: "whatsapp" } },
                  create: { agentId, platform: "whatsapp", enabled: true, config: JSON.stringify(newConfig) },
                  update: { enabled: true, config: JSON.stringify(newConfig) },
                });

                await prisma.activityLog.create({
                  data: {
                    type: "device_connected",
                    message: `WhatsApp personal device paired successfully`,
                    agentId,
                  },
                });
              }

              if (event.event === "error") {
                latestPairStates.set(agentId, { status: "error", error: event.error });
              }
            } catch {}
          }
        });

        child.on("close", (code) => {
          activePairProcesses.delete(agentId);
          if (code === 0 && existsSync(credsFile)) {
            latestPairStates.set(agentId, { status: "connected" });
          } else if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve(NextResponse.json({ status: "error" }));
          }
        });
      });
    }

    if (action === "clear_session") {
      if (activePairProcesses.has(agentId)) {
        try { activePairProcesses.get(agentId)?.kill(); } catch {}
        activePairProcesses.delete(agentId);
      }

      if (existsSync(sessionDir)) {
        await fs.rm(sessionDir, { recursive: true, force: true });
        await fs.mkdir(sessionDir, { recursive: true });
      }

      await stopWhatsAppBridge(agentId);
      latestPairStates.set(agentId, { status: "idle" });

      const existing = await prisma.agentIntegration.findUnique({ where: { agentId_platform: { agentId, platform: "whatsapp" } } });
      let currentConfig: any = {};
      if (existing?.config) try { currentConfig = JSON.parse(existing.config); } catch {}
      currentConfig.paired = false;
      delete currentConfig.user;

      await prisma.agentIntegration.update({
        where: { agentId_platform: { agentId, platform: "whatsapp" } },
        data: { enabled: false, config: JSON.stringify(currentConfig) },
      });

      return NextResponse.json({ success: true, message: "WhatsApp session cleared" });
    }

    if (action === "start_service") {
      const agent = await prisma.agent.findUnique({ where: { id: agentId } });
      const result = await startWhatsAppBridge(agentId, agent?.displayName || "Specialist", body.mode || "self-chat");
      return NextResponse.json(result, { status: result.success ? 200 : 500 });
    }

    if (action === "stop_service") {
      const result = await stopWhatsAppBridge(agentId);
      return NextResponse.json(result);
    }

    if (action === "send_test") {
      const service = getWhatsAppServiceStatus(agentId);
      if (!service) return NextResponse.json({ success: false }, { status: 400 });
      const result = await sendWhatsAppTestMessage(body.phone, body.text, service.bridgePort);
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    if (action === "set_mode") {
      const mode = body.mode === "bot" ? "bot" : "self-chat";
      const existing = await prisma.agentIntegration.findUnique({ where: { agentId_platform: { agentId, platform: "whatsapp" } } });
      let currentConfig: any = {};
      if (existing?.config) try { currentConfig = JSON.parse(existing.config); } catch {}
      currentConfig.mode = mode;

      await prisma.agentIntegration.upsert({
        where: { agentId_platform: { agentId, platform: "whatsapp" } },
        create: { agentId, platform: "whatsapp", enabled: true, config: JSON.stringify(currentConfig) },
        update: { enabled: true, config: JSON.stringify(currentConfig) },
      });

      const service = getWhatsAppServiceStatus(agentId);
      if (service) service.mode = mode;

      return NextResponse.json({ success: true, mode });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("WhatsApp integration error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
