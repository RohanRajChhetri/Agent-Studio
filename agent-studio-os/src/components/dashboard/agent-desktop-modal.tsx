"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Monitor,
  X,
  RefreshCw,
  Maximize2,
  Minimize2,
  Download,
  Radio,
  MousePointer,
  Hand,
  Pause,
  Play,
  Sparkles,
  Bot,
  ArrowUp,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Eye,
  Square,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { AgentAvatar } from "@/components/ui/agent-avatar";

interface AgentDesktopModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialScreenshotUrl?: string | null;
  actionTitle?: string | null;
}

interface ExecutionStep {
  description: string;
  action: string;
  success: boolean;
  latency: number;
}

interface DesktopTaskResult {
  success: boolean;
  goal: string;
  stepsExecuted: number;
  steps: ExecutionStep[];
  finalScreenshotUrl?: string;
  summary: string;
  totalLatency: number;
  timestamp: string;
}

export function AgentDesktopModal({
  isOpen,
  onClose,
  initialScreenshotUrl,
  actionTitle,
}: AgentDesktopModalProps) {
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(initialScreenshotUrl || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLiveStream, setIsLiveStream] = useState(true);
  const [viewMode, setViewMode] = useState<"live" | "output">("live");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [timestamp, setTimestamp] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  const [quickCommand, setQuickCommand] = useState("");
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);
  const [executionResult, setExecutionResult] = useState<DesktopTaskResult | null>(null);
  const [isOutputExpanded, setIsOutputExpanded] = useState<boolean>(true);

  // Human Takeover & Interactive Control State
  const [humanTakeover, setHumanTakeover] = useState(true);
  const [agentPaused, setAgentPaused] = useState(false);

  // Live Agent Telemetry & Visual Cursor State
  const [agentCursor, setAgentCursor] = useState<{ x: number; y: number } | null>({ x: 960, y: 540 });
  const [agentClickRipple, setAgentClickRipple] = useState<{ x: number; y: number; id: number; type?: string } | null>(null);
  const [currentStep, setCurrentStep] = useState<string>(actionTitle || "Desktop Operator Ready");
  const [isAgentOperating, setIsAgentOperating] = useState<boolean>(false);
  const [renderedSize, setRenderedSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const liveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef(false);
  const lastTelemetrySinceRef = useRef<number>(0);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch current desktop screenshot from native CUA engine + telemetry
  const fetchScreenshot = useCallback(async (showToast = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (showToast) setIsLoading(true);

    try {
      const sinceParam = lastTelemetrySinceRef.current;
      const res = await fetch(`/api/tools/desktop/screenshot?t=${Date.now()}&since=${sinceParam}`);
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to capture desktop screenshot");
      }

      const url = data.imageUrl || (data.screenshot ? `data:image/jpeg;base64,${data.screenshot}` : null);
      if (url && viewMode === "live") {
        setScreenshotUrl(url);
      }
      if (data.latency) setLatency(data.latency);
      if (data.timestamp) setTimestamp(new Date(data.timestamp).toLocaleTimeString());

      // Telemetry processing
      if (data.telemetry) {
        if (data.telemetry.latestStep) {
          setCurrentStep(data.telemetry.latestStep);
        }
        if (data.telemetry.cursor && typeof data.telemetry.cursor.x === "number") {
          setAgentCursor({ x: data.telemetry.cursor.x, y: data.telemetry.cursor.y });
        }

        if (Array.isArray(data.telemetry.events) && data.telemetry.events.length > 0) {
          const clicks = data.telemetry.events.filter(
            (e: any) => e.action === "click" || e.action === "double_click" || e.action === "right_click"
          );
          if (clicks.length > 0) {
            const lastClick = clicks[clicks.length - 1];
            if (lastClick.x && lastClick.y) {
              setAgentClickRipple({
                x: lastClick.x,
                y: lastClick.y,
                id: Date.now(),
                type: lastClick.action,
              });
              setTimeout(() => setAgentClickRipple(null), 1200);
            }
          }

          lastTelemetrySinceRef.current = Date.now() - 500;
        }
      }

      if (showToast) {
        toast.success("Desktop stream refreshed");
      }
    } catch (err) {
      if (showToast) {
        toast.error(err instanceof Error ? err.message : "Failed to capture desktop");
      }
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, [viewMode]);

  // When modal opens, populate initial and ensure live stream is actively running
  useEffect(() => {
    if (isOpen) {
      setIsLiveStream(true);
      setViewMode("live");
      if (initialScreenshotUrl) {
        setScreenshotUrl(initialScreenshotUrl);
        setTimestamp(new Date().toLocaleTimeString());
      }
      fetchScreenshot();
      if (actionTitle) {
        setCurrentStep(actionTitle);
      }
    } else {
      if (liveIntervalRef.current) {
        clearInterval(liveIntervalRef.current);
        liveIntervalRef.current = null;
      }
    }
  }, [isOpen, initialScreenshotUrl, actionTitle, fetchScreenshot]);

  // Handle continuous live stream polling (only when in live view mode)
  useEffect(() => {
    const pollInterval = isAgentOperating ? 400 : 1000;
    if (isLiveStream && isOpen && !agentPaused && viewMode === "live") {
      liveIntervalRef.current = setInterval(() => {
        fetchScreenshot();
      }, pollInterval);
    } else {
      if (liveIntervalRef.current) {
        clearInterval(liveIntervalRef.current);
        liveIntervalRef.current = null;
      }
    }
    return () => {
      if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
    };
  }, [isLiveStream, isOpen, agentPaused, isAgentOperating, viewMode, fetchScreenshot]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Track rendered image element dimensions safely outside of render phase
  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      setRenderedSize({ width: rect.width, height: rect.height });
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    window.addEventListener("resize", updateSize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, [screenshotUrl]);

  // Direct Click on Screen Viewport (Interactive Human Takeover)
  const handleViewportClick = async (e: React.MouseEvent<HTMLImageElement>) => {
    if (!humanTakeover || !imgRef.current) return;

    const rect = imgRef.current.getBoundingClientRect();
    const naturalW = imgRef.current.naturalWidth || dimensions?.width || 1920;
    const naturalH = imgRef.current.naturalHeight || dimensions?.height || 1080;

    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const scaleX = naturalW / rect.width;
    const scaleY = naturalH / rect.height;

    const screenX = Math.round(clickX * scaleX);
    const screenY = Math.round(clickY * scaleY);

    setAgentCursor({ x: screenX, y: screenY });
    setAgentClickRipple({ x: screenX, y: screenY, id: Date.now(), type: "click" });
    setTimeout(() => setAgentClickRipple(null), 900);

    setCurrentStep(`Direct Click at (${screenX}, ${screenY})`);

    try {
      const res = await fetch("/api/tools/desktop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action_type: "click",
          coordinates: { x: screenX, y: screenY },
          source: "human",
        }),
      });

      const data = await res.json();
      if (data.screenshot) {
        setScreenshotUrl(`data:image/jpeg;base64,${data.screenshot}`);
      } else {
        setTimeout(() => fetchScreenshot(), 150);
      }
    } catch {
      // Ignore
    }
  };

  // Execute Autonomous Desktop Goal
  const handleExecuteGoal = async (goalToExecute?: string) => {
    const cmd = (goalToExecute || quickCommand).trim();
    if (!cmd || isExecutingCommand) return;

    setIsExecutingCommand(true);
    setIsAgentOperating(true);
    setCurrentStep(`Executing: "${cmd}"`);
    toast.info(`Desktop Operator started: "${cmd}"`);

    try {
      const res = await fetch("/api/tools/desktop/autonomous", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: cmd }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Desktop execution failed");
      }

      const result: DesktopTaskResult = {
        success: data.success ?? true,
        goal: cmd,
        stepsExecuted: data.stepsExecuted || data.steps?.length || 1,
        steps: data.steps || [],
        finalScreenshotUrl: data.finalScreenshotUrl,
        summary: data.summary || `Task completed successfully (${data.stepsExecuted || 1} actions).`,
        totalLatency: data.totalLatency || 0,
        timestamp: new Date().toLocaleTimeString(),
      };

      setExecutionResult(result);
      setIsOutputExpanded(true);

      // If output deliverable contains screenshot, display it and set view mode to output
      if (data.finalScreenshotUrl) {
        const urlWithCacheBust = `${data.finalScreenshotUrl}?t=${Date.now()}`;
        setScreenshotUrl(urlWithCacheBust);
        setViewMode("output");
      } else {
        fetchScreenshot();
      }

      toast.success(`Completed ${result.stepsExecuted} action${result.stepsExecuted === 1 ? "" : "s"}. Output deliverable ready.`);
      setQuickCommand("");
      setCurrentStep(`Completed: "${cmd}" (${result.stepsExecuted} actions)`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Error";
      toast.error(err instanceof Error ? err.message : "Desktop task failed");
      setCurrentStep(`Failed: ${errMsg}`);
      setExecutionResult({
        success: false,
        goal: cmd,
        stepsExecuted: 0,
        steps: [],
        summary: `Execution failed: ${errMsg}`,
        totalLatency: 0,
        timestamp: new Date().toLocaleTimeString(),
      });
      setIsOutputExpanded(true);
    } finally {
      setIsExecutingCommand(false);
      setIsAgentOperating(false);
    }
  };

  // Emergency Killswitch handler
  const handleEmergencyAbort = async () => {
    try {
      await fetch("/api/tools/desktop/abort", { method: "POST" });
      toast.error("Emergency Killswitch Triggered: Stopping Desktop Operator immediately!");
      setIsExecutingCommand(false);
      setIsAgentOperating(false);
      setCurrentStep("Halted by operator killswitch");
    } catch (err) {
      console.error("Emergency abort failed:", err);
    }
  };

  // Keyboard shortcut listener: Pressing Escape while agent operates triggers killswitch
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && (isExecutingCommand || isAgentOperating)) {
        e.preventDefault();
        handleEmergencyAbort();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExecutingCommand, isAgentOperating]);

  const handleDownload = () => {
    if (!screenshotUrl) return;
    const a = document.createElement("a");
    a.href = screenshotUrl;
    a.download = `agent-desktop-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("Desktop snapshot downloaded");
  };

  if (!isOpen) return null;

  // Calculate scaled cursor pixel coordinates on displayed image
  const naturalW = dimensions?.width || 1920;
  const naturalH = dimensions?.height || 1080;
  const effectiveWidth = renderedSize.width || naturalW;
  const effectiveHeight = renderedSize.height || naturalH;

  const cursorDomLeft = agentCursor ? (agentCursor.x / naturalW) * effectiveWidth : 0;
  const cursorDomTop = agentCursor ? (agentCursor.y / naturalH) * effectiveHeight : 0;
  const rippleDomLeft = agentClickRipple ? (agentClickRipple.x / naturalW) * effectiveWidth : 0;
  const rippleDomTop = agentClickRipple ? (agentClickRipple.y / naturalH) * effectiveHeight : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 w-full ${
          isFullscreen
            ? "fixed inset-1 sm:inset-2 h-[calc(100vh-8px)] sm:h-[calc(100vh-16px)]"
            : "max-w-6xl h-[92vh] max-h-[920px]"
        }`}
      >
        {/* ========================================================= */}
        {/* 1. REFINED HEADER BAR                                     */}
        {/* ========================================================= */}
        <div className="px-4 sm:px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between shrink-0 select-none">
          {/* Left: Branding & Status */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center text-primary shrink-0 shadow-2xs">
                <AgentAvatar avatar="bot" className="w-4 h-4 text-primary" />
              </div>
              {isAgentOperating && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-semibold text-foreground tracking-tight">
                  Desktop Operator
                </h3>

                {/* State Pill */}
                <div
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${
                    isAgentOperating
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                      : viewMode === "output"
                      ? "bg-primary/10 text-primary border-primary/20"
                      : isLiveStream
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      : "bg-secondary text-muted-foreground border-border"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isAgentOperating
                        ? "bg-amber-500 animate-pulse"
                        : viewMode === "output"
                        ? "bg-primary"
                        : isLiveStream
                        ? "bg-emerald-500"
                        : "bg-muted-foreground/60"
                    }`}
                  />
                  <span>
                    {isAgentOperating
                      ? "Running Action"
                      : viewMode === "output"
                      ? "Viewing Output"
                      : isLiveStream
                      ? "Live Stream"
                      : "Stream Paused"}
                  </span>
                </div>

                {agentPaused && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    Paused
                  </span>
                )}
              </div>

              {/* Sub-label resolution and latency */}
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono mt-0.5">
                <span>Windows CUA</span>
                {dimensions && (
                  <>
                    <span className="opacity-40">•</span>
                    <span>
                      {dimensions.width}×{dimensions.height}
                    </span>
                  </>
                )}
                {latency !== null && (
                  <>
                    <span className="opacity-40">•</span>
                    <span className="text-primary font-medium">{latency}ms</span>
                  </>
                )}
                {timestamp && (
                  <>
                    <span className="opacity-40 hidden sm:inline">•</span>
                    <span className="opacity-70 hidden sm:inline">{timestamp}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: Streamlined Controls & Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Emergency Killswitch (Visible whenever agent is operating) */}
            {(isExecutingCommand || isAgentOperating) && (
              <button
                type="button"
                onClick={handleEmergencyAbort}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25 transition animate-pulse cursor-pointer shadow-2xs"
                title="Emergency Stop: Halt autonomous execution immediately (or press Esc)"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Emergency Stop</span>
              </button>
            )}

            {/* Takeover Control Toggle */}
            <button
              type="button"
              onClick={() => setHumanTakeover((prev) => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition cursor-pointer ${
                humanTakeover
                  ? "bg-primary/15 text-primary border-primary/30 shadow-2xs font-semibold"
                  : "bg-secondary hover:bg-secondary/80 border-border text-muted-foreground hover:text-foreground"
              }`}
              title={
                humanTakeover
                  ? "Interactive Click Takeover is enabled (click anywhere on screen to send input)"
                  : "Click to enable direct click takeover on screen"
              }
            >
              <Hand className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {humanTakeover ? "Takeover Active" : "Takeover"}
              </span>
            </button>

            {/* View Mode Toggle: Live vs Output */}
            {executionResult?.finalScreenshotUrl && (
              <button
                type="button"
                onClick={() => {
                  if (viewMode === "output") {
                    setViewMode("live");
                    fetchScreenshot();
                  } else {
                    setViewMode("output");
                    setScreenshotUrl(`${executionResult.finalScreenshotUrl}?t=${Date.now()}`);
                  }
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition cursor-pointer ${
                  viewMode === "output"
                    ? "bg-primary/15 text-primary border-primary/30 shadow-2xs font-semibold"
                    : "bg-secondary hover:bg-secondary/80 border-border text-muted-foreground hover:text-foreground"
                }`}
                title={viewMode === "output" ? "Switch to live desktop display" : "Inspect captured output screenshot"}
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {viewMode === "output" ? "Output View" : "Show Output"}
                </span>
              </button>
            )}

            {/* Live Stream Toggle */}
            <button
              type="button"
              onClick={() => {
                if (viewMode === "output") {
                  setViewMode("live");
                }
                setIsLiveStream((prev) => !prev);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition cursor-pointer ${
                isLiveStream && viewMode === "live"
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-semibold"
                  : "bg-secondary hover:bg-secondary/80 border-border text-muted-foreground hover:text-foreground"
              }`}
              title={isLiveStream ? "Pause continuous live stream" : "Resume continuous live stream"}
            >
              <Radio className={`w-3.5 h-3.5 ${isLiveStream && viewMode === "live" ? "animate-pulse" : ""}`} />
              <span className="hidden sm:inline">
                {isLiveStream && viewMode === "live" ? "Live" : "Stream"}
              </span>
            </button>

            {/* Agent Automation Pause / Resume */}
            <button
              type="button"
              onClick={() => {
                setAgentPaused((prev) => !prev);
                toast(agentPaused ? "Agent automation resumed" : "Agent automation paused");
              }}
              className={`p-1.5 rounded-md border transition cursor-pointer ${
                agentPaused
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                  : "bg-secondary hover:bg-secondary/80 border-border text-muted-foreground hover:text-foreground"
              }`}
              title={agentPaused ? "Resume agent execution" : "Pause agent execution"}
            >
              {agentPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            </button>

            {/* Manual Refresh */}
            <button
              type="button"
              onClick={() => {
                setViewMode("live");
                fetchScreenshot(true);
              }}
              disabled={isLoading}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary bg-secondary/50 border border-border transition cursor-pointer disabled:opacity-50"
              title="Refresh desktop capture"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-primary" : ""}`} />
            </button>

            {/* Download Snapshot */}
            <button
              type="button"
              onClick={handleDownload}
              disabled={!screenshotUrl}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary bg-secondary/50 border border-border transition cursor-pointer disabled:opacity-50"
              title="Download snapshot image"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {/* Toggle Fullscreen */}
            <button
              type="button"
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary bg-secondary/50 border border-border transition cursor-pointer"
              title={isFullscreen ? "Exit fullscreen" : "Maximize window"}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            <div className="w-[1px] h-4 bg-border mx-0.5" />

            {/* Close Button */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-border hover:border-destructive/30 transition cursor-pointer"
              title="Close Desktop Operator (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. UNCLUTTERED DESKTOP VIEWPORT                           */}
        {/* ========================================================= */}
        <div
          ref={containerRef}
          className="flex-1 bg-black relative overflow-auto flex items-center justify-center p-2.5 sm:p-4 min-h-0 select-none"
        >
          {/* Subtle Output Mode Notice (Top Center) */}
          {viewMode === "output" && (
            <div className="absolute top-4 z-30 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-card/95 border border-border backdrop-blur-md shadow-xl text-xs font-medium text-foreground">
              <Eye className="w-3.5 h-3.5 text-primary" />
              <span>Viewing Captured Task Screenshot</span>
              <button
                type="button"
                onClick={() => {
                  setViewMode("live");
                  fetchScreenshot();
                }}
                className="ml-1 text-[11px] px-2 py-0.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition cursor-pointer border border-primary/20"
              >
                Switch to Live Stream
              </button>
            </div>
          )}

          {/* Connecting State */}
          {isLoading && !screenshotUrl && (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xs">Connecting to Windows desktop display...</p>
            </div>
          )}

          {/* Screen Image Display */}
          {screenshotUrl ? (
            <div className="relative max-w-full max-h-full flex items-center justify-center rounded-lg overflow-hidden border border-border/80 shadow-2xl bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={screenshotUrl}
                alt="Windows Desktop Display"
                onClick={handleViewportClick}
                className={`max-w-full max-h-[calc(92vh-220px)] object-contain select-none transition-all ${
                  humanTakeover ? "cursor-crosshair hover:opacity-95" : "cursor-default"
                }`}
                onLoad={(e) => {
                  const target = e.currentTarget;
                  setDimensions({ width: target.naturalWidth, height: target.naturalHeight });
                  const rect = target.getBoundingClientRect();
                  setRenderedSize({ width: rect.width, height: rect.height });
                }}
              />

              {/* VIRTUAL AGENT MOUSE CURSOR */}
              {agentCursor && dimensions && (
                <div
                  className="absolute pointer-events-none transition-all duration-200 ease-out z-20"
                  style={{
                    left: `${cursorDomLeft}px`,
                    top: `${cursorDomTop}px`,
                    transform: "translate(-2px, -2px)",
                  }}
                >
                  <div className="relative flex flex-col items-start">
                    <svg
                      className="w-5 h-5 filter drop-shadow-[0_2px_8px_rgba(0,117,222,0.8)] text-primary"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M4.5 3.5L10.5 20.5L13.5 13.5L20.5 10.5L4.5 3.5Z" />
                    </svg>
                    <div className="px-1.5 py-0.5 rounded bg-card/95 border border-border shadow-md text-[9px] font-mono text-foreground whitespace-nowrap -mt-0.5 ml-3">
                      ({agentCursor.x}, {agentCursor.y})
                    </div>
                  </div>
                </div>
              )}

              {/* RADAR CLICK RIPPLE */}
              {agentClickRipple && dimensions && (
                <div
                  className="absolute pointer-events-none z-10 -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: `${rippleDomLeft}px`,
                    top: `${rippleDomTop}px`,
                  }}
                >
                  <div className="w-12 h-12 rounded-full border-2 border-primary bg-primary/20 animate-ping" />
                  <div className="absolute inset-0 w-3.5 h-3.5 m-auto rounded-full bg-primary shadow-md shadow-primary/50" />
                </div>
              )}
            </div>
          ) : (
            !isLoading && (
              <div className="text-center p-8 text-muted-foreground space-y-3">
                <Monitor className="w-12 h-12 mx-auto opacity-40 text-primary" />
                <p className="text-sm font-medium text-foreground">Desktop Stream Ready</p>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("live");
                    fetchScreenshot(true);
                  }}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-xs transition cursor-pointer hover:bg-primary/90 shadow-2xs"
                >
                  Capture Primary Display
                </button>
              </div>
            )
          )}
        </div>

        {/* ========================================================= */}
        {/* 3. TASK EXECUTION OUTPUT & DELIVERABLES PANEL             */}
        {/* ========================================================= */}
        {executionResult && (
          <div className="px-4 sm:px-5 py-2.5 bg-muted/30 border-t border-border flex flex-col gap-2 shrink-0 select-none animate-in fade-in duration-200">
            {/* Output Header Bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {executionResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                )}
                <span className="text-xs font-semibold text-foreground">
                  Task Execution Output
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-primary/10 text-primary font-mono border border-primary/20">
                  {executionResult.stepsExecuted} action{executionResult.stepsExecuted === 1 ? "" : "s"} • {executionResult.totalLatency}ms
                </span>
                <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">
                  {executionResult.timestamp}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {/* View Output Screenshot Toggle */}
                {executionResult.finalScreenshotUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      if (viewMode === "output") {
                        setViewMode("live");
                        fetchScreenshot();
                      } else {
                        setViewMode("output");
                        setScreenshotUrl(`${executionResult.finalScreenshotUrl}?t=${Date.now()}`);
                      }
                    }}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium border transition cursor-pointer flex items-center gap-1.5 ${
                      viewMode === "output"
                        ? "bg-primary/15 text-primary border-primary/30 font-semibold shadow-2xs"
                        : "bg-secondary hover:bg-secondary/80 text-foreground border-border"
                    }`}
                    title={viewMode === "output" ? "Switch view to live stream" : "Inspect captured output screenshot"}
                  >
                    <Eye className="w-3 h-3" />
                    <span>{viewMode === "output" ? "Viewing Output" : "View Output"}</span>
                  </button>
                )}

                {/* Direct Download Screenshot button */}
                {executionResult.finalScreenshotUrl && (
                  <a
                    href={executionResult.finalScreenshotUrl}
                    download={`desktop-output-${Date.now()}.jpg`}
                    className="px-2 py-1 rounded-md text-[11px] font-medium bg-secondary hover:bg-secondary/80 text-foreground border border-border transition cursor-pointer flex items-center gap-1"
                    title="Download output screenshot file"
                  >
                    <Download className="w-3 h-3" />
                    <span className="hidden sm:inline">Download</span>
                  </a>
                )}

                {/* Open screenshot in new tab */}
                {executionResult.finalScreenshotUrl && (
                  <a
                    href={executionResult.finalScreenshotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition cursor-pointer"
                    title="Open screenshot in new browser tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}

                {/* Expand / Collapse Details */}
                <button
                  type="button"
                  onClick={() => setIsOutputExpanded(!isOutputExpanded)}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition cursor-pointer"
                  title={isOutputExpanded ? "Collapse output details" : "Expand output details"}
                >
                  {isOutputExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {/* Dismiss Output Panel */}
                <button
                  type="button"
                  onClick={() => {
                    setExecutionResult(null);
                    setViewMode("live");
                    fetchScreenshot();
                  }}
                  className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition cursor-pointer"
                  title="Dismiss output"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Expandable Output Details */}
            {isOutputExpanded && (
              <div className="space-y-2 pt-1">
                {/* Summary & Goal */}
                <div className="text-xs text-foreground/90 flex flex-col gap-0.5">
                  <p className="leading-snug">{executionResult.summary}</p>
                </div>

                {/* Screenshot Evidence Card */}
                {executionResult.finalScreenshotUrl && (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-card border border-border">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        onClick={() => {
                          setViewMode("output");
                          setScreenshotUrl(`${executionResult.finalScreenshotUrl}?t=${Date.now()}`);
                        }}
                        className="w-10 h-7 rounded border border-border overflow-hidden bg-muted shrink-0 cursor-pointer hover:border-primary transition"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={executionResult.finalScreenshotUrl}
                          alt="Captured Deliverable Thumbnail"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-mono text-foreground truncate">
                          {executionResult.finalScreenshotUrl.split("/").pop()}
                        </p>
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                          Captured screenshot saved to local deliverables
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setViewMode("output");
                        setScreenshotUrl(`${executionResult.finalScreenshotUrl}?t=${Date.now()}`);
                      }}
                      className="px-2.5 py-1 text-[11px] rounded-md bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 font-medium transition cursor-pointer shrink-0 ml-2"
                    >
                      Inspect Screen
                    </button>
                  </div>
                )}

                {/* Steps Breakdown */}
                {executionResult.steps.length > 0 && (
                  <div className="space-y-1">
                    {executionResult.steps.map((st, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between py-1 px-2.5 rounded-md bg-secondary/40 border border-border/40 text-[11px] font-mono"
                      >
                        <div className="flex items-center gap-2 truncate">
                          {st.success ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                          ) : (
                            <AlertCircle className="w-3 h-3 text-destructive shrink-0" />
                          )}
                          <span className="text-primary font-semibold uppercase text-[10px] px-1.5 py-0.5 rounded bg-primary/10">
                            {st.action}
                          </span>
                          <span className="text-foreground/90 truncate">{st.description}</span>
                        </div>
                        <span className="text-muted-foreground text-[10px] shrink-0 ml-2">
                          {st.latency}ms
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* 4. SLIM STATUS & TELEMETRY STRIP                          */}
        {/* ========================================================= */}
        <div className="px-4 sm:px-5 py-2 bg-muted/20 border-t border-border/70 flex items-center justify-between text-xs text-muted-foreground select-none">
          <div className="flex items-center gap-2 truncate max-w-xl">
            {isAgentOperating ? (
              <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin shrink-0" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            )}
            <span className="text-muted-foreground font-medium">Status:</span>
            <span className="text-foreground font-medium truncate">
              {currentStep}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
            {humanTakeover ? (
              <span className="flex items-center gap-1.5 text-primary font-medium">
                <MousePointer className="w-3 h-3" />
                Interactive click takeover active
              </span>
            ) : (
              <span>Autonomous agent observation mode</span>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* 5. STREAMLINED COMMAND COCKPIT                             */}
        {/* ========================================================= */}
        <div className="px-4 sm:px-5 py-3 border-t border-border bg-card flex flex-col gap-2 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleExecuteGoal();
            }}
            className="flex items-center gap-2 w-full"
          >
            <div className="relative flex-1 group">
              <Sparkles className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                value={quickCommand}
                onChange={(e) => setQuickCommand(e.target.value)}
                placeholder='Instruct Desktop Operator: e.g. "take a screenshot", "open youtube wait 2 seconds and take a screen shot"...'
                className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition shadow-2xs"
              />
            </div>

            <button
              type="submit"
              disabled={!quickCommand.trim() || isExecutingCommand}
              className="px-4 sm:px-5 py-2.5 rounded-lg text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition cursor-pointer flex items-center gap-2 shrink-0 shadow-2xs disabled:opacity-40 disabled:pointer-events-none"
            >
              {isExecutingCommand ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Executing...</span>
                </>
              ) : (
                <>
                  <ArrowUp className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Execute Goal</span>
                  <span className="sm:hidden">Run</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
