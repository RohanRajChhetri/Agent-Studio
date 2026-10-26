"use client";

import React, { useState } from "react";
import Link from "next/link";
import { BookOpen, Check, Copy, ExternalLink, Info, AlertTriangle, Lightbulb, Download, FileText, FileSpreadsheet, FileCode } from "lucide-react";

interface MarkdownRendererProps {
  content: string;
  isUser?: boolean;
  className?: string;
}

/** Sleek, glassmorphic code block with copy button and language badge */
function CodeBlockView({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayLang = language?.trim() || "code";

  return (
    <div className="my-2.5 overflow-hidden rounded-xl border border-border/80 bg-zinc-950/95 dark:bg-zinc-950 text-zinc-100 shadow-md">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-zinc-900/90 border-b border-white/5 text-[11px] font-mono text-zinc-400">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500/70 inline-block" />
            <span className="w-2 h-2 rounded-full bg-amber-500/70 inline-block" />
            <span className="w-2 h-2 rounded-full bg-emerald-500/70 inline-block" />
          </div>
          <span className="ml-1 text-[10.5px] uppercase tracking-wider text-zinc-400 font-semibold">{displayLang}</span>
        </div>
        <button
          onClick={handleCopy}
          type="button"
          className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] hover:bg-white/10 text-zinc-400 hover:text-white transition-all active:scale-95 cursor-pointer"
          title="Copy code to clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="p-3.5 overflow-x-auto max-w-full text-[11.5px] font-mono leading-relaxed text-zinc-200">
        <pre className="m-0 font-mono whitespace-pre overflow-x-auto max-w-full">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

/** Callout block for blockquotes with [!NOTE], [!TIP], [!WARNING], etc. */
function CalloutBlock({ type, content, isUser }: { type: string; content: string; isUser: boolean }) {
  const isTip = type === "TIP";
  const isWarning = type === "WARNING" || type === "CAUTION";

  return (
    <div
      className={`my-2.5 p-3 rounded-xl border text-xs leading-relaxed ${
        isTip
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200"
          : isWarning
          ? "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-200"
          : "border-primary/30 bg-primary/10 text-foreground"
      }`}
    >
      <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10.5px] mb-1 opacity-90">
        {isTip ? (
          <Lightbulb className="w-3.5 h-3.5 text-emerald-500" />
        ) : isWarning ? (
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
        ) : (
          <Info className="w-3.5 h-3.5 text-primary" />
        )}
        <span>{type}</span>
      </div>
      <div>{renderInlineFormatting(content, isUser)}</div>
    </div>
  );
}

function sanitizeToolCallContent(text: string): string {
  if (!text) return "";

  // Check if content contains file.create or write_file calls
  const fileMatch = text.match(/(?:file\.create|file\.write|write_file|create_file|save_file)\s*\(([\s\S]*?)\)/);
  if (fileMatch) {
    const argsStr = fileMatch[1];
    const pathMatch = argsStr.match(/(?:path|filename|file)\s*=\s*['"]([^'"]+)['"]/i);
    const fileName = pathMatch ? pathMatch[1] : "document.doc";

    const contentStartMatch = argsStr.match(/content\s*=\s*(['"])/);
    if (contentStartMatch && contentStartMatch.index !== undefined) {
      const quoteChar = contentStartMatch[1];
      const startIndex = contentStartMatch.index + contentStartMatch[0].length;
      const pathIdx = argsStr.search(/,\s*(?:path|filename|file)\s*=/i);
      let body = pathIdx !== -1 && pathIdx > startIndex
        ? argsStr.slice(startIndex, pathIdx).trim()
        : argsStr.slice(startIndex).trim();
      if (body.endsWith(quoteChar)) body = body.slice(0, -1);
      const unescaped = body
        .replace(/\\r\\n/g, "\n")
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, "\t")
        .replace(/\\'/g, "'")
        .replace(/\\"/g, '"');

      return `${unescaped}\n\n### Deliverable Ready for Download\n\n- **File**: \`${fileName}\`\n- **Direct Download**: [Download ${fileName}](/downloads/${encodeURIComponent(fileName)})\n\n> You can open this file directly in Microsoft Word, Google Docs, or any text editor.`;
    }
  }

  // Strip or transform general tool call tokens
  if (text.includes("<|tool_call") || text.includes("<tool_call>")) {
    return text
      .replace(/<\|tool_call[_:](?:start|begin)\|?>[\s\S]*?<\|tool_call[_:](?:end|finish)\|?>/gi, "")
      .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "")
      .trim();
  }

  return text;
}

/**
 * High-performance, zero-dependency Markdown Renderer for Chat Studio.
 * Formats raw markdown headers, bold, italics, lists, tables, blockquotes,
 * code blocks, inline code, links, and Obsidian [[wiki-links]] into beautiful typography.
 * Strips unsightly dividers ("---") and YAML frontmatter.
 */
export function MarkdownRenderer({ content, isUser = false, className }: MarkdownRendererProps) {
  if (!content) return null;

  // 1. Strip leading YAML frontmatter if present (e.g., Obsidian notes / task files)
  let cleanContent = content;
  if (cleanContent.startsWith("---")) {
    cleanContent = cleanContent.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  }

  // 2. Pre-process tool calls (e.g., file.create, <|tool_call...|>) into structured markdown & deliverables
  if (
    cleanContent.includes("<|tool_call") ||
    cleanContent.includes("<tool_call>") ||
    cleanContent.includes("file.create(") ||
    cleanContent.includes("write_file(")
  ) {
    cleanContent = sanitizeToolCallContent(cleanContent);
  }

  // Split content into blocks (paragraphs, headers, tables, lists, quotes, code)
  const lines = cleanContent.split(/\r?\n/);
  const elements: React.ReactNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Empty lines
    if (!trimmed) {
      elements.push(<div key={`empty-${i}`} className="h-1.5" />);
      i++;
      continue;
    }

    // 2. Filter out raw divider lines ('---', '***', '___', or repetitive dashes/underscores)
    // This removes literal "---" that agents often output, keeping formatting clean and uncluttered.
    if (/^([-*_])\1{2,}$/.test(trimmed)) {
      i++;
      continue;
    }

    // 3. Fenced Code Blocks (```language ... ```)
    if (trimmed.startsWith("```")) {
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim().startsWith("```")) {
        i++; // skip closing ```
      }
      elements.push(
        <CodeBlockView
          key={`codeblock-${i}`}
          code={codeLines.join("\n")}
          language={language}
        />
      );
      continue;
    }

    // 4. Markdown Tables
    if (trimmed.startsWith("|") && trimmed.endsWith("|") && i + 1 < lines.length && lines[i + 1].trim().startsWith("|") && lines[i + 1].includes("---")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const headerRow = tableLines[0]
          .slice(1, -1)
          .split("|")
          .map((c) => c.trim());
        const bodyRows = tableLines.slice(2).map((row) =>
          row
            .slice(1, -1)
            .split("|")
            .map((c) => c.trim())
        );

        elements.push(
          <div
            key={`table-${i}`}
            className="my-3 overflow-x-auto rounded-xl border border-border bg-card/70 backdrop-blur-xl shadow-xs"
          >
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-secondary/80 border-b border-border text-[10.5px] uppercase font-semibold text-muted-foreground">
                <tr>
                  {headerRow.map((cell, cIdx) => (
                    <th key={cIdx} className="px-3.5 py-2.5 border-r border-border last:border-r-0">
                      {renderInlineFormatting(cell, isUser)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {bodyRows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    className="hover:bg-secondary/50 transition-colors"
                  >
                    {row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        className="px-3.5 py-2 border-r border-border last:border-r-0 leading-relaxed"
                      >
                        {renderInlineFormatting(cell, isUser)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // 5. Headers
    if (trimmed.startsWith("#### ")) {
      elements.push(
        <h4 key={`h4-${i}`} className="text-xs font-bold mt-2.5 mb-1 tracking-tight text-foreground">
          {renderInlineFormatting(trimmed.slice(5), isUser)}
        </h4>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith("### ")) {
      elements.push(
        <h3 key={`h3-${i}`} className="text-xs font-bold mt-3 mb-1 tracking-tight flex items-center gap-1.5 text-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          <span>{renderInlineFormatting(trimmed.slice(4), isUser)}</span>
        </h3>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith("## ")) {
      elements.push(
        <h2 key={`h2-${i}`} className="text-sm font-bold mt-3.5 mb-1.5 tracking-tight flex items-center gap-2 text-foreground">
          <span className="w-2 h-2 rounded-full bg-primary/90" />
          <span>{renderInlineFormatting(trimmed.slice(3), isUser)}</span>
        </h2>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith("# ")) {
      elements.push(
        <h1 key={`h1-${i}`} className="text-base font-extrabold mt-4 mb-2 pb-1 tracking-tight text-foreground">
          {renderInlineFormatting(trimmed.slice(2), isUser)}
        </h1>
      );
      i++;
      continue;
    }

    // 6. Blockquotes & Callouts
    if (trimmed.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      const quoteText = quoteLines.join("\n");
      const calloutMatch = quoteText.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*([\s\S]*)$/i);

      if (calloutMatch) {
        const type = calloutMatch[1].toUpperCase();
        const calloutBody = calloutMatch[2].trim();
        elements.push(
          <CalloutBlock
            key={`callout-${i}`}
            type={type}
            content={calloutBody}
            isUser={isUser}
          />
        );
      } else {
        elements.push(
          <blockquote
            key={`quote-${i}`}
            className="border-l-2 pl-3 py-1.5 my-2 rounded-r-lg italic text-xs leading-relaxed border-primary/70 bg-primary/5 text-foreground"
          >
            {renderInlineFormatting(quoteText, isUser)}
          </blockquote>
        );
      }
      continue;
    }

    // 7. Bullet Lists (- or * or •)
    if (/^[-*•]\s+/.test(trimmed)) {
      const listItems: string[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        listItems.push(lines[i].trim().replace(/^[-*•]\s+/, ""));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="my-1.5 space-y-1 pl-1">
          {listItems.map((item, lIdx) => (
            <li key={lIdx} className="flex items-start gap-2 text-xs leading-relaxed text-foreground">
              <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-primary/80" />
              <span className="flex-1">{renderInlineFormatting(item, isUser)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // 8. Numbered Lists (1. 2. 3.)
    if (/^\d+\.\s+/.test(trimmed)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        listItems.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="my-1.5 space-y-1 pl-1">
          {listItems.map((item, lIdx) => (
            <li key={lIdx} className="flex items-start gap-2 text-xs leading-relaxed text-foreground">
              <span className="font-mono font-bold text-[11px] shrink-0 mt-0.5 min-w-[16px] text-foreground">
                {lIdx + 1}.
              </span>
              <span className="flex-1">{renderInlineFormatting(item, isUser)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // 9. Standard Paragraph
    elements.push(
      <p key={`p-${i}`} className="my-1 text-xs leading-relaxed break-words [overflow-wrap:anywhere] text-foreground">
        {renderInlineFormatting(trimmed, isUser)}
      </p>
    );
    i++;
  }

  return <div className={className || "space-y-0.5 text-xs break-words [overflow-wrap:anywhere] max-w-full overflow-hidden text-foreground"}>{elements}</div>;
}

/**
 * Parse inline Markdown: bold (**text**), italics (*text*), inline code (`code`),
 * links ([text](url)), and Obsidian wiki-links ([[note]]).
 */
function renderInlineFormatting(text: string, isUser = false): React.ReactNode {
  if (!text) return null;

  // Regex pattern matching:
  // 1) Wiki links: [[Note Title]]
  // 2) Standard links: [Label](url)
  // 3) Inline code: `code`
  // 4) Bold: **bold**
  // 5) Italics: *italic* or _italic_
  const tokenRegex = /(\[\[.*?\]\]|\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    const token = match[0];
    const key = `inline-${match.index}`;

    if (token.startsWith("[[") && token.endsWith("]]")) {
      const noteTitle = token.slice(2, -2);
      parts.push(
        <Link
          key={key}
          href={`/memory?note=${encodeURIComponent(noteTitle)}`}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors font-mono text-[10.5px] font-medium"
          title={`View Obsidian Vault Note: [[${noteTitle}]]`}
        >
          <BookOpen className="w-2.5 h-2.5 shrink-0" />
          <span>{noteTitle}</span>
        </Link>
      );
    } else if (token.startsWith("[") && token.includes("](") && token.endsWith(")")) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const [, label, url] = linkMatch;
        const isInternal = url.startsWith("/") || url.startsWith("#");
        if (url.startsWith("/downloads/")) {
          const rawFileName = decodeURIComponent(url.replace(/^\/downloads\//, ""));
          const ext = rawFileName.split(".").pop()?.toLowerCase();
          const isPdf = ext === "pdf";
          const isDoc = ext === "doc" || ext === "docx";
          const isCsv = ext === "csv" || ext === "xlsx";
          
          parts.push(
            <a
              key={key}
              href={url}
              download={rawFileName}
              target="_blank"
              rel="noopener noreferrer"
              className={`my-2 inline-flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all duration-200 shadow-sm cursor-pointer group ${
                isPdf
                  ? "bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/20 text-rose-950 dark:text-rose-200"
                  : isDoc
                  ? "bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20 text-blue-950 dark:text-blue-200"
                  : isCsv
                  ? "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-950 dark:text-emerald-200"
                  : "bg-primary/10 border-primary/30 hover:bg-primary/20 text-foreground"
              }`}
              title={`Download ${rawFileName}`}
            >
              <span className={`p-1.5 rounded-lg flex items-center justify-center shrink-0 ${
                isPdf
                  ? "bg-rose-500/20 text-rose-500"
                  : isDoc
                  ? "bg-blue-500/20 text-blue-500"
                  : isCsv
                  ? "bg-emerald-500/20 text-emerald-500"
                  : "bg-primary/20 text-primary"
              }`}>
                <Download className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
              </span>
              <span className="flex flex-col text-left">
                <span className="font-semibold text-xs tracking-tight">
                  {label}
                </span>
                <span className="text-[9.5px] opacity-75 font-mono uppercase tracking-wider">
                  {ext ? `.${ext.toUpperCase()} Deliverable` : "File"} • Click to Download
                </span>
              </span>
            </a>
          );
        } else if (isInternal) {
          parts.push(
            <Link
              key={key}
              href={url}
              className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
            >
              {label}
            </Link>
          );
        } else {
          parts.push(
            <a
              key={key}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80 transition-colors inline-flex items-center gap-0.5"
            >
              <span>{label}</span>
              <ExternalLink className="w-2.5 h-2.5 inline opacity-70" />
            </a>
          );
        }
      } else {
        parts.push(token);
      }
    } else if (token.startsWith("`") && token.endsWith("`")) {
      const codeText = token.slice(1, -1);
      parts.push(
        <code
          key={key}
          className="px-1.5 py-0.5 mx-0.5 rounded bg-secondary/80 border border-border text-foreground font-mono text-[11px] font-semibold break-all"
        >
          {codeText}
        </code>
      );
    } else if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={key} className="font-bold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (
      (token.startsWith("*") && token.endsWith("*")) ||
      (token.startsWith("_") && token.endsWith("_"))
    ) {
      parts.push(
        <em key={key} className="italic text-foreground/85 dark:text-foreground/90">
          {token.slice(1, -1)}
        </em>
      );
    } else {
      parts.push(token);
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}
