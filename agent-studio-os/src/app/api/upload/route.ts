import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { prisma } from "@/lib/prisma";
import { getAuthUserId, getUserScopedWhere } from "@/lib/user-auth";

const UPLOAD_DIR = join(process.cwd(), "public", "uploads");
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

/**
 * File Upload API
 * Handles document/PDF/image/any file uploads for AI processing
 */
export async function POST(request: Request) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const agentId = formData.get("agentId") as string | null;
    const sessionId = formData.get("sessionId") as string | null;
    const extractText = formData.get("extractText") !== "false"; // default true

    if (agentId) {
      const agent = await prisma.agent.findFirst({
        where: await getUserScopedWhere({ id: agentId }),
      });
      if (!agent) {
        return NextResponse.json({ error: "Agent not found or unauthorized" }, { status: 404 });
      }
    }

    if (sessionId) {
      const session = await prisma.chatSession.findFirst({
        where: await getUserScopedWhere({ id: sessionId }),
      });
      if (!session) {
        return NextResponse.json({ error: "Session not found or unauthorized" }, { status: 404 });
      }
    }

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 25MB)" }, { status: 400 });
    }

    // Ensure upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    // Generate unique filename
    const ext = file.name.split(".").pop() || "bin";
    const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 50);
    const uniqueName = `${baseName}-${Date.now()}.${ext}`;
    const filePath = join(UPLOAD_DIR, uniqueName);
    const publicUrl = `/uploads/${uniqueName}`;

    // Save file to disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Extract text content from supported file types
    let extractedText = "";
    const mimeType = file.type || "";
    const fileExt = ext.toLowerCase();

    if (extractText) {
      if (fileExt === "txt" || fileExt === "md" || fileExt === "csv" || fileExt === "json" || fileExt === "xml" || fileExt === "html") {
        extractedText = buffer.toString("utf-8").slice(0, 50000);
      } else if (fileExt === "pdf") {
        // Basic PDF text extraction - look for text streams
        try {
          const pdfText = buffer.toString("utf-8");
          // Simple regex-based extraction for embedded text
          const textMatches = pdfText.match(/\(([^)]+)\)/g);
          if (textMatches) {
            extractedText = textMatches
              .map((m) => m.slice(1, -1))
              .filter((t) => t.length > 2 && /[a-zA-Z]/.test(t))
              .join(" ")
              .slice(0, 50000);
          }
          if (!extractedText || extractedText.length < 20) {
            extractedText = `[PDF file: ${file.name}, ${(file.size / 1024).toFixed(1)}KB - Binary content, use an external PDF parser for full text extraction]`;
          }
        } catch {
          extractedText = `[PDF file: ${file.name}, ${(file.size / 1024).toFixed(1)}KB]`;
        }
      } else if (fileExt === "doc" || fileExt === "docx") {
        // Basic DOCX is a zip of XML
        try {
          const docText = buffer.toString("utf-8");
          const xmlContent = docText.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
          if (xmlContent) {
            extractedText = xmlContent
              .map((m) => m.replace(/<[^>]+>/g, ""))
              .join(" ")
              .slice(0, 50000);
          }
          if (!extractedText || extractedText.length < 10) {
            extractedText = `[Document file: ${file.name}, ${(file.size / 1024).toFixed(1)}KB]`;
          }
        } catch {
          extractedText = `[Document file: ${file.name}, ${(file.size / 1024).toFixed(1)}KB]`;
        }
      } else if (mimeType.startsWith("image/")) {
        extractedText = `[Image file: ${file.name}, ${(file.size / 1024).toFixed(1)}KB, type: ${mimeType}]`;
      } else {
        extractedText = `[File: ${file.name}, ${(file.size / 1024).toFixed(1)}KB, type: ${mimeType || fileExt}]`;
      }
    }

    // Log upload activity
    await prisma.activityLog.create({
      data: {
        type: "file_uploaded",
        message: `File uploaded: "${file.name}" (${(file.size / 1024).toFixed(1)}KB)`,
        agentId: agentId || null,
        userId,
        metadata: JSON.stringify({ fileName: file.name, fileSize: file.size, mimeType, publicUrl }),
      },
    });

    return NextResponse.json({
      success: true,
      file: {
        name: file.name,
        size: file.size,
        type: mimeType,
        url: publicUrl,
        uniqueName,
      },
      extractedText: extractedText || null,
      textLength: extractedText.length,
    });
  } catch (error) {
    console.error("[File Upload API] Error:", error);
    return NextResponse.json(
      { error: "Failed to upload file", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
