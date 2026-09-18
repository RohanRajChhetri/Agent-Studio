import * as cp from "node:child_process";
import type { ChildProcess } from "node:child_process";
import path from "node:path";
import { existsSync } from "node:fs";
import { prisma } from "@/lib/prisma";
import { getHermesHome, readEnvFile } from "@/lib/hermes";
import { executeChatCompletion } from "@/lib/llm-router";
import { formatResponseTime } from "@/lib/utils";

export interface WhatsAppServiceState {
  bridgeRunning: boolean;
  listenerRunning: boolean;
  bridgePort: number;
  connectedUser: { id?: string; name?: string; phone?: string } | null;
  lastPollAt: number | null;
  lastMessageAt: number | null;
  processedCount: number;
  lastError: string | null;
  agentName: string | null;
  mode: "self-chat" | "bot";
}

export interface WhatsAppAgentTarget {
  id?: string;
  name?: string;
  displayName?: string | null;
  model?: string | null;
  systemPrompt?: string | null;
}

export interface WhatsAppMessageEvent {
  chatId?: string;
  key?: { remoteJid?: string };
  body?: string;
  text?: string;
  senderName?: string;
  senderNumber?: string;
  fromMe?: boolean;
}

declare global {
  var __whatsAppGlobalState: Map<string, WhatsAppServiceState> | undefined;
  var __whatsAppBridgeProcs: Map<string, ChildProcess> | undefined;
  var __whatsAppListenerAborts: Map<string, AbortController> | undefined;
}

const globalState: Map<string, WhatsAppServiceState> = globalThis.__whatsAppGlobalState || new Map();
globalThis.__whatsAppGlobalState = globalState;

const activeBridgeProcesses: Map<string, ChildProcess> = globalThis.__whatsAppBridgeProcs || new Map();
globalThis.__whatsAppBridgeProcs = activeBridgeProcesses;

const listenerAbortControllers: Map<string, AbortController> = globalThis.__whatsAppListenerAborts || new Map();
globalThis.__whatsAppListenerAborts = listenerAbortControllers;

let nextBasePort = 3001;

export function getBridgePaths(agentId: string) {
  const home = getHermesHome();
  const sessionDir = path.join(home, "whatsapp", `session_${agentId}`);
  const bridgeDir = path.join(home, "hermes-agent", "scripts", "whatsapp-bridge");
  const bridgeScript = path.join(bridgeDir, "bridge.js");
  const credsFile = path.join(sessionDir, "creds.json");
  return { home, sessionDir, bridgeDir, bridgeScript, credsFile };
}

export async function getWhatsAppConfigs(): Promise<{
  agentId: string;
  agent: WhatsAppAgentTarget;
  enabled: boolean;
  mode: "self-chat" | "bot";
  hasSession: boolean;
}[]> {
  const integrations = await prisma.agentIntegration.findMany({
    where: { platform: "whatsapp", enabled: true },
    include: { agent: true }
  });

  return integrations.map(i => {
    let config = {};
    try { config = JSON.parse(i.config || "{}"); } catch {}
    const mode = (config as any).mode || "self-chat";
    const { credsFile } = getBridgePaths(i.agentId);
    
    return {
      agentId: i.agentId,
      agent: i.agent,
      enabled: i.enabled,
      mode: mode as any,
      hasSession: existsSync(credsFile),
    };
  });
}

function getOrCreateState(agentId: string, agentName: string): WhatsAppServiceState {
  if (!globalState.has(agentId)) {
    globalState.set(agentId, {
      bridgeRunning: false,
      listenerRunning: false,
      bridgePort: nextBasePort++,
      connectedUser: null,
      lastPollAt: null,
      lastMessageAt: null,
      processedCount: 0,
      lastError: null,
      agentName,
      mode: "self-chat"
    });
  }
  return globalState.get(agentId)!;
}

export async function checkBridgeHealth(port: number): Promise<{
  running: boolean;
  status: string;
  user?: any;
  error?: string;
}> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        running: true,
        status: data.status || "connected",
        user: data.user,
      };
    }
    return { running: false, status: "http_error", error: `HTTP ${res.status}` };
  } catch (err) {
    return { running: false, status: "stopped", error: err instanceof Error ? err.message : "Not responding" };
  }
}

export async function startWhatsAppBridge(agentId: string, agentName: string = "Agent Studio OS", mode: string = "self-chat"): Promise<{
  success: boolean;
  message: string;
  status?: string;
}> {
  const { bridgeDir, bridgeScript, sessionDir, credsFile, home } = getBridgePaths(agentId);
  const state = getOrCreateState(agentId, agentName);
  state.mode = mode as any;

  if (!existsSync(credsFile)) {
    state.lastError = "WhatsApp session credentials not found.";
    return { success: false, message: state.lastError };
  }

  const port = state.bridgePort;

  const health = await checkBridgeHealth(port);
  if (health.running && health.status === "connected") {
    state.bridgeRunning = true;
    if (health.user) state.connectedUser = health.user;
    startWhatsAppListener(agentId, agentName);
    return { success: true, message: "Bridge already connected", status: health.status };
  }

  const existingProc = activeBridgeProcesses.get(agentId);
  if (existingProc) {
    try { existingProc.kill(); } catch {}
    activeBridgeProcesses.delete(agentId);
  }

  const envPath = path.join(home, ".env");
  const hermesEnv = await readEnvFile(envPath);

  const procRunner: typeof cp = eval("require")("node:child_process");
  const child = procRunner.spawn(
    "node",
    [bridgeScript, "--port", String(port), "--session", sessionDir],
    {
      cwd: bridgeDir,
      env: {
        ...process.env,
        ...hermesEnv,
        WHATSAPP_MODE: mode,
        WHATSAPP_BRIDGE_PORT: String(port),
      },
      windowsHide: true,
      stdio: "pipe",
    }
  );

  activeBridgeProcesses.set(agentId, child);

  child.stdout?.on("data", (d) => {
    const text = d.toString("utf-8");
    if (text.includes("WhatsApp connected") || text.includes("listening on port")) {
      state.bridgeRunning = true;
    }
  });

  child.stderr?.on("data", (d) => {
    console.error(`[WhatsApp Bridge ${agentId} stderr]:`, d.toString("utf-8"));
  });

  child.on("close", (code) => {
    state.bridgeRunning = false;
    activeBridgeProcesses.delete(agentId);
  });

  const startTime = Date.now();
  while (Date.now() - startTime < 4000) {
    await new Promise((r) => setTimeout(r, 600));
    const status = await checkBridgeHealth(port);
    if (status.running && status.status === "connected") {
      state.bridgeRunning = true;
      state.lastError = null;
      if (status.user) state.connectedUser = status.user;
      startWhatsAppListener(agentId, agentName);
      return { success: true, message: "WhatsApp bridge connected", status: status.status };
    }
  }

  const finalCheck = await checkBridgeHealth(port);
  if (finalCheck.running) {
    state.bridgeRunning = true;
    startWhatsAppListener(agentId, agentName);
    return { success: true, message: `WhatsApp bridge running`, status: finalCheck.status };
  }

  return { success: false, message: "Bridge did not signal ready in 12s." };
}

export async function stopWhatsAppBridge(agentId: string): Promise<{ success: boolean; message: string }> {
  stopWhatsAppListener(agentId);
  const proc = activeBridgeProcesses.get(agentId);
  if (proc) {
    try { proc.kill(); } catch {}
    activeBridgeProcesses.delete(agentId);
  }
  const state = globalState.get(agentId);
  if (state) state.bridgeRunning = false;
  
  return { success: true, message: "Stopped." };
}

export async function processWhatsAppMessage(
  event: any,
  agent: any,
  port: number,
  mode: string
): Promise<boolean> {
  const chatId = event.chatId || event.key?.remoteJid;
  const rawText = (event.body || event.text || "").trim();
  const senderName = event.senderName || event.senderNumber || "User";

  if (!chatId || !rawText) return false;

  const userText = rawText
    .replace(/^(⚕\s*\*.*?\*:\s*|\*.*?\*:\s*|\[.*?\]:\s*)/i, "")
    .replace(/^[─\-_=]{3,}\s*/gm, "")
    .replace(/^(⚕\s*\*.*?\*|\*.*?\*)\s*/i, "")
    .trim();

  if (!userText) return false;

  try {
    await fetch(`http://127.0.0.1:${port}/typing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {}

  try {
    const isSelfChat = mode === "self-chat";
    const agentName = agent?.displayName || "Specialist";
    const prefix = isSelfChat ? `*${agentName}*:\n` : "";

    const completion = await executeChatCompletion({
      prompt: userText,
      model: agent?.model || "auto/fast",
      systemPrompt: agent?.systemPrompt,
      agentName: agentName,
      useVaultRAG: true,
      useEpisodicMemory: true,
    });

    const replyText = `${prefix}${completion.content || "I have received your message."}`;
    const timeFormatted = formatResponseTime(completion.latency);

    await prisma.activityLog.create({
      data: {
        type: "device_message",
        message: `WhatsApp (${senderName}): "${userText.slice(0, 35)}${userText.length > 35 ? "..." : ""}" → Replied by ${agentName} (${timeFormatted})`,
        agentId: agent.id,
      },
    });

    await fetch(`http://127.0.0.1:${port}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId,
        message: replyText.trim(),
        replyTo: event.key?.id,
      }),
      signal: AbortSignal.timeout(10000),
    });

    const state = globalState.get(agent.id);
    if (state) {
      state.lastMessageAt = Date.now();
      state.processedCount++;
    }
    return true;
  } catch (err) {
    console.error("[WhatsApp Error]:", err);
    return false;
  }
}

export function startWhatsAppListener(agentId: string, agentName: string) {
  const state = getOrCreateState(agentId, agentName);
  if (state.listenerRunning) return;

  state.listenerRunning = true;
  const abortController = new AbortController();
  listenerAbortControllers.set(agentId, abortController);

  const port = state.bridgePort;

  (async () => {
    while (state.listenerRunning) {
      try {
        state.lastPollAt = Date.now();
        const res = await fetch(`http://127.0.0.1:${port}/messages`, {
          signal: AbortSignal.timeout(6000),
        });

        if (res.ok) {
          const messages: any[] = await res.json();
          if (Array.isArray(messages) && messages.length > 0) {
            const configs = await getWhatsAppConfigs();
            const config = configs.find(c => c.agentId === agentId);
            if (config && config.agent) {
              for (const msg of messages) {
                await processWhatsAppMessage(msg, config.agent, port, config.mode);
              }
            }
          }
        }
      } catch (err: any) {
        if (err.name !== "TimeoutError" && err.name !== "AbortError") {
          state.lastError = err.message;
        }
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
  })().catch(() => {
    state.listenerRunning = false;
  });
}

export function stopWhatsAppListener(agentId: string) {
  const state = globalState.get(agentId);
  if (state) state.listenerRunning = false;
  
  const controller = listenerAbortControllers.get(agentId);
  if (controller) {
    try { controller.abort(); } catch {}
    listenerAbortControllers.delete(agentId);
  }
}

export async function autoBootWhatsAppIfConfigured(): Promise<boolean> {
  const configs = await getWhatsAppConfigs();
  let bootedAny = false;
  for (const config of configs) {
    if (config.hasSession) {
      await startWhatsAppBridge(config.agentId, config.agent.displayName || "Agent Studio OS", config.mode);
      bootedAny = true;
    }
  }
  return bootedAny;
}

export function getWhatsAppServiceStatus(agentId: string) {
  return globalState.get(agentId) || null;
}

export async function sendWhatsAppTestMessage(
  targetPhoneOrChatId: string | undefined,
  testText: string | undefined,
  port: number
): Promise<{ success: boolean; message: string }> {
  const health = await checkBridgeHealth(port);
  if (!health.running) {
    return { success: false, message: "WhatsApp bridge is not currently running. Click 'Start WhatsApp Service' first." };
  }

  let chatId: string = targetPhoneOrChatId || (health.user?.id ? health.user.id.replace(/:.*@/, "@") : "status@broadcast");

  if (!chatId.includes("@")) {
    const cleanNum = chatId.replace(/\D/g, "");
    chatId = `${cleanNum}@s.whatsapp.net`;
  }

  const message = testText || `🤖 *Agent Studio OS WhatsApp Test*\n\nYour WhatsApp integration is operational and connected.`;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, message }),
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      return { success: true, message: `Test message successfully delivered to ${chatId}` };
    }
    const errData = await res.json().catch(() => ({}));
    return { success: false, message: errData.error || `Bridge returned HTTP ${res.status}` };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Failed to send test message" };
  }
}

export async function notifyWhatsAppUser(
  title: string,
  summary: string,
  details?: { agentName?: string; status?: string }
): Promise<boolean> {
  try {
    // Notify on all active connected sessions
    let notifiedAny = false;
    for (const [agentId, state] of globalState.entries()) {
      if (state.bridgeRunning) {
        const agentTag = details?.agentName ? `🤖 *Agent*: ${details.agentName}\n` : "";
        const statusTag = details?.status ? `⚡ *Status*: ${details.status}\n` : "";
        const cleanSummary = summary.length > 500 ? summary.slice(0, 500) + "..." : summary;

        const message = `🔔 *Agent Studio OS Alert*\n\n📌 *${title}*\n${agentTag}${statusTag}\n${cleanSummary}\n\n_Agent Studio OS Autonomous Relay_`;
        
        await sendWhatsAppTestMessage(undefined, message, state.bridgePort);
        notifiedAny = true;
      }
    }
    return notifiedAny;
  } catch (err) {
    console.warn("[WhatsApp Notification Relay Error]:", err);
    return false;
  }
}

