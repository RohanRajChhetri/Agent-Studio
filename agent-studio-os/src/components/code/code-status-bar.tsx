"use client";

import React from "react";
import { Check } from "lucide-react";

export interface CodeStatusBarProps {
  cursorPos: { line: number; col: number };
  selectionLen: number;
  currentLang: {
    icon: string;
    label: string;
  };
  wordWrap: boolean;
  fontSize: number;
  isDirty?: boolean;
  onToggleWordWrap: () => void;
  onDecreaseFontSize: () => void;
  onIncreaseFontSize: () => void;
}

export function CodeStatusBar({
  cursorPos,
  selectionLen,
  currentLang,
  wordWrap,
  fontSize,
  isDirty,
  onToggleWordWrap,
  onDecreaseFontSize,
  onIncreaseFontSize,
}: CodeStatusBarProps) {
  return (
    <div className="border-t border-[var(--border)] bg-[var(--card)] px-3 py-1 flex items-center justify-between text-[11px] font-mono text-[var(--muted-foreground)] select-none shrink-0">
      <div className="flex items-center gap-3">
        <span>
          Ln {cursorPos.line}, Col {cursorPos.col}
        </span>
        {selectionLen > 0 && <span>({selectionLen} selected)</span>}
        <span className="hidden sm:inline">Spaces: 2</span>
        <span className="hidden sm:inline">UTF-8</span>
        <span className="text-[var(--foreground)] font-medium">
          {currentLang.icon} {currentLang.label}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Word wrap toggle */}
        <button
          type="button"
          onClick={onToggleWordWrap}
          className={`hover:text-[var(--foreground)] transition cursor-pointer ${
            wordWrap ? "text-[var(--primary)] font-semibold" : ""
          }`}
          title="Toggle Word Wrap"
        >
          Wrap: {wordWrap ? "On" : "Off"}
        </button>

        {/* Font size stepper */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onDecreaseFontSize}
            className="hover:text-[var(--foreground)] transition px-1"
            title="Decrease font size"
          >
            A-
          </button>
          <span>{fontSize}px</span>
          <button
            type="button"
            onClick={onIncreaseFontSize}
            className="hover:text-[var(--foreground)] transition px-1"
            title="Increase font size"
          >
            A+
          </button>
        </div>

        {/* Dirty / Saved State */}
        <div className="flex items-center gap-1.5">
          {isDirty ? (
            <span className="flex items-center gap-1 text-amber-500 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Unsaved
            </span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-500 font-medium">
              <Check className="w-3 h-3" />
              Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
