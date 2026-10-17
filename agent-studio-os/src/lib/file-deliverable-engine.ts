import path from "path";
import { saveDocumentFile, generateSimplePdf } from "./document-generator";

export interface FileDeliverableResult {
  hasDeliverable: boolean;
  fileName: string;
  fileUrl: string;
  fileType: "pdf" | "doc" | "csv" | "json" | "md" | "txt" | "html" | "code";
  size: number;
  downloadCardMarkdown: string;
  cleanedContent?: string;
}

/**
 * Detects if the user requested a file deliverable (PDF, Word, CSV, etc.)
 * or if the assistant outputted Python/script code intended to generate a file.
 */
export function detectFileDeliverableIntent(
  userPrompt: string,
  assistantContent: string = ""
): {
  isRequested: boolean;
  requestedType: "pdf" | "doc" | "csv" | "json" | "md" | "txt" | "html" | "code" | null;
  hasCodeGenerator: boolean;
  detectedCodeType: "pdf" | "doc" | "csv" | "json" | null;
} {
  const pLower = (userPrompt || "").toLowerCase();
  const cLower = (assistantContent || "").toLowerCase();

  // 1. Detect user prompt intent
  let requestedType: "pdf" | "doc" | "csv" | "json" | "md" | "txt" | "html" | "code" | null = null;

  if (
    /\b(pdf|portable document)\b/i.test(pLower) ||
    /\b(give me a|generate a|create a|export as|download a|save as|send me a|make a)\s+(?:.*?)(?:pdf|pdf file)\b/i.test(pLower)
  ) {
    requestedType = "pdf";
  } else if (
    /\b(word doc|word document|\.docx?|ms word|word format)\b/i.test(pLower) ||
    /\b(give me a|generate a|create a|export as)\s+(?:.*?)(?:word doc|doc file|docx)\b/i.test(pLower)
  ) {
    requestedType = "doc";
  } else if (
    /\b(csv|spreadsheet|excel|\.xlsx?|comma-separated|dataset)\b/i.test(pLower) ||
    /\b(give me a|generate a|create a|export as)\s+(?:.*?)(?:csv|spreadsheet|excel sheet)\b/i.test(pLower)
  ) {
    requestedType = "csv";
  } else if (
    /\b(json file|json dataset|\.json)\b/i.test(pLower)
  ) {
    requestedType = "json";
  } else if (
    /\b(markdown file|\.md file)\b/i.test(pLower)
  ) {
    requestedType = "md";
  } else if (
    /\b(html file|\.html file|web page file)\b/i.test(pLower)
  ) {
    requestedType = "html";
  }

  // 2. Detect if the assistant generated code to create a file instead of the file itself
  let hasCodeGenerator = false;
  let detectedCodeType: "pdf" | "doc" | "csv" | "json" | null = null;

  const hasPythonPdfCode =
    /```(?:python|py)?[\s\S]*?(?:reportlab|fpdf|FPDF|canvas\.Canvas|SimpleDocTemplate|pdfkit|weasyprint|PyPDF2|pypdf|fitz|fitz\.open)[\s\S]*?```/i.test(
      assistantContent
    ) ||
    /from\s+(?:reportlab|fpdf)\s+import/i.test(assistantContent) ||
    /import\s+(?:reportlab|fpdf|pdfkit|weasyprint)/i.test(assistantContent);

  const hasPythonCsvCode =
    /```(?:python|py)?[\s\S]*?(?:pandas.*?to_csv|csv\.writer|csv\.DictWriter)[\s\S]*?```/i.test(
      assistantContent
    ) && requestedType === "csv";

  const hasPythonDocCode =
    /```(?:python|py)?[\s\S]*?(?:docx|python-docx|Document\(\))[\s\S]*?```/i.test(
      assistantContent
    );

  if (hasPythonPdfCode) {
    hasCodeGenerator = true;
    detectedCodeType = "pdf";
    if (!requestedType) requestedType = "pdf";
  } else if (hasPythonCsvCode) {
    hasCodeGenerator = true;
    detectedCodeType = "csv";
    if (!requestedType) requestedType = "csv";
  } else if (hasPythonDocCode) {
    hasCodeGenerator = true;
    detectedCodeType = "doc";
    if (!requestedType) requestedType = "doc";
  }

  const isRequested = requestedType !== null;

  return {
    isRequested,
    requestedType,
    hasCodeGenerator,
    detectedCodeType,
  };
}

/**
 * Extracts rich text and structure from assistant response,
 * even if the assistant wrapped text inside Python code or string literals.
 */
export function extractTextForDocument(
  assistantContent: string,
  userPrompt: string,
  targetType: "pdf" | "doc" | "csv" | "json" | "md" | "txt" | "html" | "code"
): { title: string; content: string } {
  // Derive a sensible title from the prompt
  let title = "Document";
  const promptClean = userPrompt
    .replace(/^(can you|please|give me a|generate a|create a|make a|write a|export as|download a)\s+/i, "")
    .replace(/\b(pdf|doc|document|file|spreadsheet|csv)\b/gi, "")
    .replace(/[^\w\s-]/g, "")
    .trim();

  if (promptClean.length > 2) {
    title = promptClean
      .split(/\s+/)
      .slice(0, 5)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  // If target is CSV, check for CSV blocks or tables
  if (targetType === "csv") {
    const csvMatch = assistantContent.match(/```(?:csv)?\n([\s\S]*?)```/);
    if (csvMatch && csvMatch[1].includes(",")) {
      return { title, content: csvMatch[1].trim() };
    }
    // Check for markdown table and convert to CSV
    const tableLines = assistantContent.split("\n").filter((l) => l.trim().startsWith("|") && l.trim().endsWith("|"));
    if (tableLines.length >= 2) {
      const csvRows = tableLines
        .filter((l) => !l.includes("---"))
        .map((l) =>
          l
            .slice(1, -1)
            .split("|")
            .map((c) => `"${c.trim().replace(/"/g, '""')}"`)
            .join(",")
        );
      return { title, content: csvRows.join("\n") };
    }
  }

  // Check if content is primarily a Python script (e.g. from reportlab or fpdf)
  const isPythonPdfScript =
    /from\s+(?:reportlab|fpdf)\s+import/i.test(assistantContent) ||
    /import\s+(?:reportlab|fpdf)/i.test(assistantContent);

  if (isPythonPdfScript) {
    // Extract textual content from outside the code block first
    const outsideText = assistantContent
      .replace(/```(?:python|py)?[\s\S]*?```/gi, "")
      .trim();

    // Extract string literals from inside the python script (paragraphs, headings, stories)
    const stringMatches: string[] = [];
    const strRegex = /(?:drawString|cell|multi_cell|Paragraph|write|text)\s*\([^)]*?["']([^"']{8,})["']/g;
    let match;
    while ((match = strRegex.exec(assistantContent)) !== null) {
      stringMatches.push(match[1]);
    }

    let combined = "";
    if (outsideText.length > 50) {
      combined = outsideText;
    } else if (stringMatches.length > 0) {
      combined = `# ${title}\n\n` + stringMatches.join("\n\n");
    } else {
      // Fallback: extract any multi-line triple quoted strings inside the python code
      const tripleMatches = assistantContent.match(/"""([\s\S]*?)"""|'''([\s\S]*?)'''/g);
      if (tripleMatches && tripleMatches.length > 0) {
        combined = tripleMatches.map((t) => t.replace(/['"]{3}/g, "").trim()).join("\n\n");
      } else {
        combined = `# ${title}\n\n${userPrompt}\n\nGenerated comprehensive document based on user request.`;
      }
    }

    return { title, content: combined };
  }

  // Standard case: clean up tool tokens and use assistant text
  const cleanContent = assistantContent
    .replace(/<\|tool_call[_:](?:start|begin)\|?>[\s\S]*?<\|tool_call[_:](?:end|finish)\|?>/gi, "")
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "")
    .replace(/```(?:python|py)?\s*(?:#.*?)?(?:reportlab|fpdf)[\s\S]*?```/gi, "")
    .trim();

  // If there's already a markdown title #, extract it
  const headingMatch = cleanContent.match(/^#\s+(.+)$/m);
  if (headingMatch && headingMatch[1]) {
    title = headingMatch[1].trim();
  }

  return { title, content: cleanContent || `# ${title}\n\n${userPrompt}` };
}

/**
 * Automatically compiles and saves a real binary file deliverable
 * and returns download metadata + markdown card.
 */
export async function compileAndDeliverFile(options: {
  userPrompt: string;
  assistantContent: string;
  preferredType?: "pdf" | "doc" | "csv" | "json" | "md" | "txt" | "html" | "code" | null;
  explicitFileName?: string;
}): Promise<FileDeliverableResult | null> {
  const { userPrompt, assistantContent, preferredType, explicitFileName } = options;

  const intent = detectFileDeliverableIntent(userPrompt, assistantContent);
  const targetType = preferredType || intent.requestedType || intent.detectedCodeType;

  if (!targetType) return null;

  const { title, content } = extractTextForDocument(assistantContent, userPrompt, targetType);

  // Generate safe filename
  let baseName = explicitFileName || title.toLowerCase().replace(/[^a-z0-9_-]+/g, "_").slice(0, 32);
  if (!baseName.endsWith(`.${targetType}`)) {
    baseName += `.${targetType === "doc" ? "doc" : targetType}`;
  }

  // Compile and save via document generator
  const saved = await saveDocumentFile(baseName, content);

  const extUpper = path.extname(saved.fileName).replace(".", "").toUpperCase();
  const formatName =
    extUpper === "PDF"
      ? "Portable Document Format (PDF)"
      : extUpper === "DOC" || extUpper === "DOCX"
      ? "Microsoft Word Document (.doc)"
      : extUpper === "CSV"
      ? "CSV Spreadsheet / Dataset (.csv)"
      : `${extUpper} Document`;

  const sizeKb = (saved.size / 1024).toFixed(1);

  const downloadCardMarkdown = `\n\n### 📄 Deliverable Ready for Download\n\n- **File**: \`${saved.fileName}\`\n- **Format**: **${formatName}** (${sizeKb} KB)\n- **Direct Download**: [Download ${saved.fileName}](${saved.fileUrl})\n\n> The file has been compiled and saved to your workspace download vault. Click above to view or download it directly.`;

  // If the assistant output was ONLY python code to generate the file, clean it up
  let cleanedContent = assistantContent;
  if (intent.hasCodeGenerator) {
    const isPureCode =
      assistantContent.includes("from reportlab") ||
      assistantContent.includes("from fpdf") ||
      assistantContent.includes("import fpdf");

    if (isPureCode) {
      cleanedContent = `I have generated your **${saved.fileName}** document directly as a downloadable file!\n\n${content}\n${downloadCardMarkdown}`;
    } else {
      cleanedContent = `${assistantContent}${downloadCardMarkdown}`;
    }
  }

  return {
    hasDeliverable: true,
    fileName: saved.fileName,
    fileUrl: saved.fileUrl,
    fileType: targetType,
    size: saved.size,
    downloadCardMarkdown,
    cleanedContent,
  };
}
