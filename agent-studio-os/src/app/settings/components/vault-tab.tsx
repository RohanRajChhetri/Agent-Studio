"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  FolderOpen,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Loader2,
  FileText,
  Network,
  Brain,
  Layers,
  ShieldCheck,
  FolderTree,
  Bot,
  ArrowUpRight,
  Archive,
  Download,
  Trash2,
  RefreshCw,
  HardDrive,
  Laptop,
  FileCode,
  Camera,
  FolderPlus,
  FolderCheck,
  RotateCcw,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/confirm-modal";

export interface VaultStats {
  vaultPath: string;
  noteCount: number;
  graphStats: {
    nodes: number;
    edges: number;
    communities: number;
  };
}

interface VaultTabProps {
  vaultStats: VaultStats | null;
  onSyncVault: () => Promise<void>;
  onOpenObsidian: () => Promise<void>;
  syncingVault: boolean;
}

interface StorageConfigData {
  outputDir: string;
  vaultDir: string;
  codeDir: string;
  screenshotsDir: string;
  filesDir: string;
  outputDirExists: boolean;
  vaultDirExists: boolean;
  stats?: {
    codeFilesCount: number;
    screenshotsCount: number;
    documentsCount: number;
    vaultNotesCount: number;
    totalSizeBytes: number;
  };
}

interface RecentOutputItem {
  name: string;
  type: "code" | "screenshot" | "file" | "vault";
  path: string;
  fileUrl: string;
  size: number;
  mtime: string;
}

export function VaultTab({
  vaultStats,
  onSyncVault,
  onOpenObsidian,
  syncingVault,
}: VaultTabProps) {
  // Storage settings state
  const [storageConfig, setStorageConfig] = useState<StorageConfigData | null>(null);
  const [recentOutputs, setRecentOutputs] = useState<RecentOutputItem[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [openingExplorer, setOpeningExplorer] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResettingStorage, setIsResettingStorage] = useState(false);

  // Form input state
  const [inputOutputDir, setInputOutputDir] = useState("");
  const [inputVaultDir, setInputVaultDir] = useState("");
  const [useSeparateVault, setUseSeparateVault] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Path validation state
  const [pathValidation, setPathValidation] = useState<{
    valid: boolean;
    exists: boolean;
    message: string;
  } | null>(null);

  // Snapshot/Backup state
  const [copiedPath, setCopiedPath] = useState(false);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);

  const folderPickerRef = useRef<HTMLInputElement>(null);

  // Fetch storage settings from server
  const fetchStorageSettings = async () => {
    try {
      setLoadingConfig(true);
      const res = await fetch("/api/settings/storage");
      if (res.ok) {
        const data = await res.json();
        setStorageConfig(data.config);
        setRecentOutputs(data.recentOutputs || []);
        setInputOutputDir(data.config.outputDir || "");
        setInputVaultDir(data.config.vaultDir || "");
        // Check if vaultDir is separate from outputDir/vault
        const isNested = data.config.vaultDir?.startsWith(data.config.outputDir);
        setUseSeparateVault(!isNested);
      }
    } catch {
      toast.error("Failed to load storage configuration");
    } finally {
      setLoadingConfig(false);
    }
  };

  const fetchSnapshots = async () => {
    setLoadingSnapshots(true);
    try {
      const res = await fetch("/api/backup");
      if (res.ok) {
        const data = await res.json();
        setSnapshots(data.snapshots || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingSnapshots(false);
    }
  };

  useEffect(() => {
    fetchStorageSettings();
    fetchSnapshots();
  }, []);

  // Track changes
  const handleOutputDirChange = (val: string) => {
    setInputOutputDir(val);
    setHasUnsavedChanges(true);
    if (!useSeparateVault) {
      setInputVaultDir(val.replace(/[/\\]+$/, "") + "\\vault");
    }
    validatePathDebounced(val);
  };

  const handleVaultDirChange = (val: string) => {
    setInputVaultDir(val);
    setHasUnsavedChanges(true);
  };

  // Validate path via API
  const validatePathDebounced = async (targetPath: string) => {
    if (!targetPath.trim()) {
      setPathValidation(null);
      return;
    }
    try {
      const res = await fetch("/api/settings/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "validate", targetPath }),
      });
      if (res.ok) {
        const data = await res.json();
        setPathValidation({
          valid: data.valid,
          exists: data.exists,
          message: data.message,
        });
      }
    } catch {
      // ignore
    }
  };

  // Preset selector
  const applyPreset = (presetPath: string) => {
    setInputOutputDir(presetPath);
    setHasUnsavedChanges(true);
    if (!useSeparateVault) {
      setInputVaultDir(presetPath.replace(/[/\\]+$/, "") + "\\vault");
    }
    validatePathDebounced(presetPath);
    toast.info(`Selected preset directory: ${presetPath}`);
  };

  // Save changes
  const handleSaveStorage = async () => {
    if (!inputOutputDir.trim()) {
      toast.error("Please enter a valid output directory path");
      return;
    }

    setSavingConfig(true);
    try {
      const res = await fetch("/api/settings/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          outputDir: inputOutputDir.trim(),
          vaultDir: inputVaultDir.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStorageConfig(data.config);
        setHasUnsavedChanges(false);
        toast.success("AI output folder updated successfully! Deliverables will be saved here.");
        await onSyncVault();
      } else {
        toast.error(data.error || "Failed to save storage settings");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error saving storage settings");
    } finally {
      setSavingConfig(false);
    }
  };

  // Native folder picker trigger
  const handleBrowseFolderClick = async () => {
    if (typeof window !== "undefined" && "showDirectoryPicker" in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker();
        if (dirHandle?.name) {
          // In browser sandbox, showDirectoryPicker gives the directory handle.
          // Append or format based on current input base
          const base = inputOutputDir ? inputOutputDir.substring(0, inputOutputDir.lastIndexOf("\\") + 1) : "C:\\Users\\";
          const chosen = base ? `${base}${dirHandle.name}` : dirHandle.name;
          handleOutputDirChange(chosen);
          toast.success(`Selected folder: "${dirHandle.name}"`);
        }
        return;
      } catch (err: any) {
        if (err.name === "AbortError") return;
      }
    }
    // Fallback to hidden file input
    folderPickerRef.current?.click();
  };

  const handleNativeDirInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const sample = files[0];
      const relPath = sample.webkitRelativePath;
      const rootDir = relPath ? relPath.split("/")[0] : "";
      if (rootDir) {
        const base = inputOutputDir ? inputOutputDir.substring(0, inputOutputDir.lastIndexOf("\\") + 1) : "";
        const full = base ? `${base}${rootDir}` : rootDir;
        handleOutputDirChange(full);
        toast.success(`Selected folder: "${rootDir}"`);
      }
    }
  };

  // Open directory in native Windows File Explorer
  const handleOpenExplorer = async (targetPath?: string) => {
    setOpeningExplorer(true);
    try {
      const folderToOpen = targetPath || inputOutputDir || storageConfig?.outputDir;
      const res = await fetch("/api/settings/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open_folder", targetPath: folderToOpen }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Opened "${data.path}" in File Explorer`);
      } else {
        toast.error(data.error || "Failed to open folder");
      }
    } catch {
      toast.error("Error launching File Explorer");
    } finally {
      setOpeningExplorer(false);
    }
  };

  // Reset to default folders
  const handleResetDefaults = () => {
    setShowResetConfirm(true);
  };

  const handleConfirmResetDefaults = async () => {
    setIsResettingStorage(true);
    try {
      const res = await fetch("/api/settings/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStorageConfig(data.config);
        setInputOutputDir(data.config.outputDir);
        setInputVaultDir(data.config.vaultDir);
        setHasUnsavedChanges(false);
        toast.success("Storage paths reset to standard defaults");
        setShowResetConfirm(false);
      } else {
        toast.error("Failed to reset storage paths");
      }
    } catch {
      toast.error("Failed to reset storage paths");
    } finally {
      setIsResettingStorage(false);
    }
  };

  const handleCreateSnapshot = async () => {
    setCreatingSnapshot(true);
    try {
      const res = await fetch("/api/backup", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Backup archive "${data.snapshot.fileName}" created!`);
        fetchSnapshots();
      } else {
        toast.error("Failed to create snapshot");
      }
    } catch {
      toast.error("Error creating backup archive");
    } finally {
      setCreatingSnapshot(false);
    }
  };

  const handleDeleteSnapshot = async (fileName: string) => {
    try {
      const res = await fetch("/api/backup", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName }),
      });
      if (res.ok) {
        toast.success("Snapshot removed");
        setSnapshots((prev) => prev.filter((s) => s.fileName !== fileName));
      }
    } catch {
      toast.error("Failed to delete snapshot");
    }
  };

  const handleCopyPath = (pathText: string) => {
    if (pathText) {
      navigator.clipboard.writeText(pathText);
      setCopiedPath(true);
      toast.success("Folder path copied to clipboard");
      setTimeout(() => setCopiedPath(false), 2000);
    }
  };

  const memoryDomains = [
    {
      folder: "Executive/",
      title: "Daily Executive Briefings",
      agent: "Executive Agent",
      desc: "Morning digests, cross-fleet summaries, and prioritized blockers.",
      badge: "Briefings",
    },
    {
      folder: "Research/",
      title: "Research Dossiers and Web Insights",
      agent: "Research Agent",
      desc: "Synthesized web citations, competitor teardowns, and technology evaluations.",
      badge: "Knowledge",
    },
    {
      folder: "Architecture/",
      title: "Engineering Specs and Code Artifacts",
      agent: "Coder Agent",
      desc: "API schemas, database migration logs, and component contracts.",
      badge: "Code",
    },
    {
      folder: "Tasks/",
      title: "Kanban Task Deliverables",
      agent: "Reviewer and Autonomous Fleet",
      desc: "Human-in-the-loop review notes, completion proofs, and test results.",
      badge: "Deliverables",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Hidden file input for native directory selector */}
      <input
        type="file"
        ref={folderPickerRef}
        onChange={handleNativeDirInput}
        {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
        multiple
        className="hidden"
      />

      {/* Hero Section: AI Output & Storage Directory Configuration */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-6 shadow-sm relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0 shadow-xs">
              <HardDrive className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-foreground">AI Deliverables Storage Folder</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Active Output Target
                </span>
                {hasUnsavedChanges && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/30 animate-pulse">
                    Unsaved Path
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                Choose the folder on your computer where the AI saves everything it produces — including <strong>code projects</strong>, <strong>Obsidian vault notes</strong>, <strong>desktop screenshots</strong>, and <strong>generated documents</strong> (PDFs, Word docs, CSV data).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={() => handleOpenExplorer(inputOutputDir || storageConfig?.outputDir)}
              disabled={openingExplorer}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
              title="Open folder in Windows Explorer"
            >
              {openingExplorer ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> : <FolderOpen className="w-3.5 h-3.5 text-primary" />}
              <span>Open in Explorer</span>
            </button>

            <button
              onClick={handleSaveStorage}
              disabled={savingConfig || !hasUnsavedChanges}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-40"
            >
              {savingConfig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderCheck className="w-3.5 h-3.5" />}
              <span>Save Changes</span>
            </button>
          </div>
        </div>

        {/* Directory Input Form & Path Validation */}
        <div className="space-y-3 pt-2 border-t border-border">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <FolderTree className="w-3.5 h-3.5 text-primary" />
                <span>Primary AI Output Directory</span>
              </label>
              {pathValidation && (
                <span
                  className={`text-[11px] flex items-center gap-1 font-medium ${
                    pathValidation.exists
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-blue-500"
                  }`}
                >
                  {pathValidation.exists ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <FolderPlus className="w-3 h-3 text-blue-500" />
                  )}
                  {pathValidation.message}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 relative flex items-center">
                <input
                  type="text"
                  value={inputOutputDir}
                  onChange={(e) => handleOutputDirChange(e.target.value)}
                  placeholder="e.g. C:\Users\YourName\AgentStudio-Output or ~/agent-studio/output"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-secondary/60 border border-border font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition"
                />
              </div>

              <button
                type="button"
                onClick={handleBrowseFolderClick}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-xs font-medium text-foreground transition cursor-pointer shrink-0"
                title="Select folder from your computer"
              >
                <FolderOpen className="w-3.5 h-3.5 text-primary" />
                <span className="hidden sm:inline">Browse Folder</span>
              </button>

              <button
                type="button"
                onClick={() => handleCopyPath(inputOutputDir)}
                className="p-2.5 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-xs font-medium text-foreground transition cursor-pointer shrink-0"
                title="Copy folder path"
              >
                {copiedPath ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground pt-1">
            <span className="text-[11px] font-medium">Quick Presets:</span>
            <button
              type="button"
              onClick={() => applyPreset("C:\\Users\\rohan\\AgentStudio-Output")}
              className="px-2.5 py-1 rounded-lg bg-secondary/70 hover:bg-secondary text-[11px] text-foreground font-mono transition border border-border cursor-pointer"
            >
              C:\Users\rohan\AgentStudio-Output
            </button>
            <button
              type="button"
              onClick={() => applyPreset("C:\\Users\\rohan\\Documents\\AgentStudio")}
              className="px-2.5 py-1 rounded-lg bg-secondary/70 hover:bg-secondary text-[11px] text-foreground font-mono transition border border-border cursor-pointer"
            >
              Documents\AgentStudio
            </button>
            <button
              type="button"
              onClick={() => applyPreset("C:\\Users\\rohan\\Desktop\\AgentStudio-Output")}
              className="px-2.5 py-1 rounded-lg bg-secondary/70 hover:bg-secondary text-[11px] text-foreground font-mono transition border border-border cursor-pointer"
            >
              Desktop\AgentStudio-Output
            </button>
            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-2 py-1 rounded-lg text-muted-foreground hover:text-foreground text-[11px] transition cursor-pointer flex items-center gap-1"
              title="Reset to default paths"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Output Categories Subfolders Grid */}
        <div className="space-y-2 pt-3 border-t border-border">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Output Subfolders Breakdown
            </h4>
            <span className="text-[11px] text-muted-foreground">
              Total Disk Usage: {storageConfig?.stats ? (storageConfig.stats.totalSizeBytes / (1024 * 1024)).toFixed(2) : "0.00"} MB
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Code Deliverables */}
            <div className="p-3.5 rounded-xl border border-border bg-secondary/30 space-y-2 hover:border-primary/40 transition">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                  /code
                </span>
                <FileCode className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-foreground">Generated Code</h5>
                <p className="text-[10.5px] text-muted-foreground mt-0.5">
                  Web apps, scripts, components, and full project builds
                </p>
              </div>
              <div className="pt-1 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                <span>{storageConfig?.stats?.codeFilesCount ?? 0} files</span>
                <button
                  type="button"
                  onClick={() => handleOpenExplorer(`${inputOutputDir}\\code`)}
                  className="text-primary hover:underline cursor-pointer"
                >
                  Open &rarr;
                </button>
              </div>
            </div>

            {/* 2. Obsidian Vault */}
            <div className="p-3.5 rounded-xl border border-border bg-secondary/30 space-y-2 hover:border-purple-500/40 transition">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
                  /vault
                </span>
                <Brain className="w-4 h-4 text-purple-500" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-foreground">Obsidian Vault</h5>
                <p className="text-[10.5px] text-muted-foreground mt-0.5">
                  Markdown research dossiers, memory notes, and wikilinks
                </p>
              </div>
              <div className="pt-1 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                <span>{vaultStats?.noteCount ?? storageConfig?.stats?.vaultNotesCount ?? 0} notes</span>
                <button
                  type="button"
                  onClick={onOpenObsidian}
                  className="text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                >
                  Obsidian &rarr;
                </button>
              </div>
            </div>

            {/* 3. Screenshots */}
            <div className="p-3.5 rounded-xl border border-border bg-secondary/30 space-y-2 hover:border-blue-500/40 transition">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                  /screenshots
                </span>
                <Camera className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-foreground">Desktop Screenshots</h5>
                <p className="text-[10.5px] text-muted-foreground mt-0.5">
                  CUA automation captures, proofs, and visual audit screenshots
                </p>
              </div>
              <div className="pt-1 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                <span>{storageConfig?.stats?.screenshotsCount ?? 0} captures</span>
                <button
                  type="button"
                  onClick={() => handleOpenExplorer(`${inputOutputDir}\\screenshots`)}
                  className="text-blue-500 hover:underline cursor-pointer"
                >
                  Open &rarr;
                </button>
              </div>
            </div>

            {/* 4. Files & Documents */}
            <div className="p-3.5 rounded-xl border border-border bg-secondary/30 space-y-2 hover:border-amber-500/40 transition">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                  /files
                </span>
                <FileText className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-foreground">Created Documents</h5>
                <p className="text-[10.5px] text-muted-foreground mt-0.5">
                  Compiled PDFs, Word docs, CSV spreadsheets, and exports
                </p>
              </div>
              <div className="pt-1 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                <span>{storageConfig?.stats?.documentsCount ?? 0} files</span>
                <button
                  type="button"
                  onClick={() => handleOpenExplorer(`${inputOutputDir}\\files`)}
                  className="text-amber-500 hover:underline cursor-pointer"
                >
                  Open &rarr;
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Separate Obsidian Vault Location Option (Collapsible) */}
        <div className="pt-3 border-t border-border space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="separate-vault"
                checked={useSeparateVault}
                onChange={(e) => {
                  setUseSeparateVault(e.target.checked);
                  setHasUnsavedChanges(true);
                  if (!e.target.checked) {
                    setInputVaultDir(inputOutputDir.replace(/[/\\]+$/, "") + "\\vault");
                  }
                }}
                className="rounded border-border text-primary focus:ring-primary cursor-pointer"
              />
              <label htmlFor="separate-vault" className="text-xs font-semibold text-foreground cursor-pointer">
                Use custom location for Obsidian Vault (point to existing Second Brain)
              </label>
            </div>
          </div>

          {useSeparateVault && (
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Custom Obsidian Vault Directory Path
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={inputVaultDir}
                  onChange={(e) => handleVaultDirChange(e.target.value)}
                  placeholder="e.g. C:\Users\rohan\Documents\Obsidian\PersonalVault"
                  className="flex-1 px-3.5 py-2 rounded-xl bg-secondary/60 border border-border font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition"
                />
                <button
                  type="button"
                  onClick={() => handleOpenExplorer(inputVaultDir)}
                  className="px-3 py-2 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-xs text-foreground font-medium transition cursor-pointer"
                >
                  Open
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Obsidian Knowledge Graph & Memory Galaxy Section */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-5 shadow-xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-500 border border-purple-500/20 flex items-center justify-center shrink-0">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-foreground">Obsidian Knowledge Graph</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  Local Markdown Engine
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                Single source of truth for episodic memory, documentation, research findings, and task artifacts. All autonomous agents read and write directly to this folder, allowing bidirectional cross-referencing and Obsidian Graph visualization.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              onClick={onOpenObsidian}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in Obsidian</span>
            </button>

            <button
              onClick={onSyncVault}
              disabled={syncingVault}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-xs font-medium text-foreground transition cursor-pointer disabled:opacity-50"
            >
              {syncingVault ? <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" /> : <Sparkles className="w-3.5 h-3.5 text-purple-500" />}
              <span>{syncingVault ? "Synchronizing..." : "Sync Vault"}</span>
            </button>
          </div>
        </div>

        {/* Realtime Metrics Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-4 rounded-xl border border-border bg-secondary/30 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[10.5px] uppercase tracking-wider font-semibold">Total Notes</span>
              <FileText className="w-4 h-4 text-purple-500" />
            </div>
            <p className="text-2xl font-bold font-mono text-foreground">{vaultStats?.noteCount ?? storageConfig?.stats?.vaultNotesCount ?? 0}</p>
            <p className="text-[10.5px] text-muted-foreground">Formatted Markdown documents</p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-secondary/30 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[10.5px] uppercase tracking-wider font-semibold">Knowledge Graph Links</span>
              <Network className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold font-mono text-foreground">{vaultStats?.graphStats?.edges ?? 0}</p>
            <p className="text-[10.5px] text-muted-foreground">Bidirectional [[wikilinks]] indexed</p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-secondary/30 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[10.5px] uppercase tracking-wider font-semibold">Context Clusters</span>
              <Brain className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold font-mono text-foreground">{vaultStats?.graphStats?.communities ?? 0}</p>
            <p className="text-[10.5px] text-muted-foreground">Louvain modularity clusters</p>
          </div>
        </div>
      </div>

      {/* Recent Deliverables Explorer */}
      {recentOutputs.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              <h4 className="text-sm font-bold text-foreground">Recently Generated AI Deliverables</h4>
            </div>
            <span className="text-xs text-muted-foreground">{recentOutputs.length} latest items</span>
          </div>

          <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
            {recentOutputs.slice(0, 8).map((item) => (
              <div key={item.path} className="p-3 bg-secondary/20 hover:bg-secondary/40 transition flex items-center justify-between text-xs gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {item.type === "code" ? (
                    <FileCode className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : item.type === "screenshot" ? (
                    <Camera className="w-4 h-4 text-blue-500 shrink-0" />
                  ) : item.type === "vault" ? (
                    <Brain className="w-4 h-4 text-purple-500 shrink-0" />
                  ) : (
                    <FileText className="w-4 h-4 text-amber-500 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-mono font-medium text-foreground truncate">{item.name}</p>
                    <p className="text-[10.5px] text-muted-foreground font-mono">
                      {(item.size / 1024).toFixed(1)} KB • {new Date(item.mtime).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={item.fileUrl}
                    download={item.name}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-[11px] font-medium text-foreground transition"
                  >
                    <Download className="w-3 h-3 text-primary" />
                    <span>Download</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => handleOpenExplorer(item.path)}
                    className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition cursor-pointer"
                    title="Locate file in File Explorer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fleet Memory Domain Map */}
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-bold text-foreground">Fleet Memory Partition Map</h4>
          <p className="text-xs text-muted-foreground">
            How autonomous agents structure knowledge within the Obsidian vault hierarchy
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {memoryDomains.map((dom) => (
            <div
              key={dom.folder}
              className="p-4 rounded-2xl border border-border bg-card shadow-xs space-y-2 hover:border-purple-500/40 transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
                  {dom.folder}
                </span>
                <span className="text-[10.5px] text-muted-foreground font-mono flex items-center gap-1">
                  <Bot className="w-3 h-3 text-muted-foreground" />
                  {dom.agent}
                </span>
              </div>
              <h5 className="text-xs font-semibold text-foreground">{dom.title}</h5>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{dom.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Database & Vault Snapshots / Backups */}
      <div className="space-y-3 pt-3 border-t border-border">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Archive className="w-4 h-4 text-primary" />
              Automated Snapshots and Disaster Recovery
            </h4>
            <p className="text-xs text-muted-foreground">
              One-click complete backups of SQLite state, agent profiles, tasks, and markdown vault notes.
            </p>
          </div>
          <button
            onClick={handleCreateSnapshot}
            disabled={creatingSnapshot}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold transition disabled:opacity-50 cursor-pointer shadow-sm shrink-0"
          >
            {creatingSnapshot ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Archive className="w-3.5 h-3.5" />
            )}
            <span>{creatingSnapshot ? "Archiving..." : "Create Snapshot"}</span>
          </button>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          {loadingSnapshots ? (
            <div className="py-6 flex items-center justify-center text-muted-foreground text-xs gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>Checking backup archives...</span>
            </div>
          ) : snapshots.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground space-y-1">
              <Archive className="w-8 h-8 text-muted-foreground/30 mx-auto" />
              <p className="text-xs font-medium">No snapshots created yet</p>
              <p className="text-[11px] text-muted-foreground">
                Click &quot;Create Snapshot&quot; to export a complete portable archive.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {snapshots.map((snap) => (
                <div
                  key={snap.fileName}
                  className="p-3 rounded-xl bg-secondary/50 border border-border flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Archive className="w-4 h-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="font-mono font-medium text-foreground truncate">{snap.fileName}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {(snap.sizeBytes / 1024).toFixed(1)} KB • {new Date(snap.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={snap.downloadUrl}
                      download={snap.fileName}
                      className="p-1.5 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition"
                      title="Download archive"
                    >
                      <Download className="w-3.5 h-3.5 text-primary" />
                    </a>
                    <button
                      onClick={() => handleDeleteSnapshot(snap.fileName)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition cursor-pointer"
                      title="Delete archive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Reset Storage Confirm Modal */}
      <ConfirmModal
        isOpen={showResetConfirm}
        onClose={() => {
          if (!isResettingStorage) setShowResetConfirm(false);
        }}
        onConfirm={handleConfirmResetDefaults}
        title="Reset Storage Directories"
        description="Are you sure you want to reset AI storage paths to default locations?"
        dangerDetails="Output and Obsidian vault directories will be reset to internal workspace paths."
        confirmText="Reset Defaults"
        variant="warning"
        loading={isResettingStorage}
      />
    </motion.div>
  );
}
