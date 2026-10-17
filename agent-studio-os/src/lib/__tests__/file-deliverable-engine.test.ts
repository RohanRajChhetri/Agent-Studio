import { describe, it, expect, afterAll } from "vitest";
import {
  detectFileDeliverableIntent,
  extractTextForDocument,
  compileAndDeliverFile,
} from "../file-deliverable-engine";
import fs from "fs/promises";
import path from "path";

describe("File Deliverable Engine", () => {
  const createdFiles: string[] = [];

  afterAll(async () => {
    for (const f of createdFiles) {
      const full = path.join(process.cwd(), "public", "downloads", f);
      await fs.unlink(full).catch(() => {});
    }
  });

  it("detects PDF file request in user prompt", () => {
    const res = detectFileDeliverableIntent("Please give me a pdf of an essay on artificial intelligence");
    expect(res.isRequested).toBe(true);
    expect(res.requestedType).toBe("pdf");
    expect(res.hasCodeGenerator).toBe(false);
  });

  it("detects CSV spreadsheet request in user prompt", () => {
    const res = detectFileDeliverableIntent("Export this quarterly sales data as a csv spreadsheet");
    expect(res.isRequested).toBe(true);
    expect(res.requestedType).toBe("csv");
  });

  it("detects when assistant outputted python code intended to generate a PDF", () => {
    const pythonCode = "Here is the python code to create your PDF:\n```python\nfrom reportlab.pdfgen import canvas\nc = canvas.Canvas('doc.pdf')\nc.drawString(100, 100, 'Hello World')\n```";
    const res = detectFileDeliverableIntent("give me a report", pythonCode);
    expect(res.hasCodeGenerator).toBe(true);
    expect(res.detectedCodeType).toBe("pdf");
  });

  it("extracts document content from python script with strings", () => {
    const pythonCode = "```python\nfrom fpdf import FPDF\npdf = FPDF()\npdf.cell(200, 10, 'Overview of Quantum Computing', ln=1)\n```";
    const extracted = extractTextForDocument(pythonCode, "give me a pdf about quantum computing", "pdf");
    expect(extracted.content).toContain("Quantum Computing");
  });

  it("compiles and delivers a real binary PDF with direct download link", async () => {
    const userPrompt = "Give me a pdf of a summary of renewable energy";
    const assistantContent = "# Renewable Energy Overview\n\nSolar and wind power are key components of sustainable energy.\n\n## Advantages\n- Clean emissions\n- Infinite source";

    const deliverable = await compileAndDeliverFile({
      userPrompt,
      assistantContent,
    });

    expect(deliverable).not.toBeNull();
    expect(deliverable?.hasDeliverable).toBe(true);
    expect(deliverable?.fileType).toBe("pdf");
    expect(deliverable?.fileName.endsWith(".pdf")).toBe(true);
    expect(deliverable?.fileUrl.startsWith("/downloads/")).toBe(true);
    expect(deliverable?.size).toBeGreaterThan(100);
    expect(deliverable?.downloadCardMarkdown).toContain("Deliverable Ready for Download");
    expect(deliverable?.downloadCardMarkdown).toContain(deliverable?.fileUrl);

    if (deliverable) {
      createdFiles.push(deliverable.fileName);
      const filePath = path.join(process.cwd(), "public", "downloads", deliverable.fileName);
      const fileBuf = await fs.readFile(filePath);
      expect(fileBuf.toString("utf-8").startsWith("%PDF-1.4")).toBe(true);
    }
  });

  it("cleans python code when assistant only provided script, delivering real file", async () => {
    const userPrompt = "give me a pdf about space";
    const assistantContent = "Here is the code to make it:\n```python\nfrom fpdf import FPDF\npdf = FPDF()\npdf.cell(200, 10, 'Exploration of Mars and Beyond', ln=1)\n```";

    const deliverable = await compileAndDeliverFile({
      userPrompt,
      assistantContent,
    });

    expect(deliverable).not.toBeNull();
    expect(deliverable?.cleanedContent).toContain("Download");
    expect(deliverable?.cleanedContent).not.toContain("from fpdf import FPDF");

    if (deliverable) {
      createdFiles.push(deliverable.fileName);
    }
  });
});
