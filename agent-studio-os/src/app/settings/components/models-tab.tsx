"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Search,
  RefreshCw,
  TestTube,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Cpu,
  Eye,
  Code,
  Brain,
  Copy,
  Check,
  Radio,
} from "lucide-react";
import { toast } from "sonner";
import { formatResponseTime } from "@/lib/utils";

export interface ModelEntry {
  id: string;
  owned_by?: string;
}

interface ModelsTabProps {
  models: ModelEntry[];
  omnirouteOnline: boolean;
  onRefreshModels: () => Promise<void>;
  refreshingModels: boolean;
  onTestModel: (modelId: string) => Promise<void>;
  testingModel: string | null;
  testResults: Record<string, { success: boolean; latency: number; error?: string }>;
}

export function ModelsTab({
  models,
  omnirouteOnline,
  onRefreshModels,
  refreshingModels,
  onTestModel,
  testingModel,
  testResults,
}: ModelsTabProps) {
  const [search, setSearch] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<string>("all");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [copiedModelId, setCopiedModelId] = useState<string | null>(null);

  const handleCopyModel = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedModelId(id);
    toast.success(`Copied "${id}"`);
    setTimeout(() => setCopiedModelId(null), 2000);
  };

  // Group models by owned_by / provider
  const filteredModels = useMemo(() => {
    return models.filter((m) => {
      const matchesSearch =
        m.id.toLowerCase().includes(search.toLowerCase()) ||
        (m.owned_by && m.owned_by.toLowerCase().includes(search.toLowerCase()));

      if (!matchesSearch) return false;
      if (selectedProvider === "all") return true;

      const group = (m.owned_by || "").toLowerCase();
      const id = m.id.toLowerCase();
      if (selectedProvider === "omniroute") return group.includes("omniroute") || id.startsWith("auto/");
      if (selectedProvider === "openai") return group.includes("openai") || id.startsWith("gpt") || id.startsWith("o1") || id.startsWith("o3");
      if (selectedProvider === "anthropic") return group.includes("anthropic") || id.startsWith("claude");
      if (selectedProvider === "google") return group.includes("google") || id.startsWith("gemini");
      if (selectedProvider === "groq") return group.includes("groq") || id.includes("llama");
      if (selectedProvider === "deepseek") return group.includes("deepseek");

      return true;
    });
  }, [models, search, selectedProvider]);

  const groupedModels = useMemo(() => {
    return filteredModels.reduce<Record<string, ModelEntry[]>>((acc, m) => {
      const group = m.owned_by || "Available Routes";
      if (!acc[group]) acc[group] = [];
      acc[group].push(m);
      return acc;
    }, {});
  }, [filteredModels]);

  const sortedGroups = useMemo(() => {
    return Object.keys(groupedModels).sort((a, b) => {
      if (a === "Available Routes") return 1;
      return a.localeCompare(b);
    });
  }, [groupedModels]);

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const toggleAllGroups = (collapse: boolean) => {
    const updated: Record<string, boolean> = {};
    for (const g of sortedGroups) {
      updated[g] = collapse;
    }
    setCollapsedGroups(updated);
  };

  const getCapabilityTags = (id: string) => {
    const lower = id.toLowerCase();
    const tags: { label: string; icon: any; color: string }[] = [];

    if (lower.includes("o1") || lower.includes("o3") || lower.includes("r1") || lower.includes("reasoner") || lower.includes("thinking")) {
      tags.push({ label: "Reasoning", icon: Brain, color: "text-purple-500 bg-purple-500/10 border-purple-500/20" });
    }
    if (lower.includes("sonnet") || lower.includes("coding") || lower.includes("deepseek") || lower.includes("gpt-4o")) {
      tags.push({ label: "Code", icon: Code, color: "text-blue-500 bg-blue-500/10 border-blue-500/20" });
    }
    if (lower.includes("vision") || lower.includes("4o") || lower.includes("gemini")) {
      tags.push({ label: "Vision", icon: Eye, color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" });
    }
    if (lower.includes("flash") || lower.includes("haiku") || lower.includes("instant") || lower.includes("fast") || lower.includes("mini")) {
      tags.push({ label: "Fast", icon: Zap, color: "text-amber-500 bg-amber-500/10 border-amber-500/20" });
    }

    return tags;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* OmniRoute Status Banner */}
      <div
        className={`flex items-center justify-between p-4 rounded-2xl border text-xs ${
          omnirouteOnline
            ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-900 dark:text-emerald-300"
            : "bg-secondary border-border text-muted-foreground"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              omnirouteOnline ? "bg-emerald-500 ring-4 ring-emerald-500/20 animate-pulse" : "bg-amber-500"
            }`}
          />
          <div>
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <span>{omnirouteOnline ? "OmniRoute Unified Router Online" : "Direct Provider Fallback Mode"}</span>
              <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-secondary border border-border">
                {omnirouteOnline ? "Port 3000 Active" : "Direct Vendor APIs"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {omnirouteOnline
                ? "Auto-smart routing routes agent requests across verified providers by cost and latency."
                : "OmniRoute proxy is not detected. Requests will route directly using configured environment keys."}
            </p>
          </div>
        </div>

        <button
          onClick={onRefreshModels}
          disabled={refreshingModels}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-secondary text-xs text-foreground font-medium transition cursor-pointer disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshingModels ? "animate-spin text-primary" : ""}`} />
          <span>{refreshingModels ? "Querying..." : "Refresh Catalog"}</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search model identifier (e.g. gpt-4o, claude-3-7)..."
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-border bg-card text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Provider quick pills */}
          <div className="flex items-center gap-1 overflow-x-auto p-0.5 rounded-lg bg-secondary/80 border border-border text-xs">
            {["all", "omniroute", "openai", "anthropic", "google", "groq", "deepseek"].map((p) => (
              <button
                key={p}
                onClick={() => setSelectedProvider(p)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer capitalize ${
                  selectedProvider === p
                    ? "bg-card text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p === "omniroute" ? "Auto-Router" : p}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground font-mono">
            {filteredModels.length} models / {sortedGroups.length} routes
          </span>
          <div className="flex items-center gap-1 text-xs">
            <button
              onClick={() => toggleAllGroups(false)}
              className="px-2 py-1 rounded text-muted-foreground hover:text-foreground text-[11px] cursor-pointer"
            >
              Expand All
            </button>
            <span className="text-muted-foreground/40">•</span>
            <button
              onClick={() => toggleAllGroups(true)}
              className="px-2 py-1 rounded text-muted-foreground hover:text-foreground text-[11px] cursor-pointer"
            >
              Collapse All
            </button>
          </div>
        </div>
      </div>

      {/* Model Groups Accordion */}
      {sortedGroups.length > 0 ? (
        <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
          {sortedGroups.map((group) => {
            const groupModels = groupedModels[group];
            const isCollapsed = collapsedGroups[group];

            return (
              <div key={group} className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
                <button
                  onClick={() => toggleGroup(group)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-secondary/20 hover:bg-secondary/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="text-xs font-bold text-foreground capitalize tracking-wide">
                      {group}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded-full border border-border">
                      {groupModels.length} models
                    </span>
                  </div>

                  <span className="text-[11px] text-muted-foreground">
                    {isCollapsed ? "Click to expand" : "Click to collapse"}
                  </span>
                </button>

                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-border divide-y divide-border/60">
                        {groupModels.map((m, index) => {
                          const testResult = testResults[m.id];
                          const isTesting = testingModel === m.id;
                          const capabilities = getCapabilityTags(m.id);

                          return (
                            <div
                              key={`${m.id}-${index}`}
                              className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2.5 hover:bg-muted/40 transition-colors gap-2"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="text-xs font-mono text-foreground font-medium truncate select-all">
                                  {m.id}
                                </span>
                                <button
                                  onClick={() => handleCopyModel(m.id)}
                                  className="p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer opacity-70 hover:opacity-100 transition"
                                  title="Copy model ID"
                                >
                                  {copiedModelId === m.id ? (
                                    <Check className="w-3 h-3 text-emerald-500" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>

                                {/* Capability Tags */}
                                <div className="hidden md:flex items-center gap-1.5 ml-2">
                                  {capabilities.map((tag) => {
                                    const TagIcon = tag.icon;
                                    return (
                                      <span
                                        key={tag.label}
                                        className={`text-[9.5px] px-1.5 py-0.2 rounded-md font-medium border flex items-center gap-1 ${tag.color}`}
                                      >
                                        <TagIcon className="w-2.5 h-2.5" />
                                        <span>{tag.label}</span>
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                {testResult && (
                                  <span
                                    className={`text-[10px] flex items-center gap-1 font-medium px-2 py-0.5 rounded-md border ${
                                      testResult.success
                                        ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                                        : "text-red-500 bg-red-500/10 border-red-500/20"
                                    }`}
                                  >
                                    {testResult.success ? (
                                      <CheckCircle className="w-3 h-3 text-emerald-500" />
                                    ) : (
                                      <XCircle className="w-3 h-3 text-red-500" />
                                    )}
                                    <span>
                                      {testResult.success ? formatResponseTime(testResult.latency) : "Failed"}
                                    </span>
                                  </span>
                                )}

                                <button
                                  onClick={() => onTestModel(m.id)}
                                  disabled={isTesting}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-xs disabled:opacity-50 transition-all text-foreground cursor-pointer font-medium"
                                  title="Perform live inference latency ping"
                                >
                                  {isTesting ? (
                                    <Loader2 className="w-3 h-3 animate-spin text-primary" />
                                  ) : (
                                    <TestTube className="w-3 h-3 text-primary" />
                                  )}
                                  <span>Ping</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-2 bg-card rounded-2xl border border-border">
          <Zap className="w-8 h-8 opacity-30" />
          <p className="text-xs font-semibold text-foreground">No matching models found</p>
          <p className="text-[11px] text-muted-foreground">Try clearing your search query or refreshing the model catalog.</p>
        </div>
      )}
    </motion.div>
  );
}
