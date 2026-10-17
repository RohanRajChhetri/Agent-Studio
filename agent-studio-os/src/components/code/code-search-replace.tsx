"use client";

import { useState, useEffect, useRef } from "react";
import { Search, ChevronDown, ChevronUp, X, Check, Replace } from "lucide-react";

interface CodeSearchReplaceProps {
  isOpen: boolean;
  onClose: () => void;
  code: string;
  onCodeChange: (newCode: string) => void;
  onHighlightMatch?: (start: number, end: number) => void;
}

export function CodeSearchReplace({
  isOpen,
  onClose,
  code,
  onCodeChange,
  onHighlightMatch,
}: CodeSearchReplaceProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [replaceTerm, setReplaceTerm] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [matches, setMatches] = useState<Array<{ start: number; end: number }>>([]);
  const [showReplace, setShowReplace] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 50);
    }
  }, [isOpen]);

  // Compute matches whenever search term, matchCase, or code changes
  useEffect(() => {
    if (!searchTerm) {
      setMatches([]);
      setCurrentMatchIndex(0);
      return;
    }

    try {
      const flags = matchCase ? "g" : "gi";
      // Escape regex special characters
      const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, flags);

      const found: Array<{ start: number; end: number }> = [];
      let match;
      while ((match = regex.exec(code)) !== null) {
        found.push({ start: match.index, end: match.index + match[0].length });
        if (!regex.global) break;
      }

      setMatches(found);
      setCurrentMatchIndex(found.length > 0 ? 0 : -1);

      if (found.length > 0 && onHighlightMatch) {
        onHighlightMatch(found[0].start, found[0].end);
      }
    } catch {
      setMatches([]);
    }
  }, [searchTerm, matchCase, code, onHighlightMatch]);

  const handleNext = () => {
    if (matches.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % matches.length;
    setCurrentMatchIndex(nextIdx);
    onHighlightMatch?.(matches[nextIdx].start, matches[nextIdx].end);
  };

  const handlePrev = () => {
    if (matches.length === 0) return;
    const prevIdx = (currentMatchIndex - 1 + matches.length) % matches.length;
    setCurrentMatchIndex(prevIdx);
    onHighlightMatch?.(matches[prevIdx].start, matches[prevIdx].end);
  };

  const handleReplaceCurrent = () => {
    if (matches.length === 0 || currentMatchIndex < 0 || currentMatchIndex >= matches.length) return;
    const m = matches[currentMatchIndex];
    const newCode = code.slice(0, m.start) + replaceTerm + code.slice(m.end);
    onCodeChange(newCode);
  };

  const handleReplaceAll = () => {
    if (matches.length === 0 || !searchTerm) return;
    const flags = matchCase ? "g" : "gi";
    const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, flags);
    const newCode = code.replace(regex, replaceTerm);
    onCodeChange(newCode);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "Enter") {
      if (e.shiftKey) {
        handlePrev();
      } else {
        handleNext();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-3 right-5 z-40 bg-[var(--card)]/95 backdrop-blur-md border border-[var(--border)] shadow-2xl rounded-xl p-2.5 w-[340px] text-[12px] flex flex-col gap-2 font-sans select-none animate-in fade-in slide-in-from-top-2 duration-150">
      {/* Search Line */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setShowReplace((prev) => !prev)}
          className={`p-1 rounded hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition cursor-pointer ${
            showReplace ? "rotate-90 text-[var(--primary)]" : ""
          }`}
          title="Toggle Replace"
        >
          <ChevronDown className="w-3.5 h-3.5 transition-transform" />
        </button>

        <div className="relative flex-1 flex items-center bg-[var(--background)] border border-[var(--border)] rounded-lg px-2 py-1">
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Find..."
            className="w-full bg-transparent text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/60 outline-none text-[12px]"
          />
          <button
            type="button"
            onClick={() => setMatchCase((prev) => !prev)}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition cursor-pointer ${
              matchCase ? "bg-[var(--primary)] text-white" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
            title="Match Case (Aa)"
          >
            Aa
          </button>
        </div>

        {/* Counter */}
        <span className="text-[10.5px] font-mono text-[var(--muted-foreground)] min-w-[50px] text-center">
          {matches.length > 0 ? `${currentMatchIndex + 1} of ${matches.length}` : searchTerm ? "0 of 0" : ""}
        </span>

        {/* Next / Prev */}
        <button
          type="button"
          onClick={handlePrev}
          disabled={matches.length === 0}
          className="p-1 rounded hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-30 cursor-pointer"
          title="Previous Match (Shift+Enter)"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={matches.length === 0}
          className="p-1 rounded hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-30 cursor-pointer"
          title="Next Match (Enter)"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>

        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
          title="Close (Esc)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Replace Line */}
      {showReplace && (
        <div className="flex items-center gap-1.5 pl-6 pt-1 border-t border-[var(--border)]/60">
          <div className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-2 py-1">
            <input
              type="text"
              value={replaceTerm}
              onChange={(e) => setReplaceTerm(e.target.value)}
              placeholder="Replace with..."
              className="w-full bg-transparent text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/60 outline-none text-[12px]"
            />
          </div>

          <button
            type="button"
            onClick={handleReplaceCurrent}
            disabled={matches.length === 0}
            className="px-2 py-1 rounded bg-[var(--muted)] hover:bg-[var(--primary)] hover:text-white text-[11px] font-medium text-[var(--foreground)] disabled:opacity-40 transition cursor-pointer"
            title="Replace current match"
          >
            Replace
          </button>
          <button
            type="button"
            onClick={handleReplaceAll}
            disabled={matches.length === 0}
            className="px-2 py-1 rounded bg-[var(--muted)] hover:bg-[var(--primary)] hover:text-white text-[11px] font-medium text-[var(--foreground)] disabled:opacity-40 transition cursor-pointer"
            title="Replace all matches"
          >
            All
          </button>
        </div>
      )}
    </div>
  );
}
