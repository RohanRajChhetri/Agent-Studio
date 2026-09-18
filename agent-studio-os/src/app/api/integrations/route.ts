import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { INTEGRATION_DEFINITIONS } from "@/types";
import { writeEnvKey, getProfileEnvPath } from "@/lib/hermes";
import { startTelegramPoller } from "@/lib/telegram-service";

import { existsSync } from "fs";
import { getBridgePaths } from "@/lib/whatsapp-service";

export interface IntegrationConfigItem {
  id: string;
  label: string;
  description: string;
  setupCmd: string;
  enabled: boolean;
  assignedAgentIds?: string[];
  assignedAgents?: {
    id: string;
    displayName: string;
    avatar: string;
  }[];
  config: Record<string, any>;
  hasCredentials: boolean;
  status: "connected" | "configured" | "pairing_required" | "disconnected" | "not_configured";
  updatedAt?: string;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const agentId = url.searchParams.get("agentId");

    const agents = await prisma.agent.findMany({
      select: {
        id: true,
        displayName: true,
        avatar: true,
      },
    });

    const agentMap = new Map<string, { id: string; displayName: string; avatar: string }>();
    for (const a of agents) {
      agentMap.set(a.id, a);
    }

    const agentIntegrations = await prisma.agentIntegration.findMany();

    const results = INTEGRATION_DEFINITIONS.map((def) => {
      const matchingIntegrations = agentIntegrations.filter((ai) => ai.platform === def.id);
      const agentIntegration = agentId ? matchingIntegrations.find((ai) => ai.agentId === agentId) : null;

      let currentConfig: Record<string, any> = {};
      if (agentIntegration?.config) {
        try {
          currentConfig = JSON.parse(agentIntegration.config);
        } catch {}
      }

      const agentConfigs = matchingIntegrations.map((ai) => {
        let parsedConfig: any = {};
        try {
          parsedConfig = ai.config ? JSON.parse(ai.config) : {};
        } catch {}

        // Mask sensitive fields for general listing
        const maskedConfig: Record<string, any> = { ...parsedConfig };
        if (maskedConfig.botToken) {
          maskedConfig.botTokenMasked =
            maskedConfig.botToken.length > 8
              ? `${maskedConfig.botToken.slice(0, 4)}...${maskedConfig.botToken.slice(-4)}`
              : "••••••••";
        }

        return {
          agentId: ai.agentId,
          enabled: ai.enabled,
          config: maskedConfig,
        };
      });

      // Compute platform status and assigned agent
      let status: "connected" | "configured" | "pairing_required" | "not_configured" =
        "not_configured";
      let assignedAgent: { displayName: string; avatar: string } | null = null;

      if (def.id === "whatsapp") {
        const activeWa = matchingIntegrations.find((ai) => {
          let c: any = {};
          try {
            c = JSON.parse(ai.config || "{}");
          } catch {}
          const { credsFile } = getBridgePaths(ai.agentId);
          return ai.enabled && (c.paired === true || existsSync(credsFile));
        });

        if (activeWa) {
          status = "connected";
          const a = agentMap.get(activeWa.agentId);
          if (a) assignedAgent = { displayName: a.displayName, avatar: a.avatar };
        } else if (matchingIntegrations.some((ai) => ai.enabled)) {
          status = "pairing_required";
          const first = matchingIntegrations[0];
          const a = agentMap.get(first.agentId);
          if (a) assignedAgent = { displayName: a.displayName, avatar: a.avatar };
        }
      } else if (def.id === "telegram") {
        const activeTg = matchingIntegrations.find((ai) => {
          let c: any = {};
          try {
            c = JSON.parse(ai.config || "{}");
          } catch {}
          return ai.enabled && Boolean(c.botToken);
        });

        if (activeTg) {
          status = "connected";
          const a = agentMap.get(activeTg.agentId);
          if (a) assignedAgent = { displayName: a.displayName, avatar: a.avatar };
        } else if (matchingIntegrations.length > 0) {
          status = "configured";
        }
      } else if (def.id === "webhook") {
        status = "connected";
      } else if (matchingIntegrations.some((ai) => ai.enabled)) {
        status = "configured";
        const first = matchingIntegrations[0];
        const a = agentMap.get(first.agentId);
        if (a) assignedAgent = { displayName: a.displayName, avatar: a.avatar };
      }

      return {
        id: def.id,
        label: def.label,
        description: def.description,
        setupCmd: def.setupCmd,
        status,
        assignedAgent,
        agentConfigs,
        currentConfig,
        currentEnabled: agentIntegration?.enabled ?? false,
      };
    });

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error fetching integrations:", error);
    return NextResponse.json(
      { error: "Failed to fetch integrations" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { platform, agentId, enabled = true, config = {} } = body;

    if (!platform || !agentId) {
      return NextResponse.json({ error: "Platform and agentId are required" }, { status: 400 });
    }

    // Load existing settings if any to preserve tokens if client sent empty mask
    const existingIntegration = await prisma.agentIntegration.findUnique({
      where: { agentId_platform: { agentId, platform } },
    });

    let existingData: Record<string, any> = {};
    if (existingIntegration?.config) {
      try {
        existingData = JSON.parse(existingIntegration.config);
      } catch {}
    }

    const mergedConfig = { ...existingData };
    for (const [k, v] of Object.entries(config)) {
      if (typeof v === "string" && v.includes("••••")) continue;
      if (v !== undefined && v !== "") {
        mergedConfig[k] = v;
      }
    }

    await prisma.agentIntegration.upsert({
      where: { agentId_platform: { agentId, platform } },
      create: {
        agentId,
        platform,
        enabled: Boolean(enabled),
        config: JSON.stringify(mergedConfig),
      },
      update: {
        enabled: Boolean(enabled),
        config: JSON.stringify(mergedConfig),
      },
    });

    // Write to env only for fallback logic if needed, but per-agent doesn't use global env token well.
    try {
      const envPath = getProfileEnvPath();
      if (platform === "whatsapp") {
        await writeEnvKey(envPath, "WHATSAPP_ENABLED", enabled ? "true" : "false");
      }
    } catch (e) {
      console.warn("Failed to sync to Hermes .env:", e);
    }
    
    // Activity log
    await prisma.activityLog.create({
      data: {
        type: "device_connected",
        message: `${platform.toUpperCase()} integration updated for agent`,
        agentId: agentId,
      },
    });

    return NextResponse.json({ success: true, platform, enabled });

  } catch (error) {
    console.error("Error saving integration:", error);
    return NextResponse.json(
      { error: "Failed to save integration" },
      { status: 500 }
    );
  }
}
