"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sun, Moon, Laptop } from "lucide-react";
import { useTheme, type Theme } from "./theme-provider";

export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const options: Array<{ id: Theme; label: string; icon: typeof Sun }> = [
    { id: "light", label: "Light", icon: Sun },
    { id: "dark", label: "Dark", icon: Moon },
    { id: "system", label: "Auto", icon: Laptop },
  ];

  if (!mounted) {
    if (collapsed) {
      return (
        <div className="w-10 h-10 mx-auto rounded-xl flex items-center justify-center text-muted-foreground border border-transparent">
          <Moon className="w-4 h-4 text-primary" />
        </div>
      );
    }
    return (
      <div className="w-full space-y-1.5">
        <div className="flex items-center justify-between px-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          <span>Appearance</span>
          <span className="font-mono text-[9px] text-muted-foreground capitalize">dark</span>
        </div>
        <div className="relative flex items-center p-1 rounded-xl bg-muted/80 border border-border">
          {options.map((opt) => (
            <div
              key={opt.id}
              className={`relative flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium ${
                opt.id === "dark" ? "text-foreground font-semibold" : "text-muted-foreground"
              }`}
            >
              {opt.id === "dark" && (
                <div className="absolute inset-0 rounded-lg bg-card border border-border shadow-sm -z-10" />
              )}
              <opt.icon className={`w-3.5 h-3.5 ${opt.id === "dark" ? "text-primary" : "text-muted-foreground"}`} />
              <span className="text-[11px]">{opt.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-1.5">
      <div className="flex items-center justify-between px-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        <span>Appearance</span>
        <span className="font-mono text-[9px] text-muted-foreground capitalize">
          {resolvedTheme}
        </span>
      </div>

      <div className="relative flex items-center p-1 rounded-xl bg-muted/80 border border-border">
        {options.map((opt) => {
          const isActive = theme === opt.id;
          const Icon = opt.icon;

          return (
            <button
              key={opt.id}
              onClick={() => setTheme(opt.id)}
              className={`relative flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors z-10 cursor-pointer ${
                isActive
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title={`Switch to ${opt.label} mode`}
            >
              {isActive && (
                <motion.div
                  layoutId="active-theme-pill"
                  transition={{ type: "spring", stiffness: 450, damping: 35 }}
                  className="absolute inset-0 rounded-lg bg-card border border-border shadow-sm -z-10"
                />
              )}

              <Icon
                className={`w-3.5 h-3.5 transition-colors ${
                  isActive
                    ? opt.id === "light"
                      ? "text-amber-500"
                      : opt.id === "dark"
                      ? "text-primary"
                      : "text-foreground"
                    : "text-muted-foreground"
                }`}
              />
              <span className="text-[11px]">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
