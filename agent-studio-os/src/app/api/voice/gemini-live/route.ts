import { NextResponse } from "next/server";
import { getActiveApiKeys, executeChatCompletion } from "@/lib/llm-router";
import { prisma } from "@/lib/prisma";
import { getAuthUserId, getUserScopedWhere } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");

    const keys = await getActiveApiKeys();
    const geminiKey =
      keys["GEMINI_API_KEY"] ||
      keys["GOOGLE_API_KEY"] ||
      keys["GOOGLE_GENERATIVE_AI_API_KEY"] ||
      "";

    // Fetch agent persona instructions if agentId is provided
    let systemInstruction =
      "You are an intelligent, ultra-low-latency conversational real-time voice AI assistant in Agent Studio OS. Keep responses concise (1 to 2 sentences), natural, clear, and proactive.";
    let agentName = "AI Voice Assistant";
    let agentAvatar = "mic";

    if (agentId) {
      try {
        const agent = await prisma.agent.findFirst({
          where: await getUserScopedWhere({ id: agentId }),
        });
        if (agent) {
          agentName = agent.displayName || agent.name;
          agentAvatar = agent.avatar || "bot";
          systemInstruction = `You are ${agentName}, an autonomous real-time voice agent in Agent Studio OS.
Role: ${agent.role || "Specialist"}
Directives: ${agent.systemPrompt || "Be extremely concise, proactive, helpful, and speak with natural cadence."}
Voice Rules:
1. Always respond in natural spoken English.
2. Keep spoken responses concise (1 to 3 sentences maximum) unless the user explicitly requests an in-depth explanation.
3. Never read out raw markdown, code blocks, or URLs verbatim. Instead, summarize actions clearly.
4. If interrupted, immediately acknowledge the user's latest point.`;
        }
      } catch (err) {
        console.warn("Could not load agent profile for voice session:", err);
      }
    }

    // Google Generative AI Multimodal Live WebSocket URL requires query param ?key=... in browsers
    const baseEndpoint =
      "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";
    const liveEndpointWithKey = geminiKey ? `${baseEndpoint}?key=${encodeURIComponent(geminiKey)}` : "";

    return NextResponse.json({
      success: true,
      hasKey: Boolean(geminiKey && geminiKey.length > 5),
      apiKey: geminiKey,
      model: "models/gemini-2.0-flash-exp",
      liveEndpoint: liveEndpointWithKey,
      baseEndpoint,
      voices: [
        { id: "Puck", name: "Puck (Energetic & Expressive)", gender: "Male" },
        { id: "Aoede", name: "Aoede (Warm & Clear)", gender: "Female" },
        { id: "Charon", name: "Charon (Deep & Professional)", gender: "Male" },
        { id: "Fenrir", name: "Fenrir (Crisp & Direct)", gender: "Male" },
        { id: "Kore", name: "Kore (Smooth & Friendly)", gender: "Female" },
      ],
      defaultVoice: "Puck",
      agentName,
      agentAvatar,
      systemInstruction,
    });
  } catch (error: any) {
    console.error("Gemini Live config error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load voice configuration" },
      { status: 500 }
    );
  }
}

/**
 * Robust Voice Fallback Turn-Taking API:
 * If the Gemini Live WebSocket fails, is blocked, or the user's key format is non-standard,
 * this endpoint provides low-latency voice synthesis response so the voice orb ALWAYS works.
 */
export async function POST(req: Request) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { message, agentId, voice } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    let agentPrompt =
      "You are an intelligent conversational voice AI assistant. Respond in 1-2 natural, spoken sentences.";
    let agentName = "AI Voice Assistant";

    if (agentId) {
      const agent = await prisma.agent.findFirst({
        where: await getUserScopedWhere({ id: agentId }),
      });
      if (agent) {
        agentName = agent.displayName || agent.name;
        agentPrompt = `You are ${agentName}, an autonomous real-time voice agent in Agent Studio OS.
Role: ${agent.role || "Specialist"}
Directives: ${agent.systemPrompt || "Be extremely concise, proactive, and natural."}
Respond conversationally in 1-2 spoken sentences. Avoid reading raw markdown.`;
      }
    }

    const completion = await executeChatCompletion({
      prompt: message,
      systemPrompt: agentPrompt,
      model: "auto/fast",
    });

    return NextResponse.json({
      success: true,
      text: completion.content,
      agentName,
      model: completion.source || "auto/fast",
      latency: completion.latency,
    });
  } catch (error: any) {
    console.error("Voice completion fallback error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Voice completion failed" },
      { status: 500 }
    );
  }
}
