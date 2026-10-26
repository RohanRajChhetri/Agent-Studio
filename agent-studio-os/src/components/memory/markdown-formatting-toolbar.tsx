"use client";

import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  Code,
  FileCode,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Link as LinkIcon,
  Minus,
  Table as TableIcon,
} from "lucide-react";
import { playClickSound } from "@/lib/sound-effects";

interface MarkdownFormattingToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  content: string;
  onChange: (newContent: string) => void;
}

export function MarkdownFormattingToolbar({
  textareaRef,
  content,
  onChange,
}: MarkdownFormattingToolbarProps) {
  const insertFormatting = (
    prefix: string,
    suffix: string = "",
    defaultText: string = ""
  ) => {
    playClickSound();
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end) || defaultText;

    const before = content.substring(0, start);
    const after = content.substring(end);

    const replacement = `${prefix}${selectedText}${suffix}`;
    const newContent = `${before}${replacement}${after}`;

    onChange(newContent);

    // Re-focus and set selection
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + prefix.length + selectedText.length;
      textarea.setSelectionRange(
        start + prefix.length,
        newCursorPos
      );
    }, 10);
  };

  const insertLinePrefix = (prefix: string) => {
    playClickSound();
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const before = content.substring(0, start);
    const after = content.substring(start);

    // If not at beginning of line, prepend newline
    const needsNewline = before.length > 0 && !before.endsWith("\n");
    const insertion = needsNewline ? `\n${prefix}` : prefix;

    const newContent = `${before}${insertion}${after}`;
    onChange(newContent);

    setTimeout(() => {
      textarea.focus();
      const pos = start + insertion.length;
      textarea.setSelectionRange(pos, pos);
    }, 10);
  };

  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const chars = content.length;
  const readingTimeMin = Math.max(1, Math.ceil(words / 200));

  return (
    <div className="flex flex-wrap items-center justify-between gap-1.5 px-3 py-1.5 border-b border-border bg-secondary/30 text-xs">
      <div className="flex flex-wrap items-center gap-0.5">
        <button
          type="button"
          onClick={() => insertFormatting("**", "**", "bold text")}
          title="Bold (Ctrl+B)"
          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => insertFormatting("*", "*", "italic text")}
          title="Italic (Ctrl+I)"
          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => insertFormatting("~~", "~~", "strikethrough text")}
          title="Strikethrough"
          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <Strikethrough className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-px bg-border mx-1" />

        <button
          type="button"
          onClick={() => insertLinePrefix("# ")}
          title="Heading 1"
          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <Heading1 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => insertLinePrefix("## ")}
          title="Heading 2"
          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <Heading2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => insertLinePrefix("### ")}
          title="Heading 3"
          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <Heading3 className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-px bg-border mx-1" />

        <button
          type="button"
          onClick={() => insertFormatting("`", "`", "code")}
          title="Inline Code"
          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <Code className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => insertFormatting("```typescript\n", "\n```\n", "// your code here")}
          title="Code Block"
          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <FileCode className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => insertLinePrefix("> ")}
          title="Quote"
          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <Quote className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-px bg-border mx-1" />

        <button
          type="button"
          onClick={() => insertLinePrefix("- ")}
          title="Bullet List"
          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <List className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => insertLinePrefix("1. ")}
          title="Numbered List"
          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => insertLinePrefix("- [ ] ")}
          title="Task Checklist"
          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <CheckSquare className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-px bg-border mx-1" />

        <button
          type="button"
          onClick={() => insertFormatting("[", "](https://)", "link text")}
          title="Insert Link"
          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <LinkIcon className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => insertLinePrefix("\n---\n")}
          title="Horizontal Rule"
          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() =>
            insertLinePrefix(
              "\n| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |\n"
            )
          }
          title="Insert Table"
          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <TableIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Real-time word / char / reading counter */}
      <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground select-none shrink-0 pr-1">
        <span>{words} words</span>
        <span>•</span>
        <span>{chars} chars</span>
        <span>•</span>
        <span>~{readingTimeMin} min read</span>
      </div>
    </div>
  );
}
