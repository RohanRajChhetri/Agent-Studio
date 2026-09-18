import { NextResponse } from "next/server";
import {
  getProfileEnvPath,
  getProfileNames,
  readEnvFile,
  writeEnvKey,
} from "@/lib/hermes";
import { PROVIDER_DEFINITIONS } from "@/types";
import { maskKey } from "@/lib/utils";
import { testProviderKey, getActiveApiKeys, invalidateActiveApiKeysCache } from "@/lib/llm-router";
import { invalidateProviderLatencyCache } from "@/app/api/dashboard/route";
import path from "path";
import fs from "fs/promises";

export async function GET() {
  try {
    const activeKeys = await getActiveApiKeys();
    const envPath = getProfileEnvPath();
    const hermesVars = await readEnvFile(envPath);

    const mergedVars = { ...hermesVars, ...activeKeys };

    const providers = PROVIDER_DEFINITIONS.map((p) => ({
      provider: p.provider,
      envVar: p.envVar,
      label: p.label,
      models: p.models,
      isSet: !!mergedVars[p.envVar],
      masked: mergedVars[p.envVar] ? maskKey(mergedVars[p.envVar]) : "",
    }));

    return NextResponse.json(providers);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch providers" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, provider, envVar, value } = body;

    // Handle key verification test
    if (action === "test") {
      const activeKeys = await getActiveApiKeys();
      const testKey = value || activeKeys[envVar];
      if (!testKey) {
        return NextResponse.json(
          { success: false, error: "No key found to test" },
          { status: 400 }
        );
      }
      const testResult = await testProviderKey(provider || "omniroute", testKey);
      return NextResponse.json(testResult);
    }

    // Handle key deletion
    if (action === "delete") {
      if (!envVar) {
        return NextResponse.json(
          { error: "envVar is required" },
          { status: 400 }
        );
      }

      // 1. Remove from runtime
      delete process.env[envVar];

      // 2. Remove from .env.local
      try {
        const localEnvPath = path.join(process.cwd(), ".env.local");
        const content = await fs.readFile(localEnvPath, "utf-8").catch(() => "");
        const lines = content.split("\n").filter(
          (line) => !line.startsWith(`${envVar}=`)
        );
        await fs.writeFile(localEnvPath, lines.join("\n"));
      } catch {
        // Best effort
      }

      // 3. Remove from Hermes .env files
      try {
        const mainEnvPath = getProfileEnvPath();
        const mainContent = await fs.readFile(mainEnvPath, "utf-8").catch(() => "");
        const mainLines = mainContent.split("\n").filter(
          (line) => !line.startsWith(`${envVar}=`)
        );
        await fs.writeFile(mainEnvPath, mainLines.join("\n"));

        const profileNames = await getProfileNames();
        for (const name of profileNames) {
          if (name !== "default") {
            try {
              const profileEnvPath = getProfileEnvPath(name);
              const pContent = await fs.readFile(profileEnvPath, "utf-8").catch(() => "");
              const pLines = pContent.split("\n").filter(
                (line) => !line.startsWith(`${envVar}=`)
              );
              await fs.writeFile(profileEnvPath, pLines.join("\n"));
            } catch {
              // Skip individual profile errors
            }
          }
        }
      } catch {
        // Best effort
      }

      // 4. Remove from ~/.omniroute/.env
      try {
        const omniEnvPath = path.join(
          process.env.USERPROFILE || process.env.HOME || "",
          ".omniroute",
          ".env"
        );
        const omniContent = await fs.readFile(omniEnvPath, "utf-8").catch(() => "");
        const omniLines = omniContent.split("\n").filter(
          (line) => !line.startsWith(`${envVar}=`)
        );
        await fs.writeFile(omniEnvPath, omniLines.join("\n"));
      } catch {
        // Best effort
      }

      // Invalidate runtime key and dashboard latency caches
      invalidateActiveApiKeysCache();
      invalidateProviderLatencyCache();

      return NextResponse.json({ success: true });
    }

    if (!envVar || !value) {
      return NextResponse.json(
        { error: "envVar and value are required" },
        { status: 400 }
      );
    }

    const cleanValue = value.trim();

    // 1. Immediately update Node process.env in runtime
    process.env[envVar] = cleanValue;

    // 2. Write to local .env.local in project
    try {
      const localEnvPath = path.join(process.cwd(), ".env.local");
      await writeEnvKey(localEnvPath, envVar, cleanValue);
    } catch {
      // Best effort for local env
    }

    // 3. Write to Hermes .env
    try {
      const mainEnvPath = getProfileEnvPath();
      await writeEnvKey(mainEnvPath, envVar, cleanValue);

      // Also write to Hermes profiles
      const profileNames = await getProfileNames();
      for (const name of profileNames) {
        if (name !== "default") {
          const profileEnvPath = getProfileEnvPath(name);
          await writeEnvKey(profileEnvPath, envVar, cleanValue);
        }
      }
    } catch (e) {
      console.warn("Hermes env write warning:", e);
    }

    // 4. Write to ~/.omniroute/.env
    try {
      const omniEnvPath = path.join(
        process.env.USERPROFILE || process.env.HOME || "",
        ".omniroute",
        ".env"
      );
      await writeEnvKey(omniEnvPath, envVar, cleanValue);
    } catch {
      // Best effort for omniroute env
    }

    // Invalidate runtime key and dashboard latency caches so changes appear immediately
    invalidateActiveApiKeysCache();
    invalidateProviderLatencyCache();

    return NextResponse.json({
      success: true,
      masked: maskKey(cleanValue),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to save provider key" },
      { status: 500 }
    );
  }
}
