"use client";

import React from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";

interface MarkdownRendererProps {
  content: string;
  isUser?: boolean;
  className?: string;
}

/**
 * High-performance, zero-dependency Markdown Renderer for Chat Studio.
 * Formats raw markdown headers, bold, italics, lists, tables, blockquotes,
 * inline code, and Obsidian [[wiki-links]] into beautiful, human-readable typography.
 */
export function MarkdownRenderer({ content, isUser = false, className }: MarkdownRendererProps) {
  if (!content) return null;

  // Split content into blocks (paragraphs, headers, tables, lists, quotes)
  const lines = content.split(/\r?\n/);
  const elements: React.ReactNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Empty lines
    if (!trimmed) {
      elements.push(<div key={`empty-${i}`} className="h-2" />);
      i++;
      continue;
    }

    // 2. Markdown Tables
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
            className={`my-3 overflow-x-auto rounded-xl border ${
              isUser
                ? "border-white/20 bg-white/10 backdrop-blur-xl shadow-md"
                : "border-border bg-card/70 backdrop-blur-xl shadow-md"
            }`}
          >
            <table className="w-full text-xs text-left border-collapse">
              <thead className={`${isUser ? "bg-white/15 border-b border-white/20 text-[10.5px] uppercase font-semibold text-white/90" : "bg-secondary/80 border-b border-border text-[10.5px] uppercase font-semibold text-muted-foreground"}`}>
                <tr>
                  {headerRow.map((cell, cIdx) => (
                    <th key={cIdx} className={`px-3.5 py-2.5 border-r last:border-r-0 ${isUser ? "border-white/15" : "border-border"}`}>
                      {renderInlineFormatting(cell, isUser)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y ${isUser ? "divide-white/10 text-white" : "divide-white/[0.04] text-muted-foreground"}`}>
                {bodyRows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    className={isUser ? "hover:bg-white/10 transition-colors" : "hover:bg-secondary/50 transition-colors"}
                  >
                    {row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        className={`px-3.5 py-2 border-r last:border-r-0 leading-relaxed ${isUser ? "border-white/15" : "border-border"}`}
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

    // 3. Headers
    if (trimmed.startsWith("#### ")) {
      elements.push(
        <h4 key={`h4-${i}`} className={`text-xs font-bold mt-2.5 mb-1 tracking-tight ${isUser ? "text-white" : "text-foreground"}`}>
          {renderInlineFormatting(trimmed.slice(5), isUser)}
        </h4>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith("### ")) {
      elements.push(
        <h3 key={`h3-${i}`} className={`text-sm font-bold mt-3 mb-1 tracking-tight flex items-center gap-1.5 ${isUser ? "text-white" : "text-foreground"}`}>
          <span className={`w-1.5 h-1.5 rounded-md ${isUser ? "bg-white" : "bg-primary"}`} />
          <span>{renderInlineFormatting(trimmed.slice(4), isUser)}</span>
        </h3>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith("## ")) {
      elements.push(
        <h2 key={`h2-${i}`} className={`text-sm font-bold mt-3.5 mb-1.5 pb-1 border-b tracking-tight ${isUser ? "text-white border-white/20" : "text-foreground border-border"}`}>
          {renderInlineFormatting(trimmed.slice(3), isUser)}
        </h2>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith("# ")) {
      elements.push(
        <h1 key={`h1-${i}`} className={`text-base font-extrabold mt-4 mb-2 pb-1.5 border-b tracking-tight ${isUser ? "text-white border-white/20" : "text-foreground border-border"}`}>
          {renderInlineFormatting(trimmed.slice(2), isUser)}
        </h1>
      );
      i++;
      continue;
    }

    // 4. Blockquotes
    if (trimmed.startsWith("> ")) {
      elements.push(
        <blockquote
          key={`quote-${i}`}
          className={`border-l-2 px-3 py-1.5 my-2 rounded-r-lg italic text-xs leading-relaxed ${
            isUser
              ? "border-white/40 bg-white/10 text-white/90"
              : "border-primary bg-primary/5 text-muted-foreground"
          }`}
        >
          {renderInlineFormatting(trimmed.slice(2), isUser)}
        </blockquote>
      );
      i++;
      continue;
    }

    // 5. Bullet Lists (- or * or •)
    if (/^[-*•]\s+/.test(trimmed)) {
      const listItems: string[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        listItems.push(lines[i].trim().replace(/^[-*•]\s+/, ""));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="my-1.5 space-y-1 pl-1">
          {listItems.map((item, lIdx) => (
            <li key={lIdx} className={`flex items-start gap-2 text-xs leading-relaxed ${isUser ? "text-white" : "text-foreground"}`}>
              <span className={`w-1.5 h-1.5 rounded-md mt-1.5 shrink-0 ${isUser ? "bg-white/80" : "bg-primary/80"}`} />
              <span className="flex-1">{renderInlineFormatting(item, isUser)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // 6. Numbered Lists (1. 2. 3.)
    if (/^\d+\.\s+/.test(trimmed)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        listItems.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="my-1.5 space-y-1 pl-1">
          {listItems.map((item, lIdx) => (
            <li key={lIdx} className={`flex items-start gap-2 text-xs leading-relaxed ${isUser ? "text-white" : "text-foreground"}`}>
              <span className={`font-mono font-bold text-[11px] shrink-0 mt-0.5 min-w-[16px] ${isUser ? "text-white" : "text-foreground"}`}>
                {lIdx + 1}.
              </span>
              <span className="flex-1">{renderInlineFormatting(item, isUser)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // 7. Standard Paragraph
    elements.push(
      <p key={`p-${i}`} className={`my-1 text-xs leading-relaxed ${isUser ? "text-white" : "text-foreground"}`}>
        {renderInlineFormatting(trimmed, isUser)}
      </p>
    );
    i++;
  }

  return <div className={className || `space-y-0.5 text-xs ${isUser ? "text-white" : "text-foreground"}`}>{elements}</div>;
}

/**
 * Parse inline Markdown: bold (**text**), italics (*text*), inline code (`code`),
 * and Obsidian wiki-links ([[note]]).
 */
function renderInlineFormatting(text: string, isUser = false): React.ReactNode {
  if (!text) return null;

  // Regex pattern matching:
  // 1) Wiki links: [[Note Title]]
  // 2) Inline code: `code`
  // 3) Bold: **bold**
  // 4) Italics: *italic* or _italic_
  const tokenRegex = /(\[\[.*?\]\]|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g;

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
          className={
            isUser
              ? "inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md bg-white/20 text-white border border-white/30 hover:bg-white/30 transition-colors font-mono text-[10.5px] font-medium"
              : "inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors font-mono text-[10.5px] font-medium"
          }
          title={`View Obsidian Vault Note: [[${noteTitle}]]`}
        >
          <BookOpen className="w-2.5 h-2.5 shrink-0" />
          <span>{noteTitle}</span>
        </Link>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      const codeText = token.slice(1, -1);
      parts.push(
        <code
          key={key}
          className={
            isUser
              ? "px-1.5 py-0.5 mx-0.5 rounded bg-white/20 border border-white/25 text-white font-mono text-[11px] font-semibold"
              : "px-1.5 py-0.5 mx-0.5 rounded bg-secondary border border-border text-foreground font-mono text-[11px] font-semibold"
          }
        >
          {codeText}
        </code>
      );
    } else if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={key} className={`font-bold ${isUser ? "text-white" : "text-foreground"}`}>
          {token.slice(2, -2)}
        </strong>
      );
    } else if (
      (token.startsWith("*") && token.endsWith("*")) ||
      (token.startsWith("_") && token.endsWith("_"))
    ) {
      parts.push(
        <em key={key} className={`italic ${isUser ? "text-white/85" : "text-muted-foreground"}`}>
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
