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
        <div className="w-10 h-10 mx-auto rounded-md flex items-center justify-center text-muted-foreground border border-transparent">
          <Sun className="w-4 h-4 text-primary" />
        </div>
      );
    }
    return (
      <div className="w-full space-y-1.5">
        <div className="flex items-center justify-between px-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">
          <span>Appearance</span>
          <span className="font-mono text-[9px] text-muted-foreground capitalize">light</span>
        </div>
        <div className="relative flex items-center p-0.5 rounded-md bg-muted border border-border">
          {options.map((opt) => (
            <div
              key={opt.id}
              className={`relative flex-1 flex items-center justify-center gap-1.5 py-1 rounded-sm text-xs font-medium ${
                opt.id === "light" ? "text-foreground font-semibold" : "text-muted-foreground"
              }`}
            >
              {opt.id === "light" && (
                <div className="absolute inset-0 rounded-sm bg-card border border-border -z-10 shadow-2xs" />
              )}
              <opt.icon className={`w-3.5 h-3.5 ${opt.id === "light" ? "text-primary" : "text-muted-foreground"}`} />
              <span className="text-[11px]">{opt.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Collapsed sidebar: compact icon-only cycle button
  if (collapsed) {
    const activeOption = options.find((o) => o.id === theme) ?? options[1];
    const Icon = activeOption.icon;
    return (
      <button
        onClick={toggleTheme}
        title={`Theme: ${activeOption.label} — click to cycle`}
        className="w-10 h-10 mx-auto flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer border border-transparent hover:border-border"
      >
        <Icon
          className={`w-4 h-4 transition-colors ${
            theme === "light"
              ? "text-amber-500"
              : theme === "dark"
              ? "text-primary"
              : "text-foreground"
          }`}
        />
      </button>
    );
  }

  // Expanded sidebar: full three-option pill selector
  return (
    <div className="w-full space-y-1.5">
      <div className="flex items-center justify-between px-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">
        <span>Appearance</span>
        <span className="font-mono text-[9px] text-muted-foreground capitalize">
          {resolvedTheme}
        </span>
      </div>

      <div className="relative flex items-center p-0.5 rounded-md bg-muted border border-border">
        {options.map((opt) => {
          const isActive = theme === opt.id;
          const Icon = opt.icon;

          return (
            <button
              key={opt.id}
              onClick={() => setTheme(opt.id)}
              className={`relative flex-1 flex items-center justify-center gap-1.5 py-1 rounded-sm text-xs font-medium transition-colors z-10 cursor-pointer ${
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
                  className="absolute inset-0 rounded-sm bg-card border border-border -z-10 shadow-2xs"
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
