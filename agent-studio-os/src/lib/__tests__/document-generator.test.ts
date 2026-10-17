import { describe, it, expect } from "vitest";
import { generateSimplePdf, saveDocumentFile, listDownloadedFiles } from "../document-generator";
import fs from "fs/promises";
import path from "path";

describe("Document Generator", () => {
  it("generates a valid PDF buffer with PDF-1.4 header and trailer", () => {
    const pdfBuf = generateSimplePdf("Test Document", "# Main Title\n\n## Sub Title\n\nThis is paragraph content.");
    expect(pdfBuf).toBeDefined();
    const pdfStr = pdfBuf.toString("utf-8");
    expect(pdfStr.startsWith("%PDF-1.4")).toBe(true);
    expect(pdfStr).toContain("%%EOF");
    expect(pdfStr).toContain("/Type /Catalog");
    expect(pdfStr).toContain("/Type /Pages");
  });

  it("saves a PDF document to public/downloads and returns downloadable url", async () => {
    const res = await saveDocumentFile("test_essay.pdf", "# Test Essay\n\nThis is an essay content.");
    expect(res.fileName).toBe("test_essay.pdf");
    expect(res.fileUrl).toBe("/downloads/test_essay.pdf");
    expect(res.size).toBeGreaterThan(100);

    const filePath = path.join(process.cwd(), "public", "downloads", "test_essay.pdf");
    const exists = await fs.stat(filePath);
    expect(exists.isFile()).toBe(true);
    // Cleanup test file
    await fs.unlink(filePath).catch(() => {});
  });

  it("saves a DOC document to public/downloads", async () => {
    const res = await saveDocumentFile("test_doc.doc", "# Test Title\n\nSome doc content.");
    expect(res.fileName).toBe("test_doc.doc");
    expect(res.fileUrl).toBe("/downloads/test_doc.doc");

    const filePath = path.join(process.cwd(), "public", "downloads", "test_doc.doc");
    const content = await fs.readFile(filePath, "utf-8");
    expect(content).toContain("<html");
    expect(content).toContain("Test Title");
    // Cleanup test file
    await fs.unlink(filePath).catch(() => {});
  });

  it("lists existing downloaded files", async () => {
    const files = await listDownloadedFiles();
    expect(Array.isArray(files)).toBe(true);
  });
});
