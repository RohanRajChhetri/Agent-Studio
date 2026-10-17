import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId, getUserScopedWhere } from "@/lib/user-auth";

/**
 * Image Generation API
 * Uses Gemini's image generation capabilities or OpenAI DALL-E
 */
export async function POST(request: Request) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { prompt, model = "gemini", size = "1024x1024", agentId } = body;

    if (agentId) {
      const agent = await prisma.agent.findFirst({
        where: await getUserScopedWhere({ id: agentId }),
      });
      if (!agent) {
        return NextResponse.json({ error: "Agent not found or unauthorized" }, { status: 404 });
      }
    }

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const imageUrl: string | null = null;
    let imageBase64: string | null = null;
    let provider = "gemini";

    // Try Gemini image generation first
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (geminiKey && model !== "dall-e") {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: `Generate an image: ${prompt.trim()}` },
                  ],
                },
              ],
              generationConfig: {
                responseModalities: ["TEXT", "IMAGE"],
              },
            }),
          }
        );

        if (res.ok) {
          const data = await res.json();
          const parts = data.candidates?.[0]?.content?.parts || [];
          for (const part of parts) {
            if (part.inlineData) {
              imageBase64 = part.inlineData.data;
              provider = "gemini";
              break;
            }
          }
        }
      } catch (err) {
        console.warn("[Image Gen] Gemini failed:", err);
      }
    }

    // Fallback to OpenAI DALL-E
    if (!imageBase64 && !imageUrl && openaiKey) {
      try {
        const res = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: "dall-e-3",
            prompt: prompt.trim(),
            n: 1,
            size,
            response_format: "b64_json",
          }),
        });

        if (res.ok) {
          const data = await res.json();
          imageBase64 = data.data?.[0]?.b64_json || null;
          provider = "dall-e-3";
        }
      } catch (err) {
        console.warn("[Image Gen] OpenAI DALL-E failed:", err);
      }
    }

    // Fallback to OpenRouter
    if (!imageBase64 && !imageUrl) {
      const openrouterKey = process.env.OPENROUTER_API_KEY;
      if (openrouterKey) {
        try {
          const res = await fetch("https://openrouter.ai/api/v1/images/generations", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${openrouterKey}`,
            },
            body: JSON.stringify({
              prompt: prompt.trim(),
              model: "stabilityai/stable-diffusion-xl-base-1.0",
              n: 1,
              size,
              response_format: "b64_json",
            }),
          });
          if (res.ok) {
            const data = await res.json();
            imageBase64 = data.data?.[0]?.b64_json || null;
            provider = "openrouter/sdxl";
          }
        } catch {
          // silent
        }
      }
    }

    if (!imageBase64 && !imageUrl) {
      return NextResponse.json(
        { error: "No image generation provider available. Please set GEMINI_API_KEY or OPENAI_API_KEY." },
        { status: 503 }
      );
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        type: "image_generated",
        message: `Image generated: "${prompt.slice(0, 50)}" via ${provider}`,
        agentId: agentId || null,
        userId,
      },
    });

    return NextResponse.json({
      success: true,
      image: imageBase64 ? `data:image/png;base64,${imageBase64}` : imageUrl,
      provider,
      prompt: prompt.trim(),
    });
  } catch (error) {
    console.error("[Image Gen API] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate image", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
