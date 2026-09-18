import { NextResponse } from "next/server";
import { getActiveApiKeys } from "@/lib/llm-router";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");

    const keys = await getActiveApiKeys();
    const geminiKey = keys["GEMINI_API_KEY"] || "";

    // Fetch agent persona instructions if agentId is provided
    let systemInstruction = "You are an intelligent, low-latency conversational real-time voice AI agent. Keep responses concise, natural, and conversational.";
    let agentName = "AI Assistant";

    if (agentId) {
      try {
        const agent = await prisma.agent.findUnique({
          where: { id: agentId },
        });
        if (agent) {
          agentName = agent.displayName || agent.name;
          systemInstruction = `You are ${agentName}, an autonomous real-time AI agent in Agent Studio OS.
Role: ${agent.role || "Autonomous Specialist"}
System Directives: ${agent.systemPrompt || "Be extremely concise, proactive, and speak with natural cadence."}
Important Voice Rules:
1. Always respond in spoken conversational English.
2. Keep spoken responses concise (1 to 3 sentences maximum) unless specifically asked for a detailed breakdown.
3. Avoid reading out raw markdown, code blocks, or URLs verbatim. Instead summarize what was done.
4. If interrupted, immediately acknowledge and answer the user's latest point.`;
        }
      } catch (err) {
        console.warn("Could not load agent profile for voice session:", err);
      }
    }

    return NextResponse.json({
      success: true,
      hasKey: Boolean(geminiKey && geminiKey.length > 5),
      apiKey: geminiKey,
      model: "models/gemini-2.0-flash-exp",
      liveEndpoint: "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent",
      voices: [
        { id: "Puck", name: "Puck (Energetic & Expressive)", gender: "Male", pitch: "Normal" },
        { id: "Aoede", name: "Aoede (Warm & Clear)", gender: "Female", pitch: "Natural" },
        { id: "Charon", name: "Charon (Deep & Professional)", gender: "Male", pitch: "Low" },
        { id: "Fenrir", name: "Fenrir (Crisp & Direct)", gender: "Male", pitch: "Firm" },
        { id: "Kore", name: "Kore (Smooth & Friendly)", gender: "Female", pitch: "Soothing" },
      ],
      defaultVoice: "Puck",
      agentName,
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
