"use client";

export const dynamic = "force-dynamic";

import { useState, useCallback, useRef, useEffect, Suspense, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Code,
  Copy,
  Check,
  Download,
  Loader2,
  Send,
  ChevronDown,
  ChevronRight,
  Sparkles,
  FileText,
  Folder,
  FolderPlus,
  FilePlus,
  RefreshCw,
  Save,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  Plus,
  FolderKanban,
  FileCode,
  Layers,
  ArrowRight,
  ExternalLink,
  Edit2,
  Eye,
  Play,
  Globe,
  Target,
  CornerDownLeft,
  ChevronUp,
  Maximize2,
  Minimize2,
  RotateCcw,
  Columns2,
  Monitor,
  Tablet,
  Smartphone,
  Search,
  Upload,
  Archive,
  ArrowLeftRight,
  Terminal,
  AlignLeft,
  Moon,
  Sun,
  FileSpreadsheet,
  FileCheck,
  MoreVertical,
  Undo2,
  Redo2,
  FileArchive,
  FolderArchive,
  SplitSquareVertical,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import type { FileTreeNode, WorkspaceProjectInfo } from "@/lib/project-filesystem";
import {
  useProjectBuilder,
  type CodeMessage,
  type BuildCompletedEventDetail,
} from "@/context/project-builder-context";
import {
  LANGUAGES,
  getLanguageForFile,
  formatCodeSnippet,
  PREVIEW_CONSOLE_BRIDGE_SCRIPT,
  type LanguageMeta,
} from "@/components/code/code-utils";
import {
  CodeConsoleDrawer,
  type ConsoleEntry,
} from "@/components/code/code-console-drawer";
import { CodeSearchReplace } from "@/components/code/code-search-replace";
import { CodeDiffViewer } from "@/components/code/code-diff-viewer";
import {
  ProjectTemplatesModal,
  type ProjectTemplateType,
} from "@/components/code/project-templates-modal";
import {
  playTaskCompletedSound,
  playTaskStartedSound,
  playClickSound,
  playWarningSound,
} from "@/lib/sound-effects";

interface EditorTab {
  path: string;
  name: string;
  content: string;
  originalContent: string;
  isDirty: boolean;
  language: string;
}

function CodePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialFilePath = searchParams?.get("file");
  const initialProjectParam = searchParams?.get("project");

  const {
    isGenerating: globalIsGenerating,
    isProjectGenerating,
    getProjectMessages,
    setProjectMessages,
    startGeneration,
    activeProject: globalActiveProject,
    setActiveProject: setGlobalActiveProject,
    latestResult,
  } = useProjectBuilder();

  // Project Folder Selection State
  const [projects, setProjects] = useState<WorkspaceProjectInfo[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>(
    initialProjectParam || globalActiveProject || "default-project"
  );
  const [isLoadingProjects, setIsLoadingProjects] = useState<boolean>(true);
  const [showProjectDropdown, setShowProjectDropdown] = useState<boolean>(false);
  const [projectSearchQuery, setProjectSearchQuery] = useState<string>("");
  const [showNewProjectModal, setShowNewProjectModal] = useState<boolean>(false);
  const [showDeleteProjectModal, setShowDeleteProjectModal] = useState<boolean>(false);
  const [isDeletingProject, setIsDeletingProject] = useState<boolean>(false);

  // Generating status strictly scoped to THIS project
  const isGenerating = isProjectGenerating
    ? isProjectGenerating(selectedProject)
    : globalIsGenerating;

  // Editor Tabs State
  const [tabs, setTabs] = useState<EditorTab[]>([
    {
      path: "index.html",
      name: "index.html",
      content: "<!DOCTYPE html>\n<html>\n<head>\n  <title>Workspace</title>\n</head>\n<body>\n  <h1>Ready</h1>\n</body>\n</html>\n",
      originalContent: "<!DOCTYPE html>\n<html>\n<head>\n  <title>Workspace</title>\n</head>\n<body>\n  <h1>Ready</h1>\n</body>\n</html>\n",
      isDirty: false,
      language: "html",
    },
  ]);
  const [activeTabPath, setActiveTabPath] = useState<string>("index.html");

  // Active Editor Content & Meta
  const activeTab = tabs.find((t) => t.path === activeTabPath) || tabs[0];
  const code = activeTab?.content || "";
  const currentFilePath = activeTab?.path || "index.html";
  const language = activeTab?.language || "html";

  const [prompt, setPrompt] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Read persisted project conversation messages from global context
  const messages = getProjectMessages(selectedProject);
  const setMessages = useCallback(
    (updater: CodeMessage[] | ((prev: CodeMessage[]) => CodeMessage[])) => {
      setProjectMessages(selectedProject, updater);
    },
    [selectedProject, setProjectMessages]
  );

  // Sync URL project query param
  const hasSyncedInitialProject = useRef(false);
  useEffect(() => {
    if (!hasSyncedInitialProject.current && initialProjectParam && initialProjectParam !== selectedProject) {
      hasSyncedInitialProject.current = true;
      setSelectedProject(initialProjectParam);
      setGlobalActiveProject(initialProjectParam);
    }
  }, [initialProjectParam, selectedProject, setGlobalActiveProject]);

  useEffect(() => {
    setGlobalActiveProject(selectedProject);
  }, [selectedProject, setGlobalActiveProject]);

  // View States
  const [activeArtifactTab, setActiveArtifactTab] = useState<"code" | "preview" | "split">("code");
  const [isDiffMode, setIsDiffMode] = useState<boolean>(false);
  const [previewViewport, setPreviewViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewDarkMode, setPreviewDarkMode] = useState<boolean>(true);
  const [autoReloadPreview, setAutoReloadPreview] = useState<boolean>(true);
  const [targetFolderScope, setTargetFolderScope] = useState<string>("");
  const [artifactExpanded, setArtifactExpanded] = useState<boolean>(false);
  const [fullscreenPreview, setFullscreenPreview] = useState<boolean>(false);

  // Editor Preferences
  const [fontSize, setFontSize] = useState<number>(13);
  const [wordWrap, setWordWrap] = useState<boolean>(false);
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 });
  const [selectionLen, setSelectionLen] = useState<number>(0);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);

  // Console Drawer State
  const [consoleOpen, setConsoleOpen] = useState<boolean>(false);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([
    {
      id: "init-1",
      level: "info",
      message: `Project workspace initialized for "${selectedProject}".`,
      timestamp: Date.now(),
    },
  ]);

  // File Tree State
  const [showFileExplorer, setShowFileExplorer] = useState<boolean>(true);
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [isLoadingTree, setIsLoadingTree] = useState<boolean>(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [fileFilterQuery, setFileFilterQuery] = useState<string>("");

  // Modals
  const [showNewFileDialog, setShowNewFileDialog] = useState<boolean>(false);
  const [newFilePathInput, setNewFilePathInput] = useState<string>("");
  const [showNewFolderDialog, setShowNewFolderDialog] = useState<boolean>(false);
  const [newFolderPathInput, setNewFolderPathInput] = useState<string>("");
  const [showRenameDialog, setShowRenameDialog] = useState<boolean>(false);
  const [renameTarget, setRenameTarget] = useState<{ path: string; isFolder: boolean } | null>(null);
  const [renameNewPathInput, setRenameNewPathInput] = useState<string>("");
  const [isRenaming, setIsRenaming] = useState<boolean>(false);

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const fileUploadInputRef = useRef<HTMLInputElement>(null);

  const projectBasePath = `agent-workspace/${selectedProject}`;
  const currentLang = LANGUAGES.find((l) => l.id === language) || LANGUAGES[0];
  const lineCount = useMemo(() => code.split("\n").length, [code]);

  // 1. Fetch available workspace project folders
  const loadProjects = useCallback(async () => {
    setIsLoadingProjects(true);
    try {
      const res = await fetch("/api/filesystem?action=projects");
      if (res.ok) {
        const data = await res.json();
        const list: WorkspaceProjectInfo[] = data.projects || [];
        setProjects(list);
        if (list.length > 0) {
          setSelectedProject((prev) => {
            const exists = list.some((p) => p.name === prev);
            return exists ? prev : list[0].name;
          });
        }
      }
    } catch {
      toast.error("Failed to load project workspaces");
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // 2. Fetch file tree scoped exclusively to selected project
  const loadProjectTree = useCallback(async () => {
    if (!selectedProject) return;
    setIsLoadingTree(true);
    try {
      const targetPath = `agent-workspace/${selectedProject}`;
      const res = await fetch(`/api/filesystem?action=tree&path=${encodeURIComponent(targetPath)}`);
      if (res.ok) {
        const data = await res.json();
        setFileTree(data.tree || []);
      }
    } catch {
      // Handled
    } finally {
      setIsLoadingTree(false);
    }
  }, [selectedProject]);

  useEffect(() => {
    loadProjectTree();
  }, [loadProjectTree]);

  // Flat list of relative file paths in active project
  const flatFileList = useMemo(() => {
    const list: string[] = [];
    const traverse = (nodes: FileTreeNode[]) => {
      for (const n of nodes) {
        if (!n.isDirectory) {
          const rel = n.path.startsWith(projectBasePath)
            ? n.path.slice(projectBasePath.length).replace(/^[/\\]+/, "")
            : n.path;
          list.push(rel);
        } else if (n.children) {
          traverse(n.children);
        }
      }
    };
    traverse(fileTree);
    return list;
  }, [fileTree, projectBasePath]);

  // 3. Switch project handler
  const handleSelectProject = useCallback(
    (projName: string) => {
      setSelectedProject(projName);
      setGlobalActiveProject(projName);
      setShowProjectDropdown(false);
      setTargetFolderScope("");
      setIsDiffMode(false);
      try {
        router.replace(`/code?project=${encodeURIComponent(projName)}`, { scroll: false });
      } catch {}
      setConsoleEntries((prev) => [
        ...prev,
        {
          id: `proj-switch-${Date.now()}`,
          level: "info",
          message: `Switched project context to "${projName}".`,
          timestamp: Date.now(),
        },
      ]);
    },
    [router, setGlobalActiveProject]
  );

  // 4. Load a specific file into editor tabs
  const openFileInTab = useCallback(
    async (relPathOrFullPath: string) => {
      try {
        let targetPath = relPathOrFullPath.trim();
        if (!targetPath.startsWith("agent-workspace/")) {
          targetPath = `${projectBasePath}/${targetPath.replace(/^[/\\]+/, "")}`;
        }

        const displayRelPath = targetPath.startsWith(projectBasePath)
          ? targetPath.slice(projectBasePath.length).replace(/^[/\\]+/, "")
          : targetPath;

        // Check if already open in tabs
        const existingTab = tabs.find((t) => t.path === displayRelPath);
        if (existingTab) {
          setActiveTabPath(displayRelPath);
          return;
        }

        const res = await fetch(`/api/filesystem?action=read&path=${encodeURIComponent(targetPath)}`);
        if (res.ok) {
          const data = await res.json();
          const langMeta = getLanguageForFile(displayRelPath);
          const newTab: EditorTab = {
            path: displayRelPath,
            name: displayRelPath.split("/").pop() || displayRelPath,
            content: data.content,
            originalContent: data.content,
            isDirty: false,
            language: langMeta.id,
          };

          setTabs((prev) => [...prev, newTab]);
          setActiveTabPath(displayRelPath);
          playClickSound();
        } else {
          toast.error(`Could not open file: ${relPathOrFullPath}`);
        }
      } catch {
        toast.error(`Error loading file: ${relPathOrFullPath}`);
      }
    },
    [projectBasePath, tabs]
  );

  // Close tab
  const handleCloseTab = (tabPath: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const tabToClose = tabs.find((t) => t.path === tabPath);
    if (tabToClose?.isDirty) {
      if (!confirm(`"${tabToClose.name}" has unsaved changes. Close anyway?`)) {
        return;
      }
    }

    const newTabs = tabs.filter((t) => t.path !== tabPath);
    if (newTabs.length === 0) {
      const fallback: EditorTab = {
        path: "untitled.txt",
        name: "untitled.txt",
        content: "// Empty editor\n",
        originalContent: "// Empty editor\n",
        isDirty: false,
        language: "javascript",
      };
      setTabs([fallback]);
      setActiveTabPath("untitled.txt");
    } else {
      setTabs(newTabs);
      if (activeTabPath === tabPath) {
        const lastTab = newTabs[newTabs.length - 1];
        setActiveTabPath(lastTab.path);
      }
    }
  };

  const handleCloseOtherTabs = (tabPath: string) => {
    const keep = tabs.filter((t) => t.path === tabPath);
    setTabs(keep);
    setActiveTabPath(tabPath);
  };

  const handleCloseAllTabs = () => {
    const fallback: EditorTab = {
      path: "untitled.txt",
      name: "untitled.txt",
      content: "// Empty editor\n",
      originalContent: "// Empty editor\n",
      isDirty: false,
      language: "javascript",
    };
    setTabs([fallback]);
    setActiveTabPath("untitled.txt");
  };

  // Editor content updater
  const handleCodeChange = (newCode: string) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.path === activeTabPath
          ? {
              ...t,
              content: newCode,
              isDirty: newCode !== t.originalContent,
            }
          : t
      )
    );
  };

  // 5. Initial file loader on project switch
  useEffect(() => {
    if (fileTree.length > 0) {
      const findFirstFile = (nodes: FileTreeNode[]): string | null => {
        for (const n of nodes) {
          if (!n.isDirectory && (n.name === "index.html" || n.name === "App.tsx" || n.name === "README.md")) {
            return n.path;
          }
        }
        for (const n of nodes) {
          if (!n.isDirectory) return n.path;
          if (n.children) {
            const nested = findFirstFile(n.children);
            if (nested) return nested;
          }
        }
        return null;
      };

      const first = findFirstFile(fileTree);
      if (first) {
        openFileInTab(first);
      }
    }
  }, [selectedProject, fileTree.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll messages to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 6. Save active file to disk
  const handleSaveToProject = async () => {
    if (!currentFilePath.trim()) return;
    setIsSaving(true);
    try {
      const targetPath = `${projectBasePath}/${currentFilePath.replace(/^[/\\]+/, "").trim()}`;
      const res = await fetch("/api/filesystem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "write_file",
          path: targetPath,
          content: code,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setTabs((prev) =>
          prev.map((t) =>
            t.path === activeTabPath
              ? { ...t, originalContent: code, isDirty: false }
              : t
          )
        );
        toast.success(`Saved "${currentFilePath}" (${data.size} bytes)!`);
        playTaskCompletedSound();
        loadProjectTree();

        setConsoleEntries((prev) => [
          ...prev,
          {
            id: `save-${Date.now()}`,
            level: "build",
            message: `Saved ${currentFilePath} (${data.size} bytes).`,
            timestamp: Date.now(),
          },
        ]);

        if (autoReloadPreview && (currentFilePath.endsWith(".html") || currentFilePath.endsWith(".css") || currentFilePath.endsWith(".js"))) {
          buildProjectPreview();
        }
      } else {
        toast.error(data.error || "Failed to save file");
        playWarningSound();
      }
    } catch {
      toast.error("Network error saving file");
      playWarningSound();
    } finally {
      setIsSaving(false);
    }
  };

  // Revert active file changes
  const handleRevertActiveFile = () => {
    if (!activeTab) return;
    handleCodeChange(activeTab.originalContent);
    setIsDiffMode(false);
    toast.info("Reverted file changes");
  };

  // Save All dirty tabs
  const handleSaveAllTabs = async () => {
    const dirtyTabs = tabs.filter((t) => t.isDirty);
    if (dirtyTabs.length === 0) {
      toast.info("All files are up to date.");
      return;
    }

    try {
      for (const t of dirtyTabs) {
        const targetPath = `${projectBasePath}/${t.path.replace(/^[/\\]+/, "").trim()}`;
        await fetch("/api/filesystem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "write_file",
            path: targetPath,
            content: t.content,
          }),
        });
      }
      setTabs((prev) =>
        prev.map((t) => ({ ...t, originalContent: t.content, isDirty: false }))
      );
      toast.success(`Saved all ${dirtyTabs.length} modified files!`);
      playTaskCompletedSound();
      loadProjectTree();
      buildProjectPreview();
    } catch {
      toast.error("Error saving all files");
    }
  };

  // Format active document
  const handleFormatCode = () => {
    const formatted = formatCodeSnippet(code, language);
    if (formatted !== code) {
      handleCodeChange(formatted);
      toast.success("Document formatted");
      playClickSound();
    } else {
      toast.info("Document already formatted");
    }
  };

  // 7. Create New Project Workspace with Template
  const handleCreateProjectWithTemplate = async (name: string, template: ProjectTemplateType) => {
    try {
      const res = await fetch("/api/filesystem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_project",
          name,
          template,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Project "${name}" created with ${template} template!`);
        playTaskCompletedSound();
        await loadProjects();
        handleSelectProject(name);
      } else {
        toast.error(data.error || "Failed to create project");
        playWarningSound();
      }
    } catch {
      toast.error("Error creating project folder");
      playWarningSound();
    }
  };

  // 8. Delete entire project workspace
  const handleDeleteProject = async () => {
    if (!selectedProject || selectedProject === "default-project") {
      toast.error("Default workspace cannot be deleted");
      return;
    }

    setIsDeletingProject(true);
    try {
      const targetPath = `agent-workspace/${selectedProject}`;
      const res = await fetch(`/api/filesystem?path=${encodeURIComponent(targetPath)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(`Deleted project workspace "${selectedProject}"`);
        setShowDeleteProjectModal(false);
        await loadProjects();
        handleSelectProject("default-project");
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to delete project");
      }
    } catch {
      toast.error("Network error deleting project");
    } finally {
      setIsDeletingProject(false);
    }
  };

  // 9. Download Project as ZIP
  const handleExportZip = () => {
    playClickSound();
    toast.info(`Packaging "${selectedProject}" as ZIP...`);
    const zipUrl = `/api/filesystem?action=zip&path=${encodeURIComponent(projectBasePath)}`;
    const a = document.createElement("a");
    a.href = zipUrl;
    a.download = `${selectedProject}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // 10. Duplicate File or Folder
  const handleDuplicateItem = async (relPath: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    playClickSound();
    try {
      const targetPath = `${projectBasePath}/${relPath.replace(/^[/\\]+/, "").trim()}`;
      const res = await fetch("/api/filesystem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "duplicate",
          path: targetPath,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Duplicated item to "${data.newPath}"`);
        loadProjectTree();
      } else {
        toast.error(data.error || "Failed to duplicate item");
      }
    } catch {
      toast.error("Error duplicating item");
    }
  };

  // 11. Upload Local Files into Project
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    playClickSound();
    let uploadedCount = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const text = await file.text();
        const targetPath = `${projectBasePath}/${file.name}`;
        const res = await fetch("/api/filesystem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create_file",
            path: targetPath,
            content: text,
          }),
        });
        if (res.ok) uploadedCount++;
      } catch (err) {
        console.warn("Upload failed for:", file.name, err);
      }
    }

    if (uploadedCount > 0) {
      toast.success(`Uploaded ${uploadedCount} file(s) into ${selectedProject}`);
      playTaskCompletedSound();
      loadProjectTree();
    }
    e.target.value = "";
  };

  // 12. Create New File
  const handleCreateNewFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFilePathInput.trim()) return;

    try {
      const cleanRel = newFilePathInput.replace(/^[/\\]+/, "").trim();
      const targetPath = `${projectBasePath}/${cleanRel}`;
      const initialContent = cleanRel.endsWith(".html")
        ? "<!DOCTYPE html>\n<html>\n<head><title>Page</title></head>\n<body>\n  <h1>New Page</h1>\n</body>\n</html>\n"
        : cleanRel.endsWith(".css")
        ? "/* Styles */\nbody { margin: 0; }\n"
        : cleanRel.endsWith(".json")
        ? '{\n  "name": "new-file"\n}\n'
        : "// New project file\n";

      const res = await fetch("/api/filesystem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_file",
          path: targetPath,
          content: initialContent,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Created "${cleanRel}"`);
        setNewFilePathInput("");
        setShowNewFileDialog(false);
        await loadProjectTree();
        openFileInTab(cleanRel);
      } else {
        toast.error(data.error || "Failed to create file");
      }
    } catch {
      toast.error("Error creating file");
    }
  };

  // 13. Create New Folder
  const handleCreateNewFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderPathInput.trim()) return;

    try {
      const cleanRel = newFolderPathInput.replace(/^[/\\]+/, "").trim();
      const targetPath = `${projectBasePath}/${cleanRel}`;
      const res = await fetch("/api/filesystem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_folder",
          path: targetPath,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Created folder "${cleanRel}"`);
        setNewFolderPathInput("");
        setShowNewFolderDialog(false);
        loadProjectTree();
      } else {
        toast.error(data.error || "Failed to create folder");
      }
    } catch {
      toast.error("Error creating folder");
    }
  };

  // 14. Delete File or Folder
  const handleDeleteItem = async (relPath: string, isFolder: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete "${relPath}"?`)) return;

    try {
      const targetPath = `${projectBasePath}/${relPath.replace(/^[/\\]+/, "")}`;
      const res = await fetch(`/api/filesystem?path=${encodeURIComponent(targetPath)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(`Deleted ${isFolder ? "folder" : "file"} "${relPath}"`);
        handleCloseTab(relPath);
        loadProjectTree();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to delete");
      }
    } catch {
      toast.error("Network error deleting item");
    }
  };

  // 15. Rename File or Folder
  const openRenameDialog = (relPath: string, isFolder: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameTarget({ path: relPath, isFolder });
    setRenameNewPathInput(relPath);
    setShowRenameDialog(true);
  };

  const handleRenameItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || !renameNewPathInput.trim()) return;
    const oldRel = renameTarget.path.replace(/^[/\\]+/, "").trim();
    const newRel = renameNewPathInput.replace(/^[/\\]+/, "").trim();

    if (oldRel === newRel) {
      setShowRenameDialog(false);
      return;
    }

    setIsRenaming(true);
    try {
      const oldFullPath = `${projectBasePath}/${oldRel}`;
      const newFullPath = `${projectBasePath}/${newRel}`;

      const res = await fetch("/api/filesystem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rename",
          oldPath: oldFullPath,
          newPath: newFullPath,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Renamed to "${newRel}"`);
        // Update active tab path if affected
        setTabs((prev) =>
          prev.map((t) =>
            t.path === oldRel
              ? {
                  ...t,
                  path: newRel,
                  name: newRel.split("/").pop() || newRel,
                  language: getLanguageForFile(newRel).id,
                }
              : t
          )
        );
        if (activeTabPath === oldRel) setActiveTabPath(newRel);

        setShowRenameDialog(false);
        setRenameTarget(null);
        setRenameNewPathInput("");
        loadProjectTree();
      } else {
        toast.error(data.error || "Failed to rename item");
      }
    } catch {
      toast.error("Error renaming item");
    } finally {
      setIsRenaming(false);
    }
  };

  // 16. Build Sandboxed HTML/CSS/JS Project Preview
  const buildProjectPreview = useCallback(async () => {
    try {
      let htmlContent = "";
      if (currentFilePath.endsWith(".html") && code.trim()) {
        htmlContent = code;
      } else {
        const res = await fetch(
          `/api/filesystem?action=read&path=${encodeURIComponent(`${projectBasePath}/index.html`)}`
        );
        if (res.ok) {
          const data = await res.json();
          htmlContent = data.content;
        } else if (currentFilePath.endsWith(".html")) {
          htmlContent = code;
        }
      }

      if (!htmlContent || htmlContent.startsWith("//")) {
        setPreviewHtml(
          `<div style="font-family:system-ui,-apple-system,sans-serif;display:grid;place-content:center;height:100vh;margin:0;background:#09090b;color:#a1a1aa;text-align:center;padding:2rem;">
            <div style="max-width:380px;padding:2rem;background:#18181b;border-radius:1rem;border:1px solid #27272a;">
              <div style="font-size:42px;margin-bottom:12px;">⚡</div>
              <h3 style="color:#fafafa;margin-top:0;font-size:16px;font-weight:600;">No Preview Available</h3>
              <p style="font-size:13px;line-height:1.6;color:#71717a;">Create an <code style="background:#27272a;color:#38bdf8;padding:2px 6px;border-radius:4px;font-size:12px;">index.html</code> file or ask the AI agent to generate your application.</p>
            </div>
          </div>`
        );
        return;
      }

      let bundled = htmlContent;

      // Inline linked stylesheets
      const linkRegex = /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["'][^>]*>/gi;
      let match;
      while ((match = linkRegex.exec(htmlContent)) !== null) {
        const fullTag = match[0];
        const href = match[1];
        if (!href.startsWith("http://") && !href.startsWith("https://") && !href.startsWith("//")) {
          try {
            const cssPath = `${projectBasePath}/${href.replace(/^[/\\]+/, "")}`;
            // If linked file is currently open with unsaved changes, use in-memory content!
            const openTabMatch = tabs.find((t) => t.path === href.replace(/^[/\\]+/, ""));
            let cssContent = openTabMatch ? openTabMatch.content : "";
            if (!cssContent) {
              const cssRes = await fetch(`/api/filesystem?action=read&path=${encodeURIComponent(cssPath)}`);
              if (cssRes.ok) {
                const cssData = await cssRes.json();
                cssContent = cssData.content;
              }
            }
            if (cssContent) {
              bundled = bundled.replace(fullTag, `<style>/* ${href} */\n${cssContent}\n</style>`);
            }
          } catch {}
        }
      }

      // Inline linked local scripts
      const scriptRegex = /<script[^>]+src=["']([^"']+)["'][^>]*><\/script>/gi;
      while ((match = scriptRegex.exec(htmlContent)) !== null) {
        const fullTag = match[0];
        const src = match[1];
        if (!src.startsWith("http://") && !src.startsWith("https://") && !src.startsWith("//")) {
          try {
            const jsPath = `${projectBasePath}/${src.replace(/^[/\\]+/, "")}`;
            const openTabMatch = tabs.find((t) => t.path === src.replace(/^[/\\]+/, ""));
            let jsContent = openTabMatch ? openTabMatch.content : "";
            if (!jsContent) {
              const jsRes = await fetch(`/api/filesystem?action=read&path=${encodeURIComponent(jsPath)}`);
              if (jsRes.ok) {
                const jsData = await jsRes.json();
                jsContent = jsData.content;
              }
            }
            if (jsContent) {
              bundled = bundled.replace(fullTag, `<script>/* ${src} */\n${jsContent}\n</script>`);
            }
          } catch {}
        }
      }

      // Inject Console Bridge and Safety Headers
      const safetyHeadInjection = `<base target="_blank"><script>window.addEventListener('click',function(e){var a=e.target.closest('a');if(a&&a.getAttribute('href')&&!a.getAttribute('href').startsWith('#')){a.target='_blank';}},true);</script>${PREVIEW_CONSOLE_BRIDGE_SCRIPT}`;
      if (bundled.includes("<head>")) {
        bundled = bundled.replace("<head>", `<head>${safetyHeadInjection}`);
      } else {
        bundled = `${safetyHeadInjection}${bundled}`;
      }

      // Dark Mode class inject
      if (previewDarkMode && !bundled.includes('class="dark"')) {
        bundled = bundled.replace("<body", '<body class="dark"');
      }

      setPreviewHtml(bundled);
    } catch (err) {
      console.error("Preview bundle error:", err);
      setPreviewHtml(
        `<div style="font-family:system-ui;padding:2rem;color:red;">Error loading project preview</div>`
      );
    }
  }, [code, currentFilePath, projectBasePath, tabs, previewDarkMode]);

  useEffect(() => {
    if (activeArtifactTab === "preview" || activeArtifactTab === "split") {
      buildProjectPreview();
    }
  }, [activeArtifactTab, buildProjectPreview]);

  // Console message listener from preview iframe
  useEffect(() => {
    const handleWindowMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === "preview-console") {
        const newEntry: ConsoleEntry = {
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          level: e.data.level || "log",
          message: e.data.message || "",
          timestamp: e.data.timestamp || Date.now(),
        };
        setConsoleEntries((prev) => [...prev.slice(-150), newEntry]);
      }
    };

    window.addEventListener("message", handleWindowMessage);
    return () => window.removeEventListener("message", handleWindowMessage);
  }, []);

  // Run code evaluation in sandboxed iframe via REPL
  const handleRunEvalInPreview = (evalCode: string) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: "preview-eval", code: evalCode }, "*");
    } else {
      toast.info("Switch to Preview or Split tab to evaluate JavaScript in sandbox.");
    }
  };

  // Open Preview in External Browser Tab
  const handleOpenPreviewNewTab = () => {
    if (!previewHtml) return;
    playClickSound();
    const blob = new Blob([previewHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  // Listen for global build completion events
  useEffect(() => {
    const handleBuildCompleted = (e: any) => {
      const detail: BuildCompletedEventDetail = e.detail;
      if (!detail) return;

      if (detail.projectName === selectedProject) {
        playTaskCompletedSound();
        if (detail.primaryFile) {
          openFileInTab(detail.primaryFile.path);
        }
        if (detail.projectTree) {
          setFileTree(detail.projectTree);
        } else {
          loadProjectTree();
        }
        buildProjectPreview();

        setConsoleEntries((prev) => [
          ...prev,
          {
            id: `build-complete-${Date.now()}`,
            level: "build",
            message: `AI build completed: ${detail.createdFiles?.length || 0} files generated.`,
            timestamp: Date.now(),
          },
        ]);
      }
    };

    window.addEventListener("project-build-completed", handleBuildCompleted);
    return () => window.removeEventListener("project-build-completed", handleBuildCompleted);
  }, [selectedProject, buildProjectPreview, loadProjectTree, openFileInTab]);

  // AI Multi-File Autonomous Generation
  const handleGenerate = async (e?: React.FormEvent, customPrompt?: string) => {
    e?.preventDefault();
    const textToSend = (customPrompt || prompt).trim();
    if (!textToSend || isGenerating) return;

    setPrompt("");
    playTaskStartedSound();

    setConsoleEntries((prev) => [
      ...prev,
      {
        id: `ai-start-${Date.now()}`,
        level: "build",
        message: `Agent started generation with prompt: "${textToSend.slice(0, 60)}..."`,
        timestamp: Date.now(),
      },
    ]);

    const res = await startGeneration({
      prompt: textToSend,
      projectName: selectedProject,
      projectPath: projectBasePath,
      targetFolder: targetFolderScope || undefined,
      currentFilePath,
      currentCode: code,
      history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
    });

    if (res.success && res.data) {
      playTaskCompletedSound();
      const data = res.data;
      if (Array.isArray(data.createdFiles) && data.createdFiles.length > 0) {
        if (data.primaryFile) {
          openFileInTab(data.primaryFile.path);
        }
      }
      if (data.projectTree) {
        setFileTree(data.projectTree);
      } else {
        await loadProjectTree();
      }
      buildProjectPreview();
    } else {
      playWarningSound();
    }
  };

  // Keybindings (Ctrl+S = Save, Ctrl+F = Find, Ctrl+W = Close Tab, Tab = Indent, Shift+Alt+F = Format)
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      handleSaveToProject();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === "f") {
      e.preventDefault();
      setIsSearchOpen(true);
      return;
    }

    if (e.shiftKey && e.altKey && e.key.toLowerCase() === "f") {
      e.preventDefault();
      handleFormatCode();
      return;
    }

    if (e.key === "Tab") {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newCode = code.substring(0, start) + "  " + code.substring(end);
      handleCodeChange(newCode);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
  };

  const handleCursorUpdate = (e: any) => {
    const target = e.target as HTMLTextAreaElement;
    const pos = target.selectionStart;
    const textBefore = code.slice(0, pos);
    const lines = textBefore.split("\n");
    const currentLine = lines.length;
    const currentCol = lines[lines.length - 1].length + 1;
    setCursorPos({ line: currentLine, col: currentCol });
    setSelectionLen(Math.abs(target.selectionEnd - target.selectionStart));
  };

  // Filtered files in tree view
  const filteredTree = useMemo(() => {
    if (!fileFilterQuery.trim()) return fileTree;
    const query = fileFilterQuery.toLowerCase();

    const filterNodes = (nodes: FileTreeNode[]): FileTreeNode[] => {
      return nodes
        .map((node) => {
          if (node.isDirectory) {
            const filteredChildren = node.children ? filterNodes(node.children) : [];
            if (filteredChildren.length > 0 || node.name.toLowerCase().includes(query)) {
              return { ...node, children: filteredChildren };
            }
            return null;
          } else {
            return node.name.toLowerCase().includes(query) ? node : null;
          }
        })
        .filter(Boolean) as FileTreeNode[];
    };

    return filterNodes(fileTree);
  }, [fileTree, fileFilterQuery]);

  // Render tree node recursively
  const renderTreeNode = (node: FileTreeNode, depth = 0) => {
    const isExpanded = expandedFolders[node.path] ?? true;
    const displayRelPath = node.path.startsWith(projectBasePath)
      ? node.path.slice(projectBasePath.length).replace(/^[/\\]+/, "")
      : node.path;
    const isCurrentFile = currentFilePath === displayRelPath;
    const fileMeta = getLanguageForFile(node.name);

    if (node.isDirectory) {
      return (
        <div key={node.path} className="select-none">
          <div className="flex items-center justify-between group rounded-lg hover:bg-[var(--muted)]/60 transition-colors pr-1.5 py-[3px]">
            <button
              type="button"
              onClick={() =>
                setExpandedFolders((prev) => ({ ...prev, [node.path]: !prev[node.path] }))
              }
              style={{ paddingLeft: `${depth * 12 + 6}px` }}
              className="flex-1 flex items-center gap-1.5 py-0.5 text-left text-[12px] font-medium text-[var(--foreground)] cursor-pointer truncate"
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3 text-[var(--muted-foreground)] shrink-0" />
              ) : (
                <ChevronRight className="w-3 h-3 text-[var(--muted-foreground)] shrink-0" />
              )}
              <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="truncate">{node.name}</span>
            </button>

            {/* Folder Actions */}
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setTargetFolderScope(displayRelPath);
                  toast.info(`Target scope set to "${displayRelPath}"`);
                }}
                className={`p-1 transition cursor-pointer rounded ${
                  targetFolderScope === displayRelPath ? "text-[var(--primary)] font-bold" : "hover:text-[var(--primary)] text-[var(--muted-foreground)]"
                }`}
                title={`Target "${node.name}" for AI additions`}
              >
                <Target className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setNewFilePathInput(`${displayRelPath}/`);
                  setShowNewFileDialog(true);
                }}
                className="p-1 hover:text-blue-500 text-[var(--muted-foreground)] transition cursor-pointer rounded"
                title="Add file inside folder"
              >
                <FilePlus className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={(e) => openRenameDialog(displayRelPath, true, e)}
                className="p-1 hover:text-[var(--primary)] text-[var(--muted-foreground)] transition cursor-pointer rounded"
                title="Rename folder"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={(e) => handleDeleteItem(displayRelPath, true, e)}
                className="p-1 hover:text-red-500 text-[var(--muted-foreground)] transition cursor-pointer rounded"
                title="Delete folder"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
          {isExpanded && node.children && (
            <div>
              {node.children.map((child) => renderTreeNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        key={node.path}
        className={`flex items-center justify-between group rounded-lg transition-colors pr-1.5 py-[3px] ${
          isCurrentFile
            ? "bg-[var(--primary)]/10 text-[var(--primary)] font-medium"
            : "hover:bg-[var(--muted)]/60 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        }`}
      >
        <button
          type="button"
          onClick={() => openFileInTab(node.path)}
          style={{ paddingLeft: `${depth * 12 + 18}px` }}
          className="flex-1 flex items-center gap-1.5 py-0.5 text-left text-[12px] transition cursor-pointer truncate"
        >
          <span className="text-xs shrink-0">{fileMeta.icon}</span>
          <span className="truncate">{node.name}</span>
          {node.size !== undefined && (
            <span className="text-[10px] opacity-40 font-mono ml-auto mr-1">
              {(node.size / 1024).toFixed(1)}k
            </span>
          )}
        </button>

        {/* File Actions */}
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
          <button
            type="button"
            onClick={(e) => handleDuplicateItem(displayRelPath, e)}
            className="p-1 hover:text-emerald-500 text-[var(--muted-foreground)] transition cursor-pointer rounded"
            title="Duplicate file"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={(e) => openRenameDialog(displayRelPath, false, e)}
            className="p-1 hover:text-[var(--primary)] text-[var(--muted-foreground)] transition cursor-pointer rounded"
            title="Rename file"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={(e) => handleDeleteItem(displayRelPath, false, e)}
            className="p-1 hover:text-red-500 text-[var(--muted-foreground)] transition cursor-pointer rounded"
            title="Delete file"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  };

  // Quick prompt suggestions
  const PROMPT_CHIPS = [
    { label: "✨ Enhance UI", prompt: "Polish and elevate the UI design with modern aesthetics, subtle gradients, and sleek typography." },
    { label: "🐛 Fix Bugs", prompt: "Audit the codebase for potential syntax errors, unhandled edge cases, or broken logic, and fix them." },
    { label: "📱 Make Responsive", prompt: "Ensure all components adapt seamlessly to mobile, tablet, and desktop viewports with fluid CSS." },
    { label: "🌙 Dark Mode", prompt: "Add first-class dark mode support with tailored color tokens and theme toggle state." },
    { label: "⚡ Add Animations", prompt: "Add smooth micro-interactions, hover effects, and spring transitions to interactive elements." },
    { label: "🧪 Add Unit Tests", prompt: "Generate comprehensive unit test coverage with clear test assertions and mocks." },
    { label: "📖 Add README", prompt: "Create a complete README.md with project architecture, feature breakdown, and setup steps." },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] min-h-0 -mx-3 sm:-mx-6 lg:-mx-8 -my-3 sm:-my-5 bg-[var(--background)]">
      {/* Hidden file upload input */}
      <input
        type="file"
        multiple
        ref={fileUploadInputRef}
        onChange={handleFileUpload}
        className="hidden"
      />

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* ─── LEFT PANEL: Chat Assistant + File Explorer ─── */}
        <div
          className={`flex flex-col min-h-0 border-r border-[var(--border)] bg-[var(--card)] transition-all duration-300 ${
            artifactExpanded ? "w-0 overflow-hidden" : "w-full lg:w-[380px] xl:w-[440px] shrink-0 min-w-0"
          }`}
        >
          {/* Left Panel Top Header */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--border)] shrink-0 bg-[var(--card)]">
            <div className="flex items-center gap-2 min-w-0">
              {/* Project Workspace Selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowProjectDropdown((prev) => !prev)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[var(--muted)]/70 hover:bg-[var(--muted)] text-[12.5px] font-semibold text-[var(--foreground)] transition cursor-pointer border border-[var(--border)]"
                >
                  <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="truncate max-w-[140px]">{selectedProject}</span>
                  <ChevronDown className="w-3 h-3 text-[var(--muted-foreground)]" />
                </button>

                {/* Project Dropdown */}
                <AnimatePresence>
                  {showProjectDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.98 }}
                      transition={{ duration: 0.12 }}
                      className="absolute left-0 top-full mt-1.5 z-50 w-72 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl p-2 space-y-1"
                    >
                      <div className="px-2 py-1 flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                          Workspaces
                        </span>
                        <span className="text-[11px] text-[var(--muted-foreground)] font-mono">{projects.length} total</span>
                      </div>

                      {/* Project Search */}
                      <div className="px-1 pb-1">
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[12px]">
                          <Search className="w-3 h-3 text-[var(--muted-foreground)]" />
                          <input
                            type="text"
                            value={projectSearchQuery}
                            onChange={(e) => setProjectSearchQuery(e.target.value)}
                            placeholder="Filter workspaces..."
                            className="w-full bg-transparent outline-none text-[11.5px]"
                          />
                        </div>
                      </div>

                      {/* Projects List */}
                      <div className="max-h-56 overflow-y-auto space-y-0.5 scrollbar-thin">
                        {projects
                          .filter((p) => p.name.toLowerCase().includes(projectSearchQuery.toLowerCase()))
                          .map((proj) => (
                            <button
                              key={proj.name}
                              onClick={() => handleSelectProject(proj.name)}
                              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[12px] transition cursor-pointer ${
                                selectedProject === proj.name
                                  ? "bg-[var(--primary)]/10 text-[var(--primary)] font-semibold"
                                  : "hover:bg-[var(--muted)] text-[var(--foreground)]"
                              }`}
                            >
                              <span className="flex items-center gap-2 truncate">
                                <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <span className="truncate">{proj.name}</span>
                              </span>
                              <span className="text-[10px] text-[var(--muted-foreground)] font-mono">
                                {proj.fileCount} files
                              </span>
                            </button>
                          ))}
                      </div>

                      <div className="border-t border-[var(--border)] pt-1 mt-1 space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            setShowProjectDropdown(false);
                            setShowNewProjectModal(true);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[12px] text-[var(--primary)] font-medium hover:bg-[var(--primary)]/5 transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>New Workspace (with Templates)</span>
                        </button>
                        {selectedProject !== "default-project" && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowProjectDropdown(false);
                              setShowDeleteProjectModal(true);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[12px] text-red-500 font-medium hover:bg-red-500/5 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete &quot;{selectedProject}&quot;</span>
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Export ZIP Button */}
              <button
                type="button"
                onClick={handleExportZip}
                className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition cursor-pointer"
                title="Download entire project as ZIP"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Toggle File Explorer */}
              <button
                type="button"
                onClick={() => setShowFileExplorer((prev) => !prev)}
                className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition cursor-pointer"
                title="Toggle file explorer"
              >
                {showFileExplorer ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 flex overflow-hidden">
            {/* File Explorer Sidebar */}
            <AnimatePresence>
              {showFileExplorer && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 190, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="border-r border-[var(--border)] bg-[var(--card)] flex flex-col min-h-0 overflow-hidden shrink-0"
                >
                  {/* Explorer Header */}
                  <div className="p-2 border-b border-[var(--border)] space-y-1.5 shrink-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                        Files ({flatFileList.length})
                      </span>
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setNewFilePathInput("");
                            setShowNewFileDialog(true);
                          }}
                          className="p-1 text-[var(--muted-foreground)] hover:text-blue-500 rounded transition cursor-pointer"
                          title="New file"
                        >
                          <FilePlus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNewFolderPathInput("");
                            setShowNewFolderDialog(true);
                          }}
                          className="p-1 text-[var(--muted-foreground)] hover:text-amber-500 rounded transition cursor-pointer"
                          title="New folder"
                        >
                          <FolderPlus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => fileUploadInputRef.current?.click()}
                          className="p-1 text-[var(--muted-foreground)] hover:text-emerald-500 rounded transition cursor-pointer"
                          title="Upload files"
                        >
                          <Upload className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={loadProjectTree}
                          disabled={isLoadingTree}
                          className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] rounded transition cursor-pointer"
                          title="Refresh tree"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTree ? "animate-spin" : ""}`} />
                        </button>
                      </div>
                    </div>

                    {/* Quick File Filter */}
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[11px]">
                      <Search className="w-3 h-3 text-[var(--muted-foreground)] shrink-0" />
                      <input
                        type="text"
                        value={fileFilterQuery}
                        onChange={(e) => setFileFilterQuery(e.target.value)}
                        placeholder="Search files..."
                        className="w-full bg-transparent outline-none text-[11px]"
                      />
                      {fileFilterQuery && (
                        <button onClick={() => setFileFilterQuery("")} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* File Tree Items */}
                  <div className="flex-1 overflow-y-auto p-1 scrollbar-thin">
                    {isLoadingTree && fileTree.length === 0 ? (
                      <div className="p-4 text-center text-[12px] text-[var(--muted-foreground)] flex items-center justify-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Loading files...</span>
                      </div>
                    ) : filteredTree.length > 0 ? (
                      filteredTree.map((node) => renderTreeNode(node, 0))
                    ) : (
                      <div className="p-4 text-center text-[12px] text-[var(--muted-foreground)] space-y-2">
                        <Folder className="w-6 h-6 mx-auto opacity-30 text-amber-500" />
                        <p className="font-medium text-[var(--foreground)] text-[12px]">
                          {fileFilterQuery ? "No matching files" : "Empty project"}
                        </p>
                        <p className="text-[11px]">
                          {fileFilterQuery ? "Try a different search term" : "Ask AI to generate files or create one."}
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Chat Assistant Section */}
            <div className="flex-1 min-w-0 flex flex-col min-h-0 bg-[var(--background)] overflow-hidden">
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 scrollbar-thin">
                {messages.length === 0 && (
                  <div className="pt-10 pb-6 text-center space-y-4 max-w-sm mx-auto">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 flex items-center justify-center text-amber-500 shadow-lg shadow-amber-500/10">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-[15px] font-semibold text-[var(--foreground)]">
                        Autonomous Project Builder
                      </h2>
                      <p className="text-[12.5px] text-[var(--muted-foreground)] mt-1 leading-relaxed">
                        Ask the AI to build complete multi-file applications in{" "}
                        <span className="font-mono text-[var(--primary)] font-medium text-[11.5px]">{selectedProject}</span>.
                      </p>
                    </div>

                    {/* Quick Starter Suggestions */}
                    <div className="space-y-2 pt-2">
                      {[
                        { icon: "⚡", title: "Build a Weather Forecast app with interactive charts" },
                        { icon: "📊", title: "Create a modern Analytics Dashboard with simulated metrics" },
                        { icon: "🎮", title: "Build a retro Brick Breaker Arcade game on HTML5 Canvas" },
                      ].map((item, i) => (
                        <button
                          key={i}
                          onClick={() => setPrompt(item.title)}
                          className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/40 text-left text-[12.5px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition cursor-pointer"
                        >
                          <span className="text-base shrink-0">{item.icon}</span>
                          <span className="leading-snug">{item.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Conversation Messages */}
                {messages.map((msg) => (
                  <div key={msg.id} className="min-w-0 max-w-full">
                    {msg.role === "user" ? (
                      <div className="flex justify-end">
                        <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-br-sm bg-[var(--primary)] text-white text-[13px] leading-relaxed break-words">
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="text-[13px] leading-relaxed text-[var(--foreground)] break-words">
                          <MarkdownRenderer content={msg.content} />
                        </div>

                        {/* Created Files Card */}
                        {msg.createdFiles && msg.createdFiles.length > 0 && (
                          <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] space-y-2">
                            <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--foreground)]">
                              <Layers className="w-3.5 h-3.5 text-[var(--primary)]" />
                              <span>{msg.createdFiles.length} file(s) generated</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {msg.createdFiles.map((f, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => openFileInTab(f.path)}
                                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--muted)] text-[11.5px] font-mono hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] transition cursor-pointer"
                                  title={`Open ${f.path}`}
                                >
                                  <FileCode className="w-3 h-3 text-[var(--primary)]" />
                                  <span className="truncate">{f.path}</span>
                                </button>
                              ))}
                            </div>
                            {msg.createdFiles.some((f) => f.path.endsWith(".html")) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveArtifactTab("preview");
                                  buildProjectPreview();
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11.5px] font-medium border border-emerald-500/20 transition cursor-pointer mt-1"
                              >
                                <Play className="w-3 h-3" />
                                <span>Preview Live Build</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {isGenerating && (
                  <div className="flex items-center gap-2.5 py-2 text-[12px] text-[var(--muted-foreground)]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--primary)]" />
                    <span>AI agent is synthesizing and generating project files...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Chat Bottom Input & Quick Chips */}
              <div className="border-t border-[var(--border)] bg-[var(--card)] p-3 space-y-2 shrink-0">
                {/* Quick Action Prompt Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {PROMPT_CHIPS.map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleGenerate(undefined, chip.prompt)}
                      disabled={isGenerating}
                      className="px-2 py-0.5 rounded-full bg-[var(--muted)] hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] text-[11px] font-medium whitespace-nowrap transition cursor-pointer shrink-0 disabled:opacity-40"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                {targetFolderScope && (
                  <div className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-[var(--primary)]/10 text-[11px] text-[var(--primary)]">
                    <span className="flex items-center gap-1.5 truncate">
                      <Target className="w-3 h-3 shrink-0" />
                      <span>Scoped to: <strong>{targetFolderScope}/</strong></span>
                    </span>
                    <button onClick={() => setTargetFolderScope("")} className="hover:text-[var(--foreground)]">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                <form onSubmit={handleGenerate} className="relative">
                  <div className="relative flex items-end bg-[var(--background)] border border-[var(--border)] rounded-2xl focus-within:border-[var(--primary)]/50 focus-within:shadow-sm transition">
                    <textarea
                      ref={promptInputRef}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleGenerate(e as any);
                        }
                      }}
                      placeholder={targetFolderScope ? `Add files to ${targetFolderScope}/...` : "Describe what you want to build..."}
                      disabled={isGenerating}
                      rows={1}
                      className="flex-1 bg-transparent px-3 py-2.5 text-[13px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none resize-none min-h-[42px] max-h-[120px] leading-relaxed"
                    />
                    <div className="px-2 pb-2">
                      <button
                        type="submit"
                        disabled={isGenerating || !prompt.trim()}
                        className="p-2 rounded-xl bg-[var(--primary)] text-white hover:opacity-90 disabled:opacity-30 transition cursor-pointer shrink-0 flex items-center justify-center"
                      >
                        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* ─── RIGHT PANEL: Multi-Tab Editor + Live Sandboxed Preview ─── */}
        <div
          className={`flex flex-col min-h-0 bg-[var(--card)] transition-all duration-300 relative ${
            artifactExpanded ? "flex-1" : "hidden lg:flex flex-1"
          }`}
        >
          {/* Top Artifact Header Bar */}
          <div className="flex items-center justify-between gap-1.5 px-3 py-1.5 border-b border-[var(--border)] bg-[var(--card)] shrink-0 select-none overflow-x-auto scrollbar-none min-w-0">
            {/* Left: View Tabs (Code, Split, Preview) */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="flex items-center bg-[var(--muted)] p-0.5 rounded-lg text-[12px]">
                <button
                  type="button"
                  onClick={() => {
                    setActiveArtifactTab("code");
                    setIsDiffMode(false);
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                    activeArtifactTab === "code" && !isDiffMode
                      ? "bg-[var(--card)] text-[var(--foreground)] shadow-xs"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  }`}
                  title="Code Editor"
                >
                  <Code className="w-3.5 h-3.5" />
                  <span>Editor</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveArtifactTab("split");
                    setIsDiffMode(false);
                    buildProjectPreview();
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                    activeArtifactTab === "split"
                      ? "bg-[var(--card)] text-[var(--foreground)] shadow-xs"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  }`}
                  title="Side-by-side Editor & Live Preview"
                >
                  <Columns2 className="w-3.5 h-3.5" />
                  <span>Split</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveArtifactTab("preview");
                    setIsDiffMode(false);
                    buildProjectPreview();
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                    activeArtifactTab === "preview"
                      ? "bg-[var(--card)] text-[var(--foreground)] shadow-xs"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  }`}
                  title="Full Live Preview"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview</span>
                </button>
              </div>

              {/* Diff / Changes Mode Toggle */}
              <button
                type="button"
                onClick={() => setIsDiffMode((prev) => !prev)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[12px] font-medium transition cursor-pointer border shrink-0 ${
                  isDiffMode
                    ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-xs"
                    : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]"
                }`}
                title="View local differences"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>Diff</span>
              </button>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1 shrink-0 ml-auto">
              {activeArtifactTab !== "preview" && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsSearchOpen((prev) => !prev)}
                    className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] rounded-lg transition cursor-pointer shrink-0"
                    title="Find & Replace (Ctrl+F)"
                  >
                    <Search className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={handleFormatCode}
                    className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] rounded-lg transition cursor-pointer shrink-0"
                    title="Format Code (Shift+Alt+F)"
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(code);
                      toast.success("Code copied to clipboard");
                    }}
                    className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] rounded-lg transition cursor-pointer shrink-0"
                    title="Copy code"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveToProject}
                    disabled={isSaving}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--primary)] text-white text-[12px] font-medium hover:opacity-90 disabled:opacity-40 transition cursor-pointer shrink-0"
                    title="Save active file (Ctrl+S)"
                  >
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">Save</span>
                  </button>
                </>
              )}

              {(activeArtifactTab === "preview" || activeArtifactTab === "split") && (
                <>
                  {/* Viewport Switcher */}
                  <div className="flex items-center bg-[var(--muted)] p-0.5 rounded-lg border border-[var(--border)] shrink-0">
                    <button
                      type="button"
                      onClick={() => setPreviewViewport("desktop")}
                      className={`p-1 rounded transition cursor-pointer ${
                        previewViewport === "desktop" ? "bg-[var(--card)] text-[var(--foreground)] shadow-xs" : "text-[var(--muted-foreground)]"
                      }`}
                      title="Desktop (100%)"
                    >
                      <Monitor className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewViewport("tablet")}
                      className={`p-1 rounded transition cursor-pointer ${
                        previewViewport === "tablet" ? "bg-[var(--card)] text-[var(--foreground)] shadow-xs" : "text-[var(--muted-foreground)]"
                      }`}
                      title="Tablet (768px)"
                    >
                      <Tablet className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewViewport("mobile")}
                      className={`p-1 rounded transition cursor-pointer ${
                        previewViewport === "mobile" ? "bg-[var(--card)] text-[var(--foreground)] shadow-xs" : "text-[var(--muted-foreground)]"
                      }`}
                      title="Mobile (375px)"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Dark Mode toggle for preview */}
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewDarkMode((prev) => !prev);
                      setTimeout(buildProjectPreview, 50);
                    }}
                    className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] rounded-lg transition cursor-pointer shrink-0"
                    title="Toggle preview dark/light theme"
                  >
                    {previewDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={buildProjectPreview}
                    className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] rounded-lg transition cursor-pointer shrink-0"
                    title="Reload preview"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenPreviewNewTab}
                    className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] rounded-lg transition cursor-pointer shrink-0"
                    title="Open preview in new browser tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </>
              )}

              <div className="w-px h-4 bg-[var(--border)] mx-0.5 shrink-0" />

              <button
                type="button"
                onClick={() => setArtifactExpanded((prev) => !prev)}
                className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] rounded-lg transition cursor-pointer shrink-0"
                title={artifactExpanded ? "Show chat panel" : "Maximize editor"}
              >
                {artifactExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* ─── TABS BAR (when in Editor or Split mode) ─── */}
          {activeArtifactTab !== "preview" && !isDiffMode && (
            <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--muted)]/40 px-2 py-0 select-none overflow-x-auto scrollbar-none shrink-0">
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-1">
                {tabs.map((tab) => {
                  const meta = getLanguageForFile(tab.name);
                  const isActive = tab.path === activeTabPath;
                  return (
                    <div
                      key={tab.path}
                      onClick={() => setActiveTabPath(tab.path)}
                      className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-mono transition cursor-pointer border ${
                        isActive
                          ? "bg-[var(--card)] text-[var(--foreground)] border-[var(--border)] shadow-xs font-semibold"
                          : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]/60"
                      }`}
                    >
                      <span className="text-[11px] shrink-0">{meta.icon}</span>
                      <span className="truncate max-w-[120px]">{tab.name}</span>
                      {tab.isDirty && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Unsaved changes" />
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleCloseTab(tab.path, e)}
                        className="opacity-0 group-hover:opacity-100 hover:bg-[var(--muted)] p-0.5 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition ml-0.5"
                        title="Close tab"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-1 pl-2 shrink-0">
                <button
                  type="button"
                  onClick={handleSaveAllTabs}
                  className="px-2 py-1 rounded text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition cursor-pointer"
                  title="Save All Modified Tabs"
                >
                  Save All
                </button>
                <button
                  type="button"
                  onClick={() => handleCloseOtherTabs(activeTabPath)}
                  className="px-2 py-1 rounded text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition cursor-pointer"
                  title="Close Other Tabs"
                >
                  Close Others
                </button>
              </div>
            </div>
          )}

          {/* Search & Replace Floating Bar */}
          <CodeSearchReplace
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            code={code}
            onCodeChange={handleCodeChange}
            onHighlightMatch={(start, end) => {
              if (textareaRef.current) {
                textareaRef.current.focus();
                textareaRef.current.setSelectionRange(start, end);
              }
            }}
          />

          {/* ─── MAIN ARTIFACT CONTENT VIEW ─── */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
            {isDiffMode ? (
              /* Local Diff Viewer */
              <CodeDiffViewer
                originalCode={activeTab.originalContent}
                currentCode={code}
                filename={currentFilePath}
                onAccept={handleSaveToProject}
                onRevert={handleRevertActiveFile}
                onCurrentCodeChange={handleCodeChange}
              />
            ) : activeArtifactTab === "code" ? (
              /* Full Editor View */
              <div className="flex-1 min-h-0 flex overflow-hidden font-mono text-[13px] bg-[var(--card)]">
                {/* Line Numbers */}
                <div className="w-12 py-3 bg-[var(--card)] border-r border-[var(--border)]/50 text-right pr-3 select-none text-[var(--muted-foreground)]/40 shrink-0 overflow-hidden leading-[1.65]">
                  {Array.from({ length: Math.min(lineCount, 600) }).map((_, i) => (
                    <div key={i} className="text-[11.5px]">{i + 1}</div>
                  ))}
                </div>

                {/* Textarea Code Input */}
                <textarea
                  ref={textareaRef}
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  onKeyDown={handleEditorKeyDown}
                  onKeyUp={handleCursorUpdate}
                  onClick={handleCursorUpdate}
                  onSelect={handleCursorUpdate}
                  spellCheck={false}
                  style={{ fontSize: `${fontSize}px` }}
                  className={`flex-1 p-3 bg-transparent text-[var(--foreground)] outline-none resize-none leading-[1.65] font-mono overflow-auto scrollbar-thin selection:bg-[var(--primary)]/20 ${
                    wordWrap ? "whitespace-pre-wrap" : "whitespace-pre"
                  }`}
                />
              </div>
            ) : activeArtifactTab === "split" ? (
              /* Split View: Editor Left + Sandboxed Preview Right */
              <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden divide-y md:divide-y-0 md:divide-x divide-[var(--border)]">
                {/* Left: Code Editor */}
                <div className="flex-1 min-w-0 flex overflow-hidden font-mono text-[12.5px] bg-[var(--card)]">
                  <div className="w-10 py-3 bg-[var(--card)] border-r border-[var(--border)]/50 text-right pr-2 select-none text-[var(--muted-foreground)]/40 shrink-0 overflow-hidden leading-[1.6]">
                    {Array.from({ length: Math.min(lineCount, 300) }).map((_, i) => (
                      <div key={i} className="text-[11px]">{i + 1}</div>
                    ))}
                  </div>
                  <textarea
                    value={code}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    onKeyDown={handleEditorKeyDown}
                    onKeyUp={handleCursorUpdate}
                    onClick={handleCursorUpdate}
                    onSelect={handleCursorUpdate}
                    spellCheck={false}
                    style={{ fontSize: `${fontSize}px` }}
                    className="flex-1 p-3 bg-transparent text-[var(--foreground)] outline-none resize-none leading-[1.6] font-mono overflow-auto scrollbar-thin selection:bg-[var(--primary)]/20 whitespace-pre"
                  />
                </div>

                {/* Right: Live Sandboxed Preview */}
                <div className="flex-1 min-w-0 relative bg-neutral-950 p-2 overflow-auto flex items-center justify-center">
                  <div
                    className={`transition-all duration-300 bg-white ${
                      previewViewport === "mobile"
                        ? "w-[375px] h-[95%] shadow-2xl rounded-2xl border border-neutral-800 overflow-hidden"
                        : previewViewport === "tablet"
                        ? "w-[768px] h-[95%] shadow-2xl rounded-xl border border-neutral-800 overflow-hidden"
                        : "w-full h-full shadow-sm rounded-lg overflow-hidden"
                    }`}
                  >
                    <iframe
                      ref={iframeRef}
                      title="Live Sandbox Preview Split"
                      srcDoc={previewHtml}
                      sandbox="allow-scripts allow-modals allow-forms"
                      className="w-full h-full border-none bg-white"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* Full Sandboxed Live Preview */
              <div className="flex-1 min-h-0 relative bg-neutral-950 p-3 overflow-auto flex items-center justify-center">
                <div
                  className={`transition-all duration-300 bg-white ${
                    previewViewport === "mobile"
                      ? "w-[375px] h-[95%] shadow-2xl rounded-2xl border border-neutral-800 overflow-hidden"
                      : previewViewport === "tablet"
                      ? "w-[768px] h-[95%] shadow-2xl rounded-xl border border-neutral-800 overflow-hidden"
                      : "w-full h-full shadow-sm rounded-lg overflow-hidden"
                  }`}
                >
                  <iframe
                    ref={iframeRef}
                    title="Live Sandbox Preview"
                    srcDoc={previewHtml}
                    sandbox="allow-scripts allow-modals allow-forms"
                    className="w-full h-full border-none bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ─── CONSOLE, TERMINAL & REPL BOTTOM DRAWER ─── */}
          <CodeConsoleDrawer
            isOpen={consoleOpen}
            onToggleOpen={() => setConsoleOpen((prev) => !prev)}
            entries={consoleEntries}
            onClear={() => setConsoleEntries([])}
            onRunEval={handleRunEvalInPreview}
            fileList={flatFileList}
            activeProject={selectedProject}
          />

          {/* ─── STATUS BAR (VS Code Style Footer) ─── */}
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
                onClick={() => setWordWrap((prev) => !prev)}
                className={`hover:text-[var(--foreground)] transition cursor-pointer ${wordWrap ? "text-[var(--primary)] font-semibold" : ""}`}
                title="Toggle Word Wrap"
              >
                Wrap: {wordWrap ? "On" : "Off"}
              </button>

              {/* Font size stepper */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setFontSize((s) => Math.max(10, s - 1))}
                  className="hover:text-[var(--foreground)] transition px-1"
                  title="Decrease font size"
                >
                  A-
                </button>
                <span>{fontSize}px</span>
                <button
                  type="button"
                  onClick={() => setFontSize((s) => Math.min(20, s + 1))}
                  className="hover:text-[var(--foreground)] transition px-1"
                  title="Increase font size"
                >
                  A+
                </button>
              </div>

              {/* Dirty / Saved State */}
              <div className="flex items-center gap-1.5">
                {activeTab?.isDirty ? (
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
        </div>

        {/* Mobile View Toggle */}
        <div className="lg:hidden fixed bottom-20 right-4 z-40">
          <button
            onClick={() => setArtifactExpanded((prev) => !prev)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-[var(--primary)] text-white shadow-lg text-[12px] font-medium cursor-pointer"
          >
            {artifactExpanded ? (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Chat</span>
              </>
            ) : (
              <>
                <Code className="w-3.5 h-3.5" />
                <span>Code</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ═══════════════════════ MODALS ═══════════════════════ */}

      {/* New Project Starter Templates Modal */}
      <ProjectTemplatesModal
        isOpen={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        onCreateProject={handleCreateProjectWithTemplate}
      />

      {/* Delete Project Confirmation Modal */}
      <AnimatePresence>
        {showDeleteProjectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-[var(--foreground)]">Delete Workspace?</h3>
                  <p className="text-[12px] text-[var(--muted-foreground)]">This action cannot be undone.</p>
                </div>
              </div>
              <p className="text-[13px] text-[var(--foreground)] leading-relaxed">
                Are you sure you want to permanently delete project workspace{" "}
                <code className="px-1.5 py-0.5 rounded bg-[var(--muted)] font-mono text-[var(--primary)] font-semibold">
                  {selectedProject}
                </code>{" "}
                and all of its files?
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteProjectModal(false)}
                  className="px-4 py-2 rounded-xl border border-[var(--border)] text-[12.5px] font-medium hover:bg-[var(--muted)] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteProject}
                  disabled={isDeletingProject}
                  className="px-4 py-2 rounded-xl bg-red-600 text-white text-[12.5px] font-medium hover:bg-red-500 transition cursor-pointer flex items-center gap-1.5"
                >
                  {isDeletingProject && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Delete Project</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New File Modal */}
      <AnimatePresence>
        {showNewFileDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-semibold text-[var(--foreground)] flex items-center gap-2">
                  <FilePlus className="w-4.5 h-4.5 text-blue-500" />
                  <span>New File</span>
                </h3>
                <button onClick={() => setShowNewFileDialog(false)} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleCreateNewFile} className="space-y-4">
                <div>
                  <label className="text-[12px] font-medium text-[var(--muted-foreground)] block mb-1.5">
                    File path in {selectedProject}
                  </label>
                  <input
                    type="text"
                    value={newFilePathInput}
                    onChange={(e) => setNewFilePathInput(e.target.value)}
                    placeholder="e.g. components/Header.tsx, styles.css, app.js"
                    className="w-full bg-[var(--background)] border border-[var(--border)] px-3.5 py-2.5 rounded-xl text-[13px] font-mono text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 transition"
                    autoFocus
                    required
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowNewFileDialog(false)}
                    className="px-4 py-2 rounded-xl border border-[var(--border)] text-[12.5px] font-medium hover:bg-[var(--muted)] transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-[12.5px] font-medium hover:opacity-90 transition cursor-pointer"
                  >
                    Create File
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Folder Modal */}
      <AnimatePresence>
        {showNewFolderDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-semibold text-[var(--foreground)] flex items-center gap-2">
                  <FolderPlus className="w-4.5 h-4.5 text-amber-500" />
                  <span>New Folder</span>
                </h3>
                <button onClick={() => setShowNewFolderDialog(false)} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleCreateNewFolder} className="space-y-4">
                <div>
                  <label className="text-[12px] font-medium text-[var(--muted-foreground)] block mb-1.5">
                    Folder path in {selectedProject}
                  </label>
                  <input
                    type="text"
                    value={newFolderPathInput}
                    onChange={(e) => setNewFolderPathInput(e.target.value)}
                    placeholder="e.g. src/components, assets/images"
                    className="w-full bg-[var(--background)] border border-[var(--border)] px-3.5 py-2.5 rounded-xl text-[13px] font-mono text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 transition"
                    autoFocus
                    required
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowNewFolderDialog(false)}
                    className="px-4 py-2 rounded-xl border border-[var(--border)] text-[12.5px] font-medium hover:bg-[var(--muted)] transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-[12.5px] font-medium hover:opacity-90 transition cursor-pointer"
                  >
                    Create Folder
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rename File / Folder Modal */}
      <AnimatePresence>
        {showRenameDialog && renameTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-semibold text-[var(--foreground)] flex items-center gap-2">
                  <Edit2 className="w-4.5 h-4.5 text-[var(--primary)]" />
                  <span>Rename {renameTarget.isFolder ? "Folder" : "File"}</span>
                </h3>
                <button onClick={() => setShowRenameDialog(false)} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleRenameItem} className="space-y-4">
                <div>
                  <label className="text-[12px] font-medium text-[var(--muted-foreground)] block mb-1.5">
                    New path for <code className="font-mono text-[var(--foreground)]">{renameTarget.path}</code>
                  </label>
                  <input
                    type="text"
                    required
                    value={renameNewPathInput}
                    onChange={(e) => setRenameNewPathInput(e.target.value)}
                    className="w-full bg-[var(--background)] border border-[var(--border)] px-3.5 py-2.5 rounded-xl text-[13px] font-mono text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 transition"
                    autoFocus
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowRenameDialog(false)}
                    className="px-4 py-2 rounded-xl border border-[var(--border)] text-[12.5px] font-medium hover:bg-[var(--muted)] transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isRenaming || !renameNewPathInput.trim()}
                    className="px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-[12.5px] font-medium hover:opacity-90 transition cursor-pointer flex items-center gap-1.5"
                  >
                    {isRenaming && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Rename</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CodePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[var(--background)]">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" />
        </div>
      }
    >
      <CodePageContent />
    </Suspense>
  );
}
