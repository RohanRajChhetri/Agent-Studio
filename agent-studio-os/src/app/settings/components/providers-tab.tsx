"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Key,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Save,
  TestTube,
  Trash2,
  Loader2,
  ExternalLink,
  Search,
  Sparkles,
  ShieldCheck,
  Zap,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { formatResponseTime } from "@/lib/utils";

export interface ProviderInfo {
  provider: string;
  envVar: string;
  label: string;
  isSet: boolean;
  masked: string;
  models?: readonly string[];
}

interface ProvidersTabProps {
  providers: ProviderInfo[];
  onSaveKey: (provider: string, envVar: string, value: string) => Promise<void>;
  onDeleteKey: (envVar: string) => Promise<void>;
  onTestKey: (provider: string, envVar: string, value?: string) => Promise<{ success: boolean; latency?: number; error?: string }>;
  keyTestStatus: Record<string, { success: boolean; latency?: number; error?: string }>;
  savingKey: string | null;
  deletingKey: string | null;
  testingKey: string | null;
}

// Brand visual metadata for high-end styling
const PROVIDER_METADATA: Record<
  string,
  {
    badgeColor: string;
    iconBg: string;
    borderAccent: string;
    portalUrl: string;
    description: string;
  }
> = {
  google: {
    badgeColor: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    iconBg: "bg-blue-500/10 text-blue-500",
    borderAccent: "hover:border-blue-500/40",
    portalUrl: "https://aistudio.google.com/app/apikey",
    description: "Multimodal Gemini 2.5 Flash, Pro, and Flash Lite models with high context limits.",
  },
  omniroute: {
    badgeColor: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20",
    iconBg: "bg-cyan-500/10 text-cyan-500",
    borderAccent: "hover:border-cyan-500/40",
    portalUrl: "http://localhost:3000",
    description: "Unified AI gateway with auto-smart routing, latency fallback, and load balancing.",
  },
  groq: {
    badgeColor: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    iconBg: "bg-amber-500/10 text-amber-500",
    borderAccent: "hover:border-amber-500/40",
    portalUrl: "https://console.groq.com/keys",
    description: "Ultra-fast LPU inference engine powering Llama 3.3 and DeepSeek R1 models.",
  },
  anthropic: {
    badgeColor: "text-orange-500 bg-orange-500/10 border-orange-500/20",
    iconBg: "bg-orange-500/10 text-orange-500",
    borderAccent: "hover:border-orange-500/40",
    portalUrl: "https://console.anthropic.com/settings/keys",
    description: "Claude 3.7 Sonnet, Claude 3.5 Sonnet, and Haiku for deep reasoning and code generation.",
  },
  openai: {
    badgeColor: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    iconBg: "bg-emerald-500/10 text-emerald-500",
    borderAccent: "hover:border-emerald-500/40",
    portalUrl: "https://platform.openai.com/api-keys",
    description: "GPT-4o, GPT-4o-mini, o1, and o3-mini reasoning models for agent workflows.",
  },
  deepseek: {
    badgeColor: "text-sky-500 bg-sky-500/10 border-sky-500/20",
    iconBg: "bg-sky-500/10 text-sky-500",
    borderAccent: "hover:border-sky-500/40",
    portalUrl: "https://platform.deepseek.com/api_keys",
    description: "DeepSeek-V3 and DeepSeek-R1 math, reasoning, and coding models.",
  },
  xai: {
    badgeColor: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
    iconBg: "bg-zinc-500/10 text-zinc-400",
    borderAccent: "hover:border-zinc-500/40",
    portalUrl: "https://console.x.ai/",
    description: "Grok-2 and Grok-beta models from xAI.",
  },
  moonshot: {
    badgeColor: "text-purple-500 bg-purple-500/10 border-purple-500/20",
    iconBg: "bg-purple-500/10 text-purple-500",
    borderAccent: "hover:border-purple-500/40",
    portalUrl: "https://platform.moonshot.cn/",
    description: "Moonshot Kimi long-context conversation models.",
  },
};

export function ProvidersTab({
  providers,
  onSaveKey,
  onDeleteKey,
  onTestKey,
  keyTestStatus,
  savingKey,
  deletingKey,
  testingKey,
}: ProvidersTabProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "configured" | "unconfigured">("all");
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [testingAll, setTestingAll] = useState(false);

  // Filtered providers
  const filtered = providers.filter((p) => {
    const matchesSearch =
      p.label.toLowerCase().includes(search.toLowerCase()) ||
      p.envVar.toLowerCase().includes(search.toLowerCase()) ||
      (p.models && p.models.some((m) => m.toLowerCase().includes(search.toLowerCase())));

    if (!matchesSearch) return false;
    if (filter === "configured") return p.isSet;
    if (filter === "unconfigured") return !p.isSet;
    return true;
  });

  const configuredCount = providers.filter((p) => p.isSet).length;

  const handleCopy = (envVar: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(envVar);
    toast.success("Masked key copied to clipboard");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleTestAllConfigured = async () => {
    const active = providers.filter((p) => p.isSet);
    if (active.length === 0) {
      toast.info("No configured provider keys to test.");
      return;
    }
    setTestingAll(true);
    let successCount = 0;
    for (const p of active) {
      try {
        const res = await onTestKey(p.provider, p.envVar);
        if (res.success) successCount++;
      } catch {}
    }
    setTestingAll(false);
    toast.success(`Verification complete: ${successCount}/${active.length} active providers responded.`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* Control & Filter Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search providers, keys, models..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-border bg-card text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center p-0.5 rounded-lg bg-secondary/80 border border-border text-xs">
            <button
              onClick={() => setFilter("all")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                filter === "all" ? "bg-card text-foreground font-semibold shadow-xs" : "text-muted-foreground"
              }`}
            >
              All ({providers.length})
            </button>
            <button
              onClick={() => setFilter("configured")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                filter === "configured" ? "bg-card text-foreground font-semibold shadow-xs" : "text-muted-foreground"
              }`}
            >
              Configured ({configuredCount})
            </button>
            <button
              onClick={() => setFilter("unconfigured")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                filter === "unconfigured" ? "bg-card text-foreground font-semibold shadow-xs" : "text-muted-foreground"
              }`}
            >
              Needs Key ({providers.length - configuredCount})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {configuredCount > 0 && (
            <button
              onClick={handleTestAllConfigured}
              disabled={testingAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-xs font-medium text-foreground transition cursor-pointer disabled:opacity-50"
              title="Test ping latency on all active provider keys"
            >
              {testingAll ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              ) : (
                <TestTube className="w-3.5 h-3.5 text-primary" />
              )}
              <span>{testingAll ? "Pinging..." : "Test All Configured"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Providers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map((p) => {
          const meta = PROVIDER_METADATA[p.provider] || {
            badgeColor: "text-primary bg-primary/10 border-primary/20",
            iconBg: "bg-primary/10 text-primary",
            borderAccent: "hover:border-primary/40",
            portalUrl: "https://console.cloud.google.com",
            description: "Language model provider gateway.",
          };

          const testResult = keyTestStatus[p.envVar];
          const hasInput = Boolean(keyInputs[p.envVar]?.trim());
          const isSaving = savingKey === p.envVar;
          const isTesting = testingKey === p.envVar;
          const isDeleting = deletingKey === p.envVar;

          return (
            <div
              key={p.envVar}
              className={`rounded-2xl border border-border bg-card p-5 space-y-4 shadow-xs transition-all duration-200 ${meta.borderAccent} relative overflow-hidden`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.iconBg}`}>
                    <Key className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-foreground">{p.label}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${meta.badgeColor}`}>
                        {p.provider.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{p.envVar}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {testResult && (
                    <span
                      className={`text-[11px] flex items-center gap-1 font-medium px-2 py-0.5 rounded-md border ${
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
                        {testResult.success
                          ? testResult.latency
                            ? formatResponseTime(testResult.latency)
                            : "Verified"
                          : "Failed"}
                      </span>
                    </span>
                  )}

                  <span
                    className={`text-[10.5px] px-2 py-0.5 rounded-full font-medium border flex items-center gap-1.5 ${
                      p.isSet
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        : "bg-secondary text-muted-foreground border-border"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        p.isSet ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40"
                      }`}
                    />
                    {p.isSet ? "Configured" : "Unset"}
                  </span>
                </div>
              </div>

              {/* Description & Link */}
              <p className="text-xs text-muted-foreground leading-relaxed">
                {meta.description}{" "}
                <a
                  href={meta.portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-0.5 text-[11px] font-medium"
                >
                  <span>Get API key</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </p>

              {/* Models Unlocked Pill List */}
              {p.models && p.models.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Available Models
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {p.models.map((m) => (
                      <span
                        key={m}
                        className="text-[10.5px] font-mono px-2 py-0.5 rounded-md bg-secondary/80 text-foreground/80 border border-border/80"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Existing Masked Key Preview if set */}
              {p.isSet && (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-secondary/40 border border-border text-xs">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="font-mono text-[11px] text-foreground select-all">{p.masked}</span>
                  </div>
                  <button
                    onClick={() => handleCopy(p.envVar, p.masked)}
                    className="p-1 rounded text-muted-foreground hover:text-foreground transition cursor-pointer"
                    title="Copy masked key identifier"
                  >
                    {copiedKey === p.envVar ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              )}

              {/* Key Input & Actions */}
              <div className="space-y-2 pt-1 border-t border-border">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showKeys[p.envVar] ? "text" : "password"}
                      name={`provider_key_${p.provider}`}
                      id={`provider_key_${p.provider}`}
                      autoComplete="new-password"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-form-type="other"
                      placeholder={
                        p.isSet
                          ? "Enter new key to replace existing..."
                          : `Enter ${p.label} API key...`
                      }
                      value={keyInputs[p.envVar] || ""}
                      onChange={(e) =>
                        setKeyInputs((prev) => ({
                          ...prev,
                          [p.envVar]: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-border bg-secondary/30 text-xs font-mono text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary pr-9 transition"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowKeys((prev) => ({
                          ...prev,
                          [p.envVar]: !prev[p.envVar],
                        }))
                      }
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
                      title={showKeys[p.envVar] ? "Hide key" : "Show key"}
                    >
                      {showKeys[p.envVar] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <button
                    onClick={async () => {
                      const val = keyInputs[p.envVar]?.trim();
                      if (val) {
                        await onSaveKey(p.provider, p.envVar, val);
                        setKeyInputs((prev) => ({ ...prev, [p.envVar]: "" }));
                      }
                    }}
                    disabled={isSaving || !hasInput}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold disabled:opacity-40 transition-all cursor-pointer shadow-xs"
                  >
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>Save</span>
                  </button>

                  <button
                    onClick={() => onTestKey(p.provider, p.envVar, keyInputs[p.envVar])}
                    disabled={isTesting || (!p.isSet && !hasInput)}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-xs font-medium text-foreground disabled:opacity-40 transition-all cursor-pointer"
                    title="Test connection against provider endpoint"
                  >
                    {isTesting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <TestTube className="w-3.5 h-3.5 text-primary" />
                    )}
                    <span className="hidden sm:inline">Test</span>
                  </button>

                  {p.isSet && (
                    <button
                      onClick={() => onDeleteKey(p.envVar)}
                      disabled={isDeleting}
                      className="p-2 rounded-xl border border-border hover:border-red-500/40 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all cursor-pointer"
                      title="Delete key"
                    >
                      {isDeleting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="p-12 text-center text-muted-foreground bg-card rounded-2xl border border-border space-y-2">
          <Key className="w-8 h-8 mx-auto opacity-30 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">No matching providers</p>
          <p className="text-xs text-muted-foreground">Adjust your search or filter criteria above.</p>
        </div>
      )}
    </motion.div>
  );
}
