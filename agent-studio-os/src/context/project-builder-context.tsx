"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export interface CodeMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  code?: string;
  language?: string;
  createdAt: string;
  createdFiles?: Array<{ path: string; size?: number }>;
}

export interface BuildCompletedEventDetail {
  projectName: string;
  createdFiles: Array<{ path: string; size?: number; content?: string }>;
  primaryFile?: { path: string; content: string; language: string };
  projectTree?: any[];
  response?: string;
}

export interface GeneratingProjectStatus {
  prompt: string;
  jobId?: string;
  startedAt: number;
}

interface ProjectBuilderContextType {
  isGenerating: boolean;
  isProjectGenerating: (projectName: string) => boolean;
  generatingProjects: Record<string, GeneratingProjectStatus>;
  activeBuildingProjects: string[];
  buildingProject: string | null;
  buildingPrompt: string;
  activeProject: string;
  setActiveProject: (name: string) => void;
  getProjectMessages: (projectName: string) => CodeMessage[];
  loadProjectMessagesFromDisk: (projectName: string) => Promise<CodeMessage[]>;
  setProjectMessages: (
    projectName: string,
    updater: CodeMessage[] | ((prev: CodeMessage[]) => CodeMessage[])
  ) => void;
  renameProjectMessages: (oldName: string, newName: string) => void;
  allMessagesMap: Record<string, CodeMessage[]>;
  clearProjectMessages: (projectName: string) => void;
  deleteProjectMessages: (projectName: string) => void;
  startGeneration: (params: {
    prompt: string;
    projectName: string;
    projectPath?: string;
    targetFolder?: string;
    currentFilePath?: string;
    currentCode?: string;
    model?: string;
    persona?: string;
    engine?: "claude-code" | "cloud-architect" | "auto";
    history?: Array<{ role: "user" | "assistant"; content: string }>;
  }) => Promise<{ success: boolean; data?: any; error?: string }>;
  latestResult: any | null;
  dismissTracker: () => void;
  isTrackerVisible: boolean;
}

const ProjectBuilderContext = createContext<ProjectBuilderContextType | undefined>(undefined);

const STORAGE_MESSAGES_KEY = "agent_os_project_builder_messages_v1";
const STORAGE_ACTIVE_PROJECT_KEY = "agent_os_selected_project";

export function ProjectBuilderProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [activeProject, setActiveProjectState] = useState<string>("");
  const [generatingProjects, setGeneratingProjects] = useState<Record<string, GeneratingProjectStatus>>({});
  const [latestResult, setLatestResult] = useState<any | null>(null);
  const [isTrackerVisible, setIsTrackerVisible] = useState<boolean>(false);
  const [messagesMap, setMessagesMap] = useState<Record<string, CodeMessage[]>>({});

  // Synchronous refs to prevent stale closures during async operations
  const messagesMapRef = useRef<Record<string, CodeMessage[]>>({});
  const generatingProjectsRef = useRef<Record<string, GeneratingProjectStatus>>({});

  useEffect(() => {
    messagesMapRef.current = messagesMap;
  }, [messagesMap]);

  useEffect(() => {
    generatingProjectsRef.current = generatingProjects;
  }, [generatingProjects]);

  const isProjectGenerating = useCallback((projectName: string): boolean => {
    return Boolean(generatingProjects[projectName]);
  }, [generatingProjects]);

  const isGenerating = Boolean(generatingProjects[activeProject]);
  const activeBuildingProjects = Object.keys(generatingProjects);
  const buildingProject = generatingProjects[activeProject]
    ? activeProject
    : activeBuildingProjects[0] || null;
  const buildingPrompt = (buildingProject && generatingProjects[buildingProject]?.prompt) || "";

  // Load persisted state from localStorage
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const savedProject = localStorage.getItem(STORAGE_ACTIVE_PROJECT_KEY);
        if (savedProject) {
          setActiveProjectState(savedProject);
        }

        const savedMessages = localStorage.getItem(STORAGE_MESSAGES_KEY);
        if (savedMessages) {
          const parsed = JSON.parse(savedMessages);
          if (parsed && typeof parsed === "object") {
            setMessagesMap(parsed);
            messagesMapRef.current = parsed;
          }
        }
      }
    } catch (err) {
      console.warn("[ProjectBuilder] Failed to restore localStorage:", err);
    }
  }, []);

  // Save messages to localStorage on change
  const persistMessages = useCallback((newMap: Record<string, CodeMessage[]>) => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_MESSAGES_KEY, JSON.stringify(newMap));
      }
    } catch (err) {
      console.warn("[ProjectBuilder] Failed to persist messages:", err);
    }
  }, []);

  const setActiveProject = useCallback((name: string) => {
    setActiveProjectState(name);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_ACTIVE_PROJECT_KEY, name);
      }
    } catch {}
  }, []);

  const getProjectMessages = useCallback(
    (projectName: string): CodeMessage[] => {
      return messagesMap[projectName] || [];
    },
    [messagesMap]
  );

  const loadProjectMessagesFromDisk = useCallback(
    async (projectName: string): Promise<CodeMessage[]> => {
      const clean = (projectName || "").trim();
      if (!clean) return [];

      const inMemory = messagesMapRef.current[clean];
      if (inMemory && inMemory.length > 0) {
        return inMemory;
      }

      try {
        const chatFilePath = `agent-workspace/${clean}/.project-chat.json`;
        const res = await fetch(`/api/filesystem?action=read&path=${encodeURIComponent(chatFilePath)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.content) {
            const parsed = JSON.parse(data.content);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setMessagesMap((prev) => {
                const updated = { ...prev, [clean]: parsed };
                messagesMapRef.current = updated;
                persistMessages(updated);
                return updated;
              });
              return parsed;
            }
          }
        }
      } catch (err) {
        // Silently continue
      }
      return [];
    },
    [persistMessages]
  );

  const setProjectMessages = useCallback(
    (
      projectName: string,
      updater: CodeMessage[] | ((prev: CodeMessage[]) => CodeMessage[])
    ) => {
      const clean = (projectName || "").trim();
      if (!clean) return;

      setMessagesMap((prev) => {
        const current = prev[clean] || [];
        const next = typeof updater === "function" ? updater(current) : updater;
        const updatedMap = { ...prev, [clean]: next };
        messagesMapRef.current = updatedMap;
        persistMessages(updatedMap);

        // Mirror to project folder on disk as backup
        if (typeof window !== "undefined") {
          fetch("/api/filesystem", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "write",
              path: `agent-workspace/${clean}/.project-chat.json`,
              content: JSON.stringify(next, null, 2),
            }),
          }).catch(() => {});
        }

        return updatedMap;
      });
    },
    [persistMessages]
  );

  const renameProjectMessages = useCallback(
    (oldName: string, newName: string) => {
      setMessagesMap((prev) => {
        const updated = { ...prev };
        if (updated[oldName]) {
          updated[newName] = updated[oldName];
          delete updated[oldName];
        }
        messagesMapRef.current = updated;
        persistMessages(updated);
        return updated;
      });
      if (activeProject === oldName) {
        setActiveProject(newName);
      }
    },
    [activeProject, persistMessages, setActiveProject]
  );

  const clearProjectMessages = useCallback(
    (projectName: string) => {
      setProjectMessages(projectName, []);
    },
    [setProjectMessages]
  );

  const deleteProjectMessages = useCallback(
    (projectName: string) => {
      setMessagesMap((prev) => {
        const updated = { ...prev };
        delete updated[projectName];
        messagesMapRef.current = updated;
        persistMessages(updated);
        return updated;
      });
    },
    [persistMessages]
  );

  // Check active server jobs on mount / refresh
  useEffect(() => {
    let isCancelled = false;
    async function checkActiveServerJob() {
      try {
        const res = await fetch("/api/code/generate?active=true");
        if (res.ok) {
          const data = await res.json();
          if (data.job && data.job.status === "running" && !isCancelled) {
            setGeneratingProjects((prev) => ({
              ...prev,
              [data.job.projectName]: {
                prompt: data.job.prompt,
                jobId: data.job.id,
                startedAt: data.job.startedAt,
              },
            }));
            setIsTrackerVisible(true);

            // Poll until job completes
            pollJobUntilDone(data.job.id, data.job.projectName);
          }
        }
      } catch {
        // Silently ignore
      }
    }

    checkActiveServerJob();
    return () => {
      isCancelled = true;
    };
  }, []);

  const pollJobUntilDone = useCallback(
    async (jobId: string, projectName: string) => {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/code/generate?jobId=${jobId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.job) {
              if (data.job.status === "completed") {
                clearInterval(interval);
                setGeneratingProjects((prev) => {
                  const next = { ...prev };
                  delete next[projectName];
                  return next;
                });
                setLatestResult(data.job.result);

                const createdFiles = data.job.result?.createdFiles || [];
                toast.success(
                  `Created ${createdFiles.length} files in "${projectName}"!`,
                  {
                    action: {
                      label: "Open Project",
                      onClick: () => router.push(`/code?project=${encodeURIComponent(projectName)}`),
                    },
                    duration: 8000,
                  }
                );

                // Dispatch global event for /code or any mounted listeners
                window.dispatchEvent(
                  new CustomEvent("project-build-completed", {
                    detail: {
                      projectName,
                      createdFiles,
                      primaryFile: data.job.result?.primaryFile,
                      projectTree: data.job.result?.projectTree,
                      response: data.job.result?.response,
                    },
                  })
                );
              } else if (data.job.status === "failed") {
                clearInterval(interval);
                setGeneratingProjects((prev) => {
                  const next = { ...prev };
                  delete next[projectName];
                  return next;
                });
                toast.error(data.job.error || "Project generation failed");
              }
            }
          }
        } catch {
          // Retry on next tick
        }
      }, 2500);

      // Timeout after 3 minutes
      setTimeout(() => {
        clearInterval(interval);
        setGeneratingProjects((prev) => {
          const next = { ...prev };
          delete next[projectName];
          return next;
        });
      }, 180000);
    },
    [router]
  );

  /**
   * Primary entry point for multi-file project generation.
   * Runs globally in the background even if the user navigates between routes or switches projects!
   */
  const startGeneration = useCallback(
    async (params: {
      prompt: string;
      projectName: string;
      projectPath?: string;
      targetFolder?: string;
      currentFilePath?: string;
      currentCode?: string;
      model?: string;
      persona?: string;
      engine?: "claude-code" | "cloud-architect" | "auto";
      history?: Array<{ role: "user" | "assistant"; content: string }>;
    }): Promise<{ success: boolean; data?: any; error?: string }> => {
      const cleanPrompt = params.prompt.trim();
      const projName = params.projectName.trim() || activeProject || "workspace";
      if (!cleanPrompt) {
        return { success: false, error: "Empty prompt" };
      }
      if (generatingProjectsRef.current[projName]) {
        return { success: false, error: `Project "${projName}" is already generating. Please wait.` };
      }

      // Add user message to history
      const userMsg: CodeMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: cleanPrompt,
        createdAt: new Date().toISOString(),
      };

      setProjectMessages(projName, (prev) => [...prev, userMsg]);

      // Set generating for this specific project
      setGeneratingProjects((prev) => ({
        ...prev,
        [projName]: { prompt: cleanPrompt, startedAt: Date.now() },
      }));
      setIsTrackerVisible(true);
      setLatestResult(null);

      try {
        const res = await fetch("/api/code/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: cleanPrompt,
            projectName: projName,
            projectPath: params.projectPath,
            targetFolder: params.targetFolder,
            currentFilePath: params.currentFilePath,
            currentCode: params.currentCode,
            model: params.model || "auto/best-coding",
            persona: params.persona || "default",
            engine: params.engine || "claude-code",
            history: params.history,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Project generation failed");
        }

        // Add assistant bot message with rich breakdown
        const botMsg: CodeMessage = {
          id: `bot-${Date.now()}`,
          role: "assistant",
          content: data.response || "Project built successfully.",
          createdAt: new Date().toISOString(),
          createdFiles: data.createdFiles?.map((f: any) => ({
            path: f.path,
            size: f.size,
          })),
        };

        setProjectMessages(projName, (prev) => [...prev, botMsg]);
        setLatestResult(data);

        // Global success notification with direct action button
        const fileCount = data.createdFiles?.length || 0;
        toast.success(
          `Agent finished building "${projName}"! (${fileCount} ${
            fileCount === 1 ? "file" : "files"
          } created)`,
          {
            action: {
              label: "Open in Code Studio",
              onClick: () => router.push(`/code?project=${encodeURIComponent(projName)}`),
            },
            duration: 8000,
          }
        );

        // Dispatch browser-wide event so Code Studio can refresh preview, tree, and open primary file
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent<BuildCompletedEventDetail>("project-build-completed", {
              detail: {
                projectName: projName,
                createdFiles: data.createdFiles || [],
                primaryFile: data.primaryFile,
                projectTree: data.projectTree,
                response: data.response,
              },
            })
          );
        }

        return { success: true, data };
      } catch (err: any) {
        console.error("[ProjectBuilder] Generation error:", err);
        const errMsg = err.message || "Failed to generate project";
        toast.error(errMsg);
        return { success: false, error: errMsg };
      } finally {
        setGeneratingProjects((prev) => {
          const next = { ...prev };
          delete next[projName];
          return next;
        });
      }
    },
    [router, setProjectMessages]
  );

  const dismissTracker = useCallback(() => {
    setIsTrackerVisible(false);
  }, []);

  return (
    <ProjectBuilderContext.Provider
      value={{
        isGenerating,
        isProjectGenerating,
        generatingProjects,
        activeBuildingProjects,
        buildingProject,
        buildingPrompt,
        activeProject,
        setActiveProject,
        getProjectMessages,
        loadProjectMessagesFromDisk,
        setProjectMessages,
        renameProjectMessages,
        allMessagesMap: messagesMap,
        clearProjectMessages,
        deleteProjectMessages,
        startGeneration,
        latestResult,
        dismissTracker,
        isTrackerVisible,
      }}
    >
      {children}
    </ProjectBuilderContext.Provider>
  );
}

export function useProjectBuilder() {
  const context = useContext(ProjectBuilderContext);
  if (!context) {
    throw new Error("useProjectBuilder must be used within a ProjectBuilderProvider");
  }
  return context;
}
