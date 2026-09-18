import { NextResponse } from "next/server";
import { fetchModels, fetchCombos } from "@/lib/omniroute";
import { VERIFIED_MODELS, executeChatCompletion, getActiveApiKeys } from "@/lib/llm-router";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const keys = await getActiveApiKeys();
    const [{ models: omniModels, online }, omniCombos] = await Promise.all([
      fetchModels(),
      fetchCombos(),
    ]);

    const seen = new Set<string>();
    const workingModels: Array<{ id: string; object?: string; owned_by?: string }> = [];

    // 1. Dynamic User-Defined & System Combos from Omniroute (/v1/combos)
    for (const combo of omniCombos) {
      if (combo.name && !seen.has(combo.name)) {
        seen.add(combo.name);
        workingModels.push({
          id: combo.name,
          object: "combo",
          owned_by: "Omniroute Combos",
        });
      }
    }

    // 2. Default Omniroute Combos (when not already loaded)
    const defaultCombos = [
      { id: "auto/fast", owned_by: "Omniroute Combos" },
      { id: "auto/smart", owned_by: "Omniroute Combos" },
      { id: "auto/best-coding", owned_by: "Omniroute Combos" },
      { id: "auto/best-chat", owned_by: "Omniroute Combos" },
    ];

    for (const combo of defaultCombos) {
      if (!seen.has(combo.id)) {
        seen.add(combo.id);
        workingModels.push({
          id: combo.id,
          object: "combo",
          owned_by: "omniroute",
        });
      }
    }

    // 3. Dynamic Models from live Omniroute instance (/v1/models)
    if (online && omniModels && omniModels.length > 0) {
      for (const m of omniModels) {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          const owned = m.owned_by || (m.id.startsWith("auto/") ? "omniroute" : m.id.split("/")[0] || "omniroute");
          workingModels.push({
            id: m.id,
            object: m.object || "model",
            owned_by: owned,
          });
        }
      }
    }

    // 2. Verified Active Gemini Models (when GEMINI_API_KEY is available or always enabled)
    if (keys.GEMINI_API_KEY) {
      const geminiModels = [
        { id: "google/gemini-3.6-flash", owned_by: "gemini" },
        { id: "google/gemini-3.8-flash", owned_by: "gemini" },
        { id: "google/gemini-3.5-flash", owned_by: "gemini" },
        { id: "google/gemini-3.1-flash-lite", owned_by: "gemini" },
        { id: "google/gemini-flash-latest", owned_by: "gemini" },
      ];
      for (const gm of geminiModels) {
        if (!seen.has(gm.id)) {
          seen.add(gm.id);
          workingModels.push({
            id: gm.id,
            object: "model",
            owned_by: "gemini",
          });
        }
      }
    } else {
      // Fallback default gemini
      workingModels.push({
        id: "google/gemini-3.6-flash",
        object: "model",
        owned_by: "gemini",
      });
      seen.add("google/gemini-3.6-flash");
    }

    // 3. Verified Active OpenRouter Models
    if (keys.OMNIROUTE_API_KEY || keys.OPENROUTER_API_KEY) {
      const orModels = [
        { id: "meta-llama/llama-3.3-70b-instruct", owned_by: "openrouter" },
        { id: "deepseek/deepseek-r1", owned_by: "openrouter" },
        { id: "qwen/qwen-2.5-coder-32b-instruct", owned_by: "openrouter" },
      ];
      for (const om of orModels) {
        if (!seen.has(om.id)) {
          seen.add(om.id);
          workingModels.push({ id: om.id, object: "model", owned_by: om.owned_by });
        }
      }
    }

    // 4. Provider-specific models when keys are available
    if (keys.OPENAI_API_KEY) {
      const oaiModels = [
        { id: "openai/gpt-4o", owned_by: "openai" },
        { id: "openai/gpt-4o-mini", owned_by: "openai" },
        { id: "openai/o3-mini", owned_by: "openai" },
      ];
      for (const om of oaiModels) {
        if (!seen.has(om.id)) {
          seen.add(om.id);
          workingModels.push({ id: om.id, object: "model", owned_by: "openai" });
        }
      }
    }

    if (keys.ANTHROPIC_API_KEY) {
      const anthroModels = [
        { id: "anthropic/claude-3-7-sonnet", owned_by: "anthropic" },
        { id: "anthropic/claude-3.5-sonnet", owned_by: "anthropic" },
        { id: "anthropic/claude-3-5-haiku-20241022", owned_by: "anthropic" },
      ];
      for (const om of anthroModels) {
        if (!seen.has(om.id)) {
          seen.add(om.id);
          workingModels.push({ id: om.id, object: "model", owned_by: "anthropic" });
        }
      }
    }

    if (keys.GROQ_API_KEY) {
      const groqModels = [
        { id: "groq/llama-3.3-70b-versatile", owned_by: "groq" },
        { id: "groq/llama-3.1-8b-instant", owned_by: "groq" },
        { id: "groq/deepseek-r1-distill-llama-70b", owned_by: "groq" },
      ];
      for (const om of groqModels) {
        if (!seen.has(om.id)) {
          seen.add(om.id);
          workingModels.push({ id: om.id, object: "model", owned_by: "groq" });
        }
      }
    }

    if (keys.DEEPSEEK_API_KEY) {
      const dsModels = [
        { id: "deepseek/deepseek-chat", owned_by: "deepseek" },
        { id: "deepseek/deepseek-reasoner", owned_by: "deepseek" },
      ];
      for (const om of dsModels) {
        if (!seen.has(om.id)) {
          seen.add(om.id);
          workingModels.push({ id: om.id, object: "model", owned_by: "deepseek" });
        }
      }
    }

    return NextResponse.json({ models: workingModels, data: workingModels, online });
  } catch {
    const fallbackList = VERIFIED_MODELS.map((vm) => ({
      id: vm.id,
      object: "model",
      created: Math.floor(Date.now() / 1000),
      owned_by: vm.provider,
    }));
    return NextResponse.json({
      models: fallbackList,
      data: fallbackList,
      online: false,
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const modelId = body.modelId || body.model;
    if (!modelId) {
      return NextResponse.json(
        { error: "Model ID is required" },
        { status: 400 }
      );
    }

    const start = Date.now();
    const result = await executeChatCompletion({
      prompt: "Respond with the single word: OK",
      model: modelId,
    });

    const success =
      result.source !== "fallback" &&
      result.content.trim().length > 0 &&
      !result.content.includes("⚠️");

    return NextResponse.json({
      success,
      latency: result.latency || Date.now() - start,
      response: result.content,
      source: result.source,
      error: success ? undefined : result.content,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        latency: 0,
        error: error instanceof Error ? error.message : "Test failed",
      },
      { status: 500 }
    );
  }
}
