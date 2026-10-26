"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Trash2, X, Loader2, Info } from "lucide-react";

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info" | "primary";
  loading?: boolean;
  itemTitle?: string;
  dangerDetails?: string;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  loading = false,
  itemTitle,
  dangerDetails,
}: ConfirmModalProps) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  // Focus confirm button when opened, handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, loading, onClose]);

  const variantStyles = {
    danger: {
      badge: "bg-destructive/10 border-destructive/20 text-destructive",
      icon: <Trash2 className="w-5 h-5" />,
      button:
        "bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-md shadow-destructive/20",
    },
    warning: {
      badge: "bg-amber-500/10 border-amber-500/20 text-amber-500",
      icon: <AlertTriangle className="w-5 h-5" />,
      button:
        "bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20",
    },
    info: {
      badge: "bg-sky-500/10 border-sky-500/20 text-sky-500",
      icon: <Info className="w-5 h-5" />,
      button:
        "bg-sky-600 hover:bg-sky-700 text-white shadow-md shadow-sky-600/20",
    },
    primary: {
      badge: "bg-primary/10 border-primary/20 text-primary",
      icon: <Info className="w-5 h-5" />,
      button:
        "bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20",
    },
  }[variant];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0"
            onClick={() => {
              if (!loading) onClose();
            }}
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 z-10 text-card-foreground"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${variantStyles.badge}`}
                >
                  {variantStyles.icon}
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-foreground tracking-tight">
                    {title}
                  </h3>
                  {description && (
                    <div className="text-xs text-muted-foreground leading-relaxed">
                      {description}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition cursor-pointer disabled:opacity-50"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {itemTitle && (
              <div className="p-3 rounded-xl bg-secondary/50 border border-border/80 flex items-center gap-2.5 text-xs text-foreground">
                <span className="font-semibold text-muted-foreground shrink-0">Target:</span>
                <span className="font-medium truncate text-foreground">{itemTitle}</span>
              </div>
            )}

            {dangerDetails && (
              <div className="p-2.5 rounded-xl bg-destructive/5 border border-destructive/15 text-[11px] text-muted-foreground flex items-start gap-2 leading-relaxed">
                <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                <span>{dangerDetails}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                disabled={loading}
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition cursor-pointer disabled:opacity-50"
              >
                {cancelText}
              </button>
              <button
                ref={confirmBtnRef}
                type="button"
                disabled={loading}
                onClick={onConfirm}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 ${variantStyles.button}`}
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{loading ? "Processing..." : confirmText}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
