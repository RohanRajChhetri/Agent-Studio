"use client";

export const dynamic = "force-dynamic";

import { useState, useCallback, useRef, useEffect, Suspense, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useProjectBuilder,
  type CodeMessage,
  type BuildCompletedEventDetail,
} from "@/context/project-builder-context";
import type { FileTreeNode, WorkspaceProjectInfo } from "@/lib/project-filesystem";
import { PREVIEW_CONSOLE_BRIDGE_SCRIPT, getLanguageForFile } from "@/components/code/code-utils";
import { StudioTopHeader } from "@/components/code/studio-top-header";
import { StudioSidebar } from "@/components/code/studio-sidebar";
import { StudioInputCard } from "@/components/code/studio-input-card";
import { StudioChatStream } from "@/components/code/studio-chat-stream";
import { StudioProductPreview } from "@/components/code/studio-product-preview";
import { StudioIdeDrawer } from "@/components/code/studio-ide-drawer";
import { StudioNewProjectModal } from "@/components/code/studio-new-project-modal";
import { StudioEditProjectModal } from "@/components/code/studio-edit-project-modal";
import { StudioDeleteProjectModal } from "@/components/code/studio-delete-project-modal";
import { StudioCommandPalette } from "@/components/code/studio-command-palette";
import { StudioHistoryModal } from "@/components/code/studio-history-modal";
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

function findHtmlFilePath(nodes: FileTreeNode[]): string | null {
  for (const n of nodes) {
    if (!n.isDirectory && n.name.toLowerCase().endsWith(".html")) {
      return n.path;
    }
    if (n.isDirectory && n.children) {
      const found = findHtmlFilePath(n.children);
      if (found) return found;
    }
  }
  return null;
}

function StudioPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialProjectParam = searchParams?.get("project");

  const {
    isGenerating: globalIsGenerating,
    isProjectGenerating,
    getProjectMessages,
    loadProjectMessagesFromDisk,
    setProjectMessages,
    renameProjectMessages,
    deleteProjectMessages,
    startGeneration,
    activeProject: globalActiveProject,
    setActiveProject: setGlobalActiveProject,
  } = useProjectBuilder();

  // Projects State
  const [projects, setProjects] = useState<WorkspaceProjectInfo[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>(
    initialProjectParam || globalActiveProject || "workspace"
  );
  const [isLoadingProjects, setIsLoadingProjects] = useState<boolean>(true);

  // Edit / Delete Project Modal States
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [deletingProject, setDeletingProject] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  // Scoped project generating status
  const isGenerating = isProjectGenerating
    ? isProjectGenerating(selectedProject)
    : globalIsGenerating;

  // Prompt & Model & Persona
  const [prompt, setPrompt] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("gemini-3.6-flash");
  const [selectedPersona, setSelectedPersona] = useState<string>("main");

  // View Mode: "split" (Chat + Product) | "chat" | "preview"
  const [activeViewMode, setActiveViewMode] = useState<"split" | "chat" | "preview">("split");
  const [previewViewport, setPreviewViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");

  // Modals & Drawers
  const [showBuiltInIde, setShowBuiltInIde] = useState<boolean>(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState<boolean>(false);
  const [showCommandPalette, setShowCommandPalette] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);

  // Files & Preview State
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [previewHtml, setPreviewHtml] = useState<string>("");

  // Tabs state for the Built-in Code Studio drawer (lazy loaded from disk)
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string>("index.html");
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const activeTab = tabs.find((t) => t.path === activeTabPath) || tabs[0];
  const projectBasePath = `agent-workspace/${selectedProject}`;

  // Messages for active project
  const messages = getProjectMessages(selectedProject);
  const setMessages = useCallback(
    (updater: CodeMessage[] | ((prev: CodeMessage[]) => CodeMessage[])) => {
      setProjectMessages(selectedProject, updater);
    },
    [selectedProject, setProjectMessages]
  );

  // Load projects list
  const loadProjects = useCallback(async () => {
    try {
      setIsLoadingProjects(true);
      const res = await fetch("/api/filesystem?action=projects");
      if (res.ok) {
        const data = await res.json();
        const projs: WorkspaceProjectInfo[] = data.projects || [];
        setProjects(projs);
        if (projs.length > 0) {
          // If current selectedProject is invalid or non-existent (e.g. "workspace"), switch to real project
          const exists = projs.some((p) => p.name === selectedProject);
          if (!exists) {
            const fallback =
              initialProjectParam && projs.some((p) => p.name === initialProjectParam)
                ? initialProjectParam
                : globalActiveProject && projs.some((p) => p.name === globalActiveProject)
                ? globalActiveProject
                : projs[0].name;
            setSelectedProject(fallback);
            setGlobalActiveProject(fallback);
          }
        }
      }
    } catch (err) {
      console.warn("Failed to load workspace projects:", err);
    } finally {
      setIsLoadingProjects(false);
    }
  }, [selectedProject, initialProjectParam, globalActiveProject, setGlobalActiveProject]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Restore messages from disk or create welcoming message for existing projects
  useEffect(() => {
    if (!selectedProject || selectedProject === "workspace") return;
    const currentMsgs = getProjectMessages(selectedProject);
    if (currentMsgs.length === 0) {
      loadProjectMessagesFromDisk(selectedProject).then((diskMsgs) => {
        if (diskMsgs.length === 0) {
          const projInfo = projects.find((p) => p.name === selectedProject);
          const count = projInfo?.fileCount || 0;
          if (count > 0) {
            const welcomeMsg: CodeMessage = {
              id: `welcome-${selectedProject}`,
              role: "assistant",
              content: `### Project **${selectedProject}** Loaded\n\nI have loaded this project with **${count} files** into your sandboxed workspace.\n\nThe live product preview is running on the right canvas. Ask me to add features, refine the UI styling, optimize responsive layouts, or debug code.`,
              createdAt: new Date().toISOString(),
            };
            setProjectMessages(selectedProject, [welcomeMsg]);
          }
        }
      });
    }
  }, [selectedProject, getProjectMessages, loadProjectMessagesFromDisk, projects, setProjectMessages]);

  // Load file tree for active project
  const loadProjectTree = useCallback(async () => {
    if (!selectedProject) return;
    try {
      const res = await fetch(
        `/api/filesystem?action=tree&path=${encodeURIComponent(projectBasePath)}`
      );
      if (res.ok) {
        const data = await res.json();
        setFileTree(data.tree || []);
      }
    } catch (err) {
      console.warn("Failed to load project tree:", err);
    }
  }, [projectBasePath, selectedProject]);

  useEffect(() => {
    loadProjectTree();
  }, [loadProjectTree]);

  // Build live sandbox product preview
  const buildProjectPreview = useCallback(async () => {
    if (!selectedProject || selectedProject === "workspace") return;

    try {
      let htmlContent = "";
      const defaultIndexPath = `${projectBasePath}/index.html`;

      // Check active dirty (unsaved) user edits in open tab first
      const dirtyIndexTab = tabs.find(
        (t) => (t.path === "index.html" || t.path.endsWith("/index.html") || t.path.endsWith(".html")) && t.isDirty
      );

      if (dirtyIndexTab && dirtyIndexTab.content.trim()) {
        htmlContent = dirtyIndexTab.content;
      } else {
        // 1. Try default index.html
        let res = await fetch(`/api/filesystem?action=read&path=${encodeURIComponent(defaultIndexPath)}`);
        if (res.ok) {
          const data = await res.json();
          htmlContent = data.content || "";
        } else {
          // 2. Check open tabs for any HTML file
          const fallbackTab = tabs.find((t) => t.path === "index.html" || t.path.endsWith(".html"));
          if (fallbackTab && fallbackTab.content) {
            htmlContent = fallbackTab.content;
          } else {
            // 3. Search project fileTree for any HTML file (e.g. src/index.html, public/index.html)
            const altHtmlRel = findHtmlFilePath(fileTree);
            if (altHtmlRel) {
              const altPath = altHtmlRel.startsWith(projectBasePath)
                ? altHtmlRel
                : `${projectBasePath}/${altHtmlRel.replace(/^[/\\]+/, "")}`;
              res = await fetch(`/api/filesystem?action=read&path=${encodeURIComponent(altPath)}`);
              if (res.ok) {
                const data = await res.json();
                htmlContent = data.content || "";
              }
            }
          }
        }
      }

      if (!htmlContent) {
        // If project has files but no HTML, render an interactive code project overview
        const projFiles = fileTree.length > 0 ? fileTree : [];
        if (projFiles.length > 0) {
          setPreviewHtml(
            `<div style="font-family:system-ui,-apple-system,sans-serif;display:grid;place-content:center;min-height:100vh;margin:0;background:#09090b;color:#a1a1aa;padding:2rem;">
              <div style="max-width:440px;padding:2rem;background:#18181b;border-radius:1rem;border:1px solid #27272a;box-shadow:0 20px 40px -15px rgba(0,0,0,0.5);">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
                  <div style="display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:10px;background:rgba(99,102,241,0.15);color:#818cf8;">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
                  </div>
                  <div>
                    <h3 style="color:#fafafa;margin:0;font-size:16px;font-weight:600;">${selectedProject}</h3>
                    <p style="margin:2px 0 0;font-size:12px;color:#71717a;">Code project loaded (${projFiles.length} items)</p>
                  </div>
                </div>
                <p style="font-size:13px;line-height:1.6;color:#a1a1aa;margin:1rem 0;">
                  This project contains backend or automation code without an HTML frontend entrypoint. You can inspect and edit the source files via the built-in IDE or ask the AI agent to generate a web interface!
                </p>
                <div style="background:#09090b;border:1px solid #27272a;border-radius:8px;padding:10px 14px;font-family:monospace;font-size:12px;color:#38bdf8;">
                  ${projFiles.slice(0, 5).map((f) => `<span style="color:#818cf8;margin-right:6px;">•</span>${f.name}`).join("<br/>")}
                </div>
              </div>
            </div>`
          );
        } else {
          setPreviewHtml(
            `<div style="font-family:system-ui,-apple-system,sans-serif;display:grid;place-content:center;height:100vh;margin:0;background:#09090b;color:#a1a1aa;text-align:center;padding:2rem;">
              <div style="max-width:380px;padding:2rem;background:#18181b;border-radius:1rem;border:1px solid #27272a;">
                <div style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:12px;background:rgba(99,102,241,0.15);color:#818cf8;margin:0 auto 16px;">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>
                </div>
                <h3 style="color:#fafafa;margin-top:0;font-size:16px;font-weight:600;">Workspace Initialized</h3>
                <p style="font-size:13px;line-height:1.6;color:#71717a;">Ask the agent what product you want to build and watch it develop live here.</p>
              </div>
            </div>`
          );
        }
        return;
      }

      let bundled = htmlContent;

      // Inline linked stylesheets (handles any attribute order: href before rel or rel before href)
      const linkTagRegex = /<link\b([^>]*)\/?>/gi;
      let match;
      while ((match = linkTagRegex.exec(htmlContent)) !== null) {
        const fullTag = match[0];
        const attrs = match[1];
        if (!/rel=["']?stylesheet["']?/i.test(attrs)) continue;

        const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
        if (!hrefMatch) continue;

        const href = hrefMatch[1].split("?")[0].split("#")[0];
        if (
          href.startsWith("http://") ||
          href.startsWith("https://") ||
          href.startsWith("//") ||
          href.startsWith("data:")
        ) {
          continue;
        }

        const cleanHref = href.replace(/^\.\//, "").replace(/^[/\\]+/, "");
        const cssPath = `${projectBasePath}/${cleanHref}`;

        const tabCss = tabs.find((t) => t.path === cleanHref || t.path.endsWith("/" + cleanHref));
        if (tabCss && tabCss.content) {
          bundled = bundled.replace(fullTag, `<style>/* ${href} */\n${tabCss.content}\n</style>`);
        } else {
          try {
            const cssRes = await fetch(`/api/filesystem?action=read&path=${encodeURIComponent(cssPath)}`);
            if (cssRes.ok) {
              const cssData = await cssRes.json();
              if (cssData.content) {
                bundled = bundled.replace(fullTag, `<style>/* ${href} */\n${cssData.content}\n</style>`);
              }
            }
          } catch {}
        }
      }

      // Inline linked scripts (handles any attribute order: defer, async, type, src)
      const scriptTagRegex = /<script\b([^>]*)>(?:<\/script>)?/gi;
      while ((match = scriptTagRegex.exec(htmlContent)) !== null) {
        const fullTag = match[0];
        const attrs = match[1];

        const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
        if (!srcMatch) continue;

        const src = srcMatch[1].split("?")[0].split("#")[0];
        if (
          src.startsWith("http://") ||
          src.startsWith("https://") ||
          src.startsWith("//") ||
          src.startsWith("data:")
        ) {
          continue;
        }

        const cleanSrc = src.replace(/^\.\//, "").replace(/^[/\\]+/, "");
        const jsPath = `${projectBasePath}/${cleanSrc}`;

        const tabJs = tabs.find((t) => t.path === cleanSrc || t.path.endsWith("/" + cleanSrc));
        if (tabJs && tabJs.content) {
          bundled = bundled.replace(fullTag, `<script>/* ${src} */\n${tabJs.content}\n</script>`);
        } else {
          try {
            const jsRes = await fetch(`/api/filesystem?action=read&path=${encodeURIComponent(jsPath)}`);
            if (jsRes.ok) {
              const jsData = await jsRes.json();
              if (jsData.content) {
                bundled = bundled.replace(fullTag, `<script>/* ${src} */\n${jsData.content}\n</script>`);
              }
            }
          } catch {}
        }
      }

      // External runtimes & safety injection
      let externalRuntimes = "";
      if (bundled.includes("tailwind") || bundled.includes("class=")) {
        externalRuntimes += `<script src="https://cdn.tailwindcss.com"></script>`;
      }
      if (bundled.includes("text/babel") || bundled.includes("React") || bundled.includes("ReactDOM")) {
        externalRuntimes += `<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script><script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script><script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>`;
      }
      if (bundled.includes("lucide") || bundled.includes("data-lucide")) {
        externalRuntimes += `<script src="https://unpkg.com/lucide@latest"></script><script>window.addEventListener('DOMContentLoaded',function(){if(window.lucide&&typeof window.lucide.createIcons==='function'){window.lucide.createIcons();}});</script>`;
      }
      if (bundled.includes("Chart") || bundled.includes("chart.js")) {
        externalRuntimes += `<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>`;
      }
      if (bundled.includes("confetti")) {
        externalRuntimes += `<script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js"></script>`;
      }
      if (bundled.includes("type=\"module\"") || bundled.includes("type='module'")) {
        externalRuntimes += `<script type="importmap">{
          "imports": {
            "react": "https://esm.sh/react@18.3.1",
            "react-dom": "https://esm.sh/react-dom@18.3.1",
            "react-dom/client": "https://esm.sh/react-dom@18.3.1/client",
            "canvas-confetti": "https://esm.sh/canvas-confetti@1.9.3",
            "three": "https://esm.sh/three@0.160.0",
            "chart.js": "https://esm.sh/chart.js@4.4.1/auto",
            "gsap": "https://esm.sh/gsap@3.12.5"
          }
        }</script>`;
      }

      const safetyInjection = `<base target="_blank">${externalRuntimes}<script>window.addEventListener('click',function(e){var a=e.target.closest('a');if(a&&a.getAttribute('href')&&!a.getAttribute('href').startsWith('#')){a.target='_blank';}},true);</script>${PREVIEW_CONSOLE_BRIDGE_SCRIPT}`;
      if (bundled.includes("<head>")) {
        bundled = bundled.replace("<head>", `<head>${safetyInjection}`);
      } else {
        bundled = `${safetyInjection}${bundled}`;
      }

      setPreviewHtml(bundled);
    } catch (err) {
      console.error("Preview build error:", err);
    }
  }, [projectBasePath, selectedProject, tabs, fileTree]);

  useEffect(() => {
    buildProjectPreview();
  }, [buildProjectPreview]);

  // Listen for background build completed events
  useEffect(() => {
    const handleBuildCompleted = (e: any) => {
      const detail: BuildCompletedEventDetail = e.detail;
      if (!detail) return;
      if (detail.projectName === selectedProject) {
        playTaskCompletedSound();
        if (detail.projectTree) {
          setFileTree(detail.projectTree);
        } else {
          loadProjectTree();
        }
        buildProjectPreview();
      }
    };

    window.addEventListener("project-build-completed", handleBuildCompleted);
    return () => window.removeEventListener("project-build-completed", handleBuildCompleted);
  }, [selectedProject, buildProjectPreview, loadProjectTree]);

  // AI Conversational Multi-File Product Development
  const handleGenerate = async (e?: React.FormEvent, customPrompt?: string) => {
    e?.preventDefault();
    const textToSend = (customPrompt || prompt).trim();
    if (!textToSend || isGenerating) return;

    setPrompt("");
    playTaskStartedSound();

    const res = await startGeneration({
      prompt: textToSend,
      projectName: selectedProject,
      projectPath: projectBasePath,
      model: selectedModel,
      persona: selectedPersona,
      history: messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
    });

    if (res.success && res.data) {
      playTaskCompletedSound();
      const data = res.data;
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

  // Switch active project
  const handleSelectProject = (projName: string) => {
    setSelectedProject(projName);
    setGlobalActiveProject(projName);
    setTabs([]);
    router.replace(`/code?project=${encodeURIComponent(projName)}`);
  };

  // Start new conversation (resets prompt context, retains files)
  const handleNewConversation = () => {
    setMessages([]);
    setPrompt("");
    toast.success(`Started new conversation for "${selectedProject}"`);
    playTaskStartedSound();
  };

  // Create new workspace project
  const handleCreateProject = async (name: string, template: string) => {
    const res = await fetch("/api/filesystem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_project",
        name,
        template,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to create project");
    }
    await loadProjects();
    handleSelectProject(name);
  };

  // Edit / Rename project
  const handleEditProject = (name: string) => {
    setEditingProject(name);
  };

  const handleRenameSuccess = async (oldName: string, newName: string) => {
    renameProjectMessages(oldName, newName);
    await loadProjects();
    if (selectedProject === oldName) {
      setSelectedProject(newName);
      setGlobalActiveProject(newName);
    }
  };

  // Delete project
  const handleDeleteProject = (name: string) => {
    setDeletingProject(name);
  };

  const handleDeleteSuccess = async (deletedName: string) => {
    deleteProjectMessages(deletedName);
    setProjects((prev) => prev.filter((p) => p.name !== deletedName));
    if (selectedProject === deletedName) {
      const remaining = projects.filter((p) => p.name !== deletedName);
      const nextProj = remaining.length > 0 ? remaining[0].name : "workspace";
      setSelectedProject(nextProj);
      setGlobalActiveProject(nextProj);
    }
    await loadProjects();
  };

  // Export ZIP archive
  const handleExportZip = (projName?: string) => {
    const target = projName || selectedProject;
    playClickSound();
    toast.info(`Packaging "${target}" into ZIP...`);
    window.open(`/api/filesystem?action=zip&path=agent-workspace/${encodeURIComponent(target)}`, "_blank");
  };

  // Open file in Built-in IDE Tab
  const openFileInTab = async (filePath: string) => {
    let cleanRel = filePath.replace(/^[/\\]+/, "");
    if (cleanRel.startsWith(projectBasePath + "/")) {
      cleanRel = cleanRel.slice(projectBasePath.length + 1);
    } else if (cleanRel.startsWith("agent-workspace/")) {
      cleanRel = cleanRel.replace(/^agent-workspace\/[^/]+\//, "");
    }

    const existing = tabs.find((t) => t.path === cleanRel);
    if (existing) {
      setActiveTabPath(cleanRel);
      return;
    }

    try {
      const targetQuery = `${projectBasePath}/${cleanRel}`;
      const res = await fetch(`/api/filesystem?action=read&path=${encodeURIComponent(targetQuery)}`);
      if (res.ok) {
        const data = await res.json();
        const newTab: EditorTab = {
          path: cleanRel,
          name: cleanRel.split("/").pop() || cleanRel,
          content: data.content || "",
          originalContent: data.content || "",
          isDirty: false,
          language: getLanguageForFile(cleanRel).id,
        };
        setTabs((prev) => {
          if (prev.some((t) => t.path === cleanRel)) return prev;
          return [...prev, newTab];
        });
        setActiveTabPath(cleanRel);
      }
    } catch (err) {
      console.warn("Failed to open file in tab:", err);
    }
  };

  // Save active file in tab
  const handleSaveTab = async () => {
    if (!activeTab) return;
    setIsSaving(true);
    try {
      const targetQuery = activeTab.path.startsWith(projectBasePath)
        ? activeTab.path
        : `${projectBasePath}/${activeTab.path}`;

      const res = await fetch("/api/filesystem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "write",
          path: targetQuery,
          content: activeTab.content,
        }),
      });

      if (res.ok) {
        setTabs((prev) =>
          prev.map((t) =>
            t.path === activeTabPath
              ? { ...t, isDirty: false, originalContent: t.content }
              : t
          )
        );
        toast.success(`Saved "${activeTab.name}"`);
        buildProjectPreview();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save file");
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard shortcuts listener (Ctrl+N, Ctrl+I, Ctrl+R)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+N = New Conversation
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n" && !e.shiftKey) {
        e.preventDefault();
        handleNewConversation();
        return;
      }
      // Ctrl+H = Conversation History
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "h") {
        e.preventDefault();
        setShowHistoryModal((prev) => !prev);
        return;
      }
      // Ctrl+K = Command Palette / Project Search
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
        return;
      }
      // Ctrl+I = Open Built-in Code Studio
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
        e.preventDefault();
        setShowBuiltInIde((prev) => !prev);
        return;
      }
      // Ctrl+R = Reload Preview
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r" && !e.shiftKey) {
        e.preventDefault();
        buildProjectPreview();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [buildProjectPreview, handleNewConversation]);

  const hasMessages = messages.length > 0 || isGenerating;
  const hasFiles =
    fileTree.length > 0 ||
    (projects.find((p) => p.name === selectedProject)?.fileCount || 0) > 0;
  const showInitialStartScreen = projects.length === 0 && !hasMessages && !hasFiles;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] min-h-0 -mx-3 sm:-mx-6 lg:-mx-8 -my-3 sm:-my-5 bg-[var(--background)] text-[var(--foreground)] overflow-hidden font-sans select-none border-l border-[var(--border)]">
      {/* ─── INTEGRATED STUDIO TOP HEADER ─── */}
      <StudioTopHeader
        selectedProject={selectedProject}
        projects={projects}
        onSelectProject={handleSelectProject}
        onNewConversation={handleNewConversation}
        onNewProject={() => setShowNewProjectModal(true)}
        onOpenBuiltInIde={() => setShowBuiltInIde(true)}
        onExportZip={() => handleExportZip()}
        onReloadPreview={buildProjectPreview}
        onEditProject={handleEditProject}
        onDeleteProject={handleDeleteProject}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        activeViewMode={activeViewMode}
        onChangeViewMode={setActiveViewMode}
        previewViewport={previewViewport}
        onChangePreviewViewport={setPreviewViewport}
        isGenerating={isGenerating}
      />

      {/* ─── MAIN WORKSPACE CANVAS ─── */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative z-0">
        {/* Collapsible Left Studio Sidebar */}
        <StudioSidebar
          isOpen={isSidebarOpen}
          projects={projects}
          selectedProject={selectedProject}
          onSelectProject={handleSelectProject}
          onNewConversation={handleNewConversation}
          onNewProject={() => setShowNewProjectModal(true)}
          onOpenHistory={() => setShowHistoryModal(true)}
          onOpenSettings={() => router.push("/settings")}
          onEditProject={handleEditProject}
          onDeleteProject={handleDeleteProject}
          onExportZip={handleExportZip}
        />

        {showInitialStartScreen ? (
          /* State A: Clean Antigravity-Style Start State (when no projects exist yet) */
          <div className="w-full h-full flex flex-col items-center justify-center p-4 overflow-y-auto">
            <StudioInputCard
              prompt={prompt}
              onChangePrompt={setPrompt}
              onSubmit={handleGenerate}
              isGenerating={isGenerating}
              selectedProject={selectedProject}
              projects={projects}
              onSelectProject={handleSelectProject}
              selectedModel={selectedModel}
              onSelectModel={setSelectedModel}
              selectedPersona={selectedPersona}
              onSelectPersona={setSelectedPersona}
              isFloatingCentered={true}
            />
          </div>
        ) : (
          /* State B: Active Conversational Product Development */
          <div className="w-full h-full flex overflow-hidden">
            {/* Left Pane: Conversation Stream (Talk to build, NO raw code dump) */}
            {(activeViewMode === "split" || activeViewMode === "chat") && (
              <div
                className={`${
                  activeViewMode === "split" ? "w-1/2 min-w-[380px]" : "w-full"
                } h-full flex flex-col`}
              >
                <StudioChatStream
                  messages={messages}
                  isGenerating={isGenerating}
                  prompt={prompt}
                  onChangePrompt={setPrompt}
                  onSubmit={handleGenerate}
                  selectedProject={selectedProject}
                  projects={projects}
                  onSelectProject={handleSelectProject}
                  selectedModel={selectedModel}
                  onSelectModel={setSelectedModel}
                  selectedPersona={selectedPersona}
                  onSelectPersona={setSelectedPersona}
                  onOpenBuiltInIde={() => setShowBuiltInIde(true)}
                />
              </div>
            )}

            {/* Right Pane: Live Interactive Product Canvas ("see it develop a product") */}
            {(activeViewMode === "split" || activeViewMode === "preview") && (
              <div
                className={`${
                  activeViewMode === "split" ? "flex-1 min-w-[420px]" : "w-full"
                } h-full flex flex-col`}
              >
                <StudioProductPreview
                  selectedProject={selectedProject}
                  previewHtml={previewHtml}
                  onReload={buildProjectPreview}
                  previewViewport={previewViewport}
                  onChangePreviewViewport={setPreviewViewport}
                  isGenerating={isGenerating}
                  fileTree={fileTree}
                  onOpenFile={(path) => {
                    openFileInTab(path);
                    setShowBuiltInIde(true);
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── BUILT-IN CODE STUDIO DRAWER (on-demand via "Open IDE" menu) ─── */}
      <StudioIdeDrawer
        isOpen={showBuiltInIde}
        onClose={() => setShowBuiltInIde(false)}
        selectedProject={selectedProject}
        fileTree={fileTree}
        tabs={tabs}
        activeTabPath={activeTabPath}
        onSelectTab={setActiveTabPath}
        onCloseTab={(path, e) => {
          e.stopPropagation();
          setTabs((prev) => prev.filter((t) => t.path !== path));
          if (activeTabPath === path && tabs.length > 1) {
            setActiveTabPath(tabs[0].path);
          }
        }}
        onOpenFile={openFileInTab}
        onCodeChange={(newVal) => {
          setTabs((prev) =>
            prev.map((t) =>
              t.path === activeTabPath
                ? { ...t, content: newVal, isDirty: newVal !== t.originalContent }
                : t
            )
          );
        }}
        onSaveFile={handleSaveTab}
        isSaving={isSaving}
      />

      {/* New Project Modal */}
      <StudioNewProjectModal
        isOpen={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        onCreateProject={handleCreateProject}
      />

      {/* Edit Project Modal */}
      <StudioEditProjectModal
        isOpen={Boolean(editingProject)}
        projectName={editingProject || ""}
        onClose={() => setEditingProject(null)}
        onRenameSuccess={handleRenameSuccess}
      />

      {/* Delete Project Modal */}
      <StudioDeleteProjectModal
        isOpen={Boolean(deletingProject)}
        projectName={deletingProject || ""}
        fileCount={projects.find((p) => p.name === deletingProject)?.fileCount}
        onClose={() => setDeletingProject(null)}
        onDeleteSuccess={handleDeleteSuccess}
      />

      {/* Command Palette */}
      <StudioCommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        projects={projects}
        selectedProject={selectedProject}
        onSelectProject={handleSelectProject}
        onNewConversation={handleNewConversation}
        onNewProject={() => setShowNewProjectModal(true)}
        onOpenBuiltInIde={() => setShowBuiltInIde(true)}
        onReloadPreview={buildProjectPreview}
        onExportZip={() => handleExportZip()}
      />

      {/* Dedicated Conversation History Modal */}
      <StudioHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        projects={projects}
        selectedProject={selectedProject}
        onSelectProject={handleSelectProject}
      />
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
      <StudioPageContent />
    </Suspense>
  );
}
