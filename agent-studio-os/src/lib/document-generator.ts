import fs from "fs/promises";
import path from "path";

/**
 * Escapes characters for PDF literal strings (WinAnsi/ASCII)
 */
function escapePdfText(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E\n\r\t]/g, " "); // Replace non-ascii with spaces for standard 14 font compatibility
}

/**
 * Generates a valid standard PDF-1.4 binary buffer from text / markdown
 */
export function generateSimplePdf(title: string, markdownContent: string): Buffer {
  const rawLines = markdownContent.split(/\r?\n/);
  const formattedLines: Array<{ text: string; isHeader: boolean; isSubHeader: boolean }> = [];

  for (const raw of rawLines) {
    const trimmed = raw.trim();
    if (!trimmed) {
      formattedLines.push({ text: "", isHeader: false, isSubHeader: false });
      continue;
    }

    if (trimmed.startsWith("# ")) {
      formattedLines.push({
        text: trimmed.replace(/^#+\s*/, ""),
        isHeader: true,
        isSubHeader: false,
      });
      continue;
    }
    if (trimmed.startsWith("## ") || trimmed.startsWith("### ")) {
      formattedLines.push({
        text: trimmed.replace(/^#+\s*/, ""),
        isHeader: false,
        isSubHeader: true,
      });
      continue;
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("• ")) {
      const cleanBullet = trimmed.replace(/^[-*•]\s*/, "").replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1");
      formattedLines.push({
        text: `  • ${cleanBullet}`,
        isHeader: false,
        isSubHeader: false,
      });
      continue;
    }

    // Word wrap body text at 78 characters
    const cleanText = trimmed.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1");
    if (cleanText.length > 78) {
      const words = cleanText.split(" ");
      let current = "";
      for (const w of words) {
        if ((current + " " + w).trim().length > 78) {
          formattedLines.push({ text: current.trim(), isHeader: false, isSubHeader: false });
          current = w;
        } else {
          current = current ? `${current} ${w}` : w;
        }
      }
      if (current) {
        formattedLines.push({ text: current.trim(), isHeader: false, isSubHeader: false });
      }
    } else {
      formattedLines.push({ text: cleanText, isHeader: false, isSubHeader: false });
    }
  }

  // Paginate into pages of max 38 visual units
  const pages: Array<Array<{ text: string; isHeader: boolean; isSubHeader: boolean }>> = [];
  let currentPage: Array<{ text: string; isHeader: boolean; isSubHeader: boolean }> = [];
  let currentUnits = 0;

  for (const item of formattedLines) {
    const units = item.isHeader ? 3 : item.isSubHeader ? 2 : 1;
    if (currentUnits + units > 40 && currentPage.length > 0) {
      pages.push(currentPage);
      currentPage = [];
      currentUnits = 0;
    }
    currentPage.push(item);
    currentUnits += units;
  }
  if (currentPage.length > 0) {
    pages.push(currentPage);
  }
  if (pages.length === 0) {
    pages.push([{ text: title, isHeader: true, isSubHeader: false }]);
  }

  const catalogId = 1;
  const pagesId = 2;
  const fontRegularId = 3;
  const fontBoldId = 4;

  let currentId = 5;
  const pageStreamIds: Array<{ pageId: number; streamId: number; content: string }> = [];
  const pageObjIds: number[] = [];

  for (const pageItems of pages) {
    const pageId = currentId++;
    const streamId = currentId++;
    pageObjIds.push(pageId);

    let stream = "BT\n";
    let y = 740;

    for (const item of pageItems) {
      if (item.isHeader) {
        stream += `/F2 16 Tf\n50 ${y} Td\n(${escapePdfText(item.text)}) Tj\nET\nBT\n`;
        y -= 26;
      } else if (item.isSubHeader) {
        stream += `/F2 12 Tf\n50 ${y} Td\n(${escapePdfText(item.text)}) Tj\nET\nBT\n`;
        y -= 20;
      } else if (item.text === "") {
        y -= 10;
      } else {
        stream += `/F1 10 Tf\n50 ${y} Td\n(${escapePdfText(item.text)}) Tj\nET\nBT\n`;
        y -= 15;
      }
    }
    stream += "ET";
    pageStreamIds.push({ pageId, streamId, content: stream });
  }

  const objMap: Record<number, string> = {};
  objMap[catalogId] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objMap[pagesId] = `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objMap[fontRegularId] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;
  objMap[fontBoldId] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`;

  for (const item of pageStreamIds) {
    objMap[item.pageId] = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${item.streamId} 0 R >>`;
    const streamLen = Buffer.byteLength(item.content, "utf-8");
    objMap[item.streamId] = `<< /Length ${streamLen} >>\nstream\n${item.content}\nendstream`;
  }

  let pdf = "%PDF-1.4\n";
  const offsets: Record<number, number> = {};
  const totalObjs = currentId - 1;

  for (let i = 1; i <= totalObjs; i++) {
    offsets[i] = Buffer.byteLength(pdf, "utf-8");
    pdf += `${i} 0 obj\n${objMap[i]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf-8");
  pdf += `xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= totalObjs; i++) {
    pdf += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  }
  pdf += `trailer\n<< /Size ${totalObjs + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf-8");
}

/**
 * Saves a document file (PDF, DOC, MD, CSV, TXT) into public/downloads/
 */
export async function saveDocumentFile(
  rawFileName: string,
  content: string
): Promise<{ fileName: string; fileUrl: string; size: number }> {
  const downloadDir = path.join(process.cwd(), "public", "downloads");
  await fs.mkdir(downloadDir, { recursive: true });

  let safeName = path.basename(rawFileName || "document.doc").replace(/[<>:"/\\|?*]+/g, "_");
  if (!path.extname(safeName)) {
    safeName += ".doc";
  }

  const targetPath = path.join(downloadDir, safeName);
  let fileBuffer: Buffer;

  if (safeName.toLowerCase().endsWith(".pdf")) {
    fileBuffer = generateSimplePdf(safeName, content);
  } else if (safeName.toLowerCase().endsWith(".doc") || safeName.toLowerCase().endsWith(".docx")) {
    // Generate standard Word HTML document with proper styles
    const htmlDoc = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset='utf-8'>
<title>${safeName}</title>
<style>
  body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.6; color: #1f2937; margin: 40px; }
  h1 { font-size: 20pt; color: #1e3a8a; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; margin-top: 24px; }
  h2 { font-size: 14pt; color: #1e40af; margin-top: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  h3 { font-size: 12pt; color: #2563eb; margin-top: 14px; }
  p { margin: 8px 0; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; }
  th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
  th { background-color: #f1f5f9; font-weight: bold; }
  blockquote { border-left: 4px solid #3b82f6; margin: 12px 0; padding-left: 16px; color: #475569; }
</style>
</head>
<body>
${content
  .replace(/\n\n/g, "</p><p>")
  .replace(/^# (.*$)/gim, "<h1>$1</h1>")
  .replace(/^## (.*$)/gim, "<h2>$1</h2>")
  .replace(/^### (.*$)/gim, "<h3>$1</h3>")
  .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
  .replace(/\*(.*?)\*/g, "<em>$1</em>")}
</body>
</html>`;
    fileBuffer = Buffer.from(htmlDoc, "utf-8");
  } else {
    fileBuffer = Buffer.from(content, "utf-8");
  }

  await fs.writeFile(targetPath, fileBuffer);

  return {
    fileName: safeName,
    fileUrl: `/downloads/${encodeURIComponent(safeName)}`,
    size: fileBuffer.length,
  };
}

/**
 * Lists all existing files in public/downloads/ sorted by newest first
 */
export async function listDownloadedFiles(): Promise<
  Array<{ fileName: string; fileUrl: string; size: number; mtime: Date }>
> {
  const downloadDir = path.join(process.cwd(), "public", "downloads");
  try {
    await fs.mkdir(downloadDir, { recursive: true });
    const entries = await fs.readdir(downloadDir, { withFileTypes: true });
    const files: Array<{ fileName: string; fileUrl: string; size: number; mtime: Date }> = [];

    for (const ent of entries) {
      if (ent.isFile() && !ent.name.startsWith(".")) {
        const filePath = path.join(downloadDir, ent.name);
        const stats = await fs.stat(filePath);
        files.push({
          fileName: ent.name,
          fileUrl: `/downloads/${encodeURIComponent(ent.name)}`,
          size: stats.size,
          mtime: stats.mtime,
        });
      }
    }

    files.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    return files;
  } catch (err) {
    console.warn("[Document Generator] Error listing files:", err);
    return [];
  }
}
