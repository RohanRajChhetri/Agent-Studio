import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import { recordCUATelemetry } from "./cua-telemetry";

const execFileAsync = promisify(execFile);

let lastActionMarker: { x: number; y: number } | null = null;
let cachedCuaBinary: string | null = null;
let cuaChecked = false;
let nativeToolPath: string | null = null;
let nativeToolChecked = false;

function getNativeToolPath(): string | null {
  if (nativeToolChecked) return nativeToolPath;
  nativeToolChecked = true;
  const candidate = path.join(process.cwd(), "bin", "cua-tool.exe");
  if (fsSync.existsSync(candidate)) {
    nativeToolPath = candidate;
    return candidate;
  }
  nativeToolPath = null;
  return null;
}

export interface CUAAction {
  type:
    | "click"
    | "double_click"
    | "right_click"
    | "mouse_move"
    | "move"
    | "drag"
    | "type"
    | "screenshot"
    | "scroll"
    | "key"
    | "hotkey"
    | "inspect"
    | "launch"
    | "active_window"
    | "wait"
    | "sleep";
  target?: string;
  text?: string;
  coordinates?: { x: number; y: number };
  fromCoordinates?: { x: number; y: number };
  key?: string;
  combo?: string;
  direction?: "up" | "down" | "left" | "right";
  amount?: number;
  duration?: number;
  smooth?: boolean;
  stepTitle?: string;
  source?: "agent" | "human";
}

export interface CUAResult {
  success: boolean;
  action: string;
  output?: string;
  screenshot?: string;
  elements?: CUAElement[];
  error?: string;
  latency: number;
}

export interface CUAElement {
  role: string;
  name: string;
  bounds: { x: number; y: number; width: number; height: number };
  value?: string;
  children?: CUAElement[];
}

/**
 * Execute a CUA Driver action against the local desktop.
 */
export async function executeCUAAction(action: CUAAction): Promise<CUAResult> {
  const start = Date.now();

  try {
    switch (action.type) {
      case "screenshot":
        return await captureScreenshot(start);
      case "inspect":
        return await inspectScreen(action.target, start);
      case "click":
        return await performClick(action, start);
      case "double_click":
        return await performDoubleClick(action, start);
      case "right_click":
        return await performRightClick(action, start);
      case "mouse_move":
      case "move":
        return await performMouseMove(action, start);
      case "drag":
        return await performDrag(action, start);
      case "type":
        return await performType(action, start);
      case "launch":
        return await launchApp(action.target || "", start, action.stepTitle, action.source);
      case "key":
        return await pressKey(action.key || "", start, action.stepTitle, action.source);
      case "hotkey":
        return await performHotkey(action.combo || action.key || "", start, action.stepTitle, action.source);
      case "scroll":
        return await performScroll(action, start);
      case "active_window":
        return await performGetActiveWindow(start);
      case "wait":
      case "sleep": {
        const waitMs = action.duration && action.duration > 0 ? action.duration : 1000;
        recordCUATelemetry({
          action: "step",
          source: action.source || "agent",
          stepTitle: action.stepTitle || `Wait ${waitMs}ms`,
        });
        await new Promise((r) => setTimeout(r, waitMs));
        return {
          success: true,
          action: "wait",
          output: `Waited ${waitMs}ms`,
          latency: Date.now() - start,
        };
      }
      default:
        return {
          success: false,
          action: (action as any).type,
          error: `Unknown CUA action type: "${(action as any).type}". Supported: screenshot, inspect, click, double_click, right_click, move, drag, type, launch, key, hotkey, scroll, active_window, wait`,
          latency: Date.now() - start,
        };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      action: action.type,
      error: msg,
      latency: Date.now() - start,
    };
  }
}

/** Resolve the CUA CLI binary once, then cache result permanently */
async function getCUABinary(): Promise<string | null> {
  if (cuaChecked) return cachedCuaBinary;
  cuaChecked = true;
  try {
    await execFileAsync("cua-driver", ["--version"], { timeout: 800, windowsHide: true });
    cachedCuaBinary = "cua-driver";
    return "cua-driver";
  } catch {
    try {
      await execFileAsync("cua", ["--version"], { timeout: 800, windowsHide: true });
      cachedCuaBinary = "cua";
      return "cua";
    } catch {
      cachedCuaBinary = null;
      return null;
    }
  }
}

async function captureScreenshot(start: number, marker?: { x: number; y: number }): Promise<CUAResult> {
  const downloadDir = path.join(process.cwd(), "public", "downloads");
  await fs.mkdir(downloadDir, { recursive: true });
  const fileName = "latest-desktop.jpg";
  const filePath = path.join(downloadDir, fileName).replace(/\\/g, "/");

  const effectiveMarker = marker || lastActionMarker;
  const markerX = effectiveMarker ? effectiveMarker.x : -1;
  const markerY = effectiveMarker ? effectiveMarker.y : -1;

  // 1. High-Speed Native CUA Tool (50ms)
  const nativeTool = getNativeToolPath();
  if (nativeTool) {
    try {
      await execFileAsync(
        nativeTool,
        ["screenshot", filePath, String(markerX), String(markerY)],
        { timeout: 5000, windowsHide: true }
      );
      lastActionMarker = null;

      let b64 = "";
      try {
        const fileBuf = await fs.readFile(filePath);
        b64 = fileBuf.toString("base64");
      } catch {}

      return {
        success: true,
        action: "screenshot",
        screenshot: b64,
        output: "Desktop screenshot captured via high-speed native CUA engine",
        latency: Date.now() - start,
      };
    } catch {
      // Fall through to CUA CLI or PowerShell fallback
    }
  }

  // 2. CUA CLI if installed
  const bin = await getCUABinary();
  if (bin) {
    try {
      const { stdout } = await execFileAsync(bin, ["screenshot", "--format", "base64"], {
        timeout: 5000,
        windowsHide: true,
      });
      return {
        success: true,
        action: "screenshot",
        screenshot: stdout.trim(),
        output: "Desktop screenshot captured successfully",
        latency: Date.now() - start,
      };
    } catch {
      // Fall through to native subsystem
    }
  }

  // 3. Fallback: Native Windows Subsystem via PowerShell
  try {
    const markerScript = effectiveMarker
      ? `$markerX = ${effectiveMarker.x}; $markerY = ${effectiveMarker.y};`
      : "$markerX = -1; $markerY = -1;";

    const psScript = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class DpiAwareScreenshot {
    [DllImport("user32.dll")]
    public static extern bool SetProcessDPIAware();
}
"@
[DpiAwareScreenshot]::SetProcessDPIAware() | Out-Null
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
${markerScript}
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)

if ($markerX -ge 0 -and $markerY -ge 0) {
    $outerPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(239, 68, 68), 4)
    $innerBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(140, 239, 68, 68))
    $graphics.FillEllipse($innerBrush, [int]($markerX - 10), [int]($markerY - 10), 20, 20)
    $graphics.DrawEllipse($outerPen, [int]($markerX - 22), [int]($markerY - 22), 44, 44)
    $innerBrush.Dispose()
    $outerPen.Dispose()
}

$ms = New-Object System.IO.MemoryStream
$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Jpeg)
$b64 = [Convert]::ToBase64String($ms.ToArray())
$bmp.Save("${filePath}", [System.Drawing.Imaging.ImageFormat]::Jpeg)
$graphics.Dispose()
$bmp.Dispose()
$ms.Dispose()
Write-Output $b64
`;

    const { stdout: psOut } = await execFileAsync(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", psScript],
      {
        timeout: 8000,
        windowsHide: true,
      }
    );

    // Clear marker after capturing
    lastActionMarker = null;

    return {
      success: true,
      action: "screenshot",
      screenshot: psOut.trim(),
      output: "Desktop screenshot captured via native Windows subsystem",
      latency: Date.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      action: "screenshot",
      error: `Screenshot failed: ${err instanceof Error ? err.message : String(err)}`,
      latency: Date.now() - start,
    };
  }
}

async function inspectScreen(target: string | undefined, start: number): Promise<CUAResult> {
  const bin = await getCUABinary();
  if (bin) {
    const args = ["inspect"];
    if (target) args.push("--app", target);

    try {
      const { stdout } = await execFileAsync(bin, args, {
        timeout: 10000,
        windowsHide: true,
      });

      let elements: CUAElement[] = [];
      try {
        elements = JSON.parse(stdout);
      } catch {
        // Output may not be JSON, treat as plain text
      }

      return {
        success: true,
        action: "inspect",
        output: stdout.trim(),
        elements,
        latency: Date.now() - start,
      };
    } catch {
      // Fall through to native fallback
    }
  }

  // Fallback: list visible top-level windows via PowerShell
  try {
    const psScript = `Get-Process | Where-Object { $_.MainWindowTitle } | Select-Object -Property ProcessName, MainWindowTitle | ConvertTo-Json`;
    const { stdout: psOut } = await execFileAsync("powershell", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", psScript], {
      timeout: 8000,
      windowsHide: true,
    });
    return {
      success: true,
      action: "inspect",
      output: psOut.trim(),
      latency: Date.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      action: "inspect",
      error: `UI inspection failed: ${err instanceof Error ? err.message : String(err)}`,
      latency: Date.now() - start,
    };
  }
}

export function resolveLaunchTarget(rawTarget: string): { isUrl: boolean; target: string; displayTitle: string; extractedWaitMs?: number } {
  const trimmed = rawTarget.trim();
  let rawLower = trimmed.toLowerCase();

  // Strip natural language navigation/launch prefixes:
  // e.g. "navigate to youtube", "go to youtube", "browse to google", "open calculator"
  const prefixRegex = /^(?:can\s+you\s+|could\s+you\s+|please\s+|i\s+want\s+you\s+to\s+)?(?:open|launch|start|run|visit|browse\s+to|browse|go\s+to|goto|navigate\s+to|navigate|head\s+to|take\s+me\s+to|access|load|switch\s+to|bring\s+up|show\s+me|show|search\s+for|search)\s+/i;
  let stripped = rawLower.replace(prefixRegex, "").trim();

  // Extract and strip trailing delay / wait instructions (e.g. "youtube wait 2 seconds", "calc wait 1s")
  const waitRegex = /\s+(?:and\s+)?(?:then\s+)?(?:wait|pause|sleep|delay)(?:\s+for|\s+of)?\s+(\d+(?:\.\d+)?)\s*(seconds|second|secs|sec|s|milliseconds|millis|ms|minutes|mins|m)?.*$/i;
  let extractedWaitMs: number | undefined;
  const waitMatch = rawLower.match(waitRegex);
  if (waitMatch) {
    const val = parseFloat(waitMatch[1]);
    const unit = (waitMatch[2] || "").toLowerCase();
    if (unit.startsWith("m") && !unit.startsWith("ms") && !unit.startsWith("millis")) {
      extractedWaitMs = Math.round(val * 60000);
    } else if (unit === "ms" || unit.startsWith("millis")) {
      extractedWaitMs = Math.round(val);
    } else {
      extractedWaitMs = val <= 10 ? Math.round(val * 1000) : Math.round(val);
    }
  }

  // Strip wait instructions and screenshot directives from stripped and rawLower
  stripped = stripped.replace(waitRegex, "").trim();
  rawLower = rawLower.replace(waitRegex, "").trim();

  const screenshotSuffixRegex = /\s+(?:and\s+)?(?:then\s+)?(?:take\s+(?:a\s+)?screen\s*shot|capture\s+(?:the\s+)?screen|screen\s*shot).*$/i;
  stripped = stripped.replace(screenshotSuffixRegex, "").trim();
  rawLower = rawLower.replace(screenshotSuffixRegex, "").trim();

  // Helper: ensure a string is a genuine search query, not a directive or filler
  const isGenuineSearchQuery = (q: string): boolean => {
    const clean = q.trim().toLowerCase();
    if (!clean || clean.length < 2) return false;
    if (/^(?:wait|delay|pause|sleep|take|capture|screen|screenshot|click|type|press|open|launch|run|go|goto|browse|head|visit)\b/i.test(clean)) {
      return false;
    }
    if (/^(?:com|org|net|app|website|site|homepage|home|page|results?)$/i.test(clean)) {
      return false;
    }
    return true;
  };

  // 1. YouTube searches (strictly requiring explicit search intent or non-directive query terms)
  const explicitYtMatch =
    rawLower.match(/^(?:search\s+youtube(?:\s+for)?|youtube\s+(?:and\s+)?search(?:\s+for)?|youtube\s*:\s*)(.+)$/i) ||
    rawLower.match(/^(?:search\s+)?(?:for\s+)?(.+?)\s+on\s+youtube$/i);

  if (explicitYtMatch && !rawLower.startsWith("youtube.com")) {
    const query = explicitYtMatch[1].trim();
    if (isGenuineSearchQuery(query)) {
      return {
        isUrl: true,
        target: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
        displayTitle: `YouTube search for "${query}"`,
        extractedWaitMs,
      };
    }
  }

  const looseYtMatch = rawLower.match(/^youtube\s+(.+)$/i);
  if (looseYtMatch && !rawLower.startsWith("youtube.com")) {
    const query = looseYtMatch[1].trim();
    if (isGenuineSearchQuery(query)) {
      return {
        isUrl: true,
        target: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
        displayTitle: `YouTube search for "${query}"`,
        extractedWaitMs,
      };
    }
  }

  // 2. Google searches (strictly requiring explicit search intent or non-directive query terms)
  const explicitGMatch =
    rawLower.match(/^(?:search\s+google(?:\s+for)?|google\s+(?:and\s+)?search(?:\s+for)?|google\s*:\s*)(.+)$/i) ||
    rawLower.match(/^(?:search\s+)?(?:for\s+)?(.+?)\s+on\s+google$/i);

  if (explicitGMatch && !rawLower.startsWith("google.com")) {
    const query = explicitGMatch[1].trim();
    if (isGenuineSearchQuery(query)) {
      return {
        isUrl: true,
        target: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        displayTitle: `Google search for "${query}"`,
        extractedWaitMs,
      };
    }
  }

  const looseGMatch = rawLower.match(/^google\s+(.+)$/i);
  if (looseGMatch && !rawLower.startsWith("google.com")) {
    const query = looseGMatch[1].trim();
    if (isGenuineSearchQuery(query)) {
      return {
        isUrl: true,
        target: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        displayTitle: `Google search for "${query}"`,
        extractedWaitMs,
      };
    }
  }

  // 4. Common website names & domains
  const commonWebsites: Record<string, string> = {
    youtube: "https://www.youtube.com",
    google: "https://www.google.com",
    github: "https://github.com",
    twitter: "https://x.com",
    x: "https://x.com",
    reddit: "https://www.reddit.com",
    netflix: "https://www.netflix.com",
    spotify: "https://open.spotify.com",
    chatgpt: "https://chatgpt.com",
    claude: "https://claude.ai",
    amazon: "https://www.amazon.com",
    wikipedia: "https://www.wikipedia.org",
    facebook: "https://www.facebook.com",
    instagram: "https://www.instagram.com",
    linkedin: "https://www.linkedin.com",
    tiktok: "https://www.tiktok.com",
    bing: "https://www.bing.com",
    yahoo: "https://www.yahoo.com",
    twitch: "https://www.twitch.tv",
    discord: "https://discord.com",
    whatsapp: "https://web.whatsapp.com",
    outlook: "https://outlook.live.com",
    gmail: "https://mail.google.com",
  };

  const websiteTitles: Record<string, string> = {
    youtube: "YouTube",
    google: "Google",
    github: "GitHub",
    twitter: "X (Twitter)",
    x: "X",
    reddit: "Reddit",
    netflix: "Netflix",
    spotify: "Spotify",
    chatgpt: "ChatGPT",
    claude: "Claude",
    amazon: "Amazon",
    wikipedia: "Wikipedia",
    facebook: "Facebook",
    instagram: "Instagram",
    linkedin: "LinkedIn",
    tiktok: "TikTok",
    bing: "Bing",
    yahoo: "Yahoo",
    twitch: "Twitch",
    discord: "Discord",
    whatsapp: "WhatsApp",
    outlook: "Outlook",
    gmail: "Gmail",
  };

  if (commonWebsites[stripped]) {
    return { isUrl: true, target: commonWebsites[stripped], displayTitle: websiteTitles[stripped] || stripped, extractedWaitMs };
  }
  if (commonWebsites[rawLower]) {
    return { isUrl: true, target: commonWebsites[rawLower], displayTitle: websiteTitles[rawLower] || rawLower, extractedWaitMs };
  }

  if (stripped === "youtube" || stripped.startsWith("youtube.") || stripped.endsWith("youtube")) {
    return { isUrl: true, target: "https://www.youtube.com", displayTitle: "YouTube", extractedWaitMs };
  }
  if (stripped === "google" || stripped.startsWith("google.") || stripped.endsWith("google")) {
    return { isUrl: true, target: "https://www.google.com", displayTitle: "Google", extractedWaitMs };
  }

  // 5. Explicit URLs or domains
  if (/^https?:\/\//i.test(trimmed)) {
    return { isUrl: true, target: trimmed, displayTitle: trimmed, extractedWaitMs };
  }
  if (/^[a-zA-Z0-9-]+\.(com|org|net|io|ai|co|dev|app|edu|gov)(\/.*)?$/i.test(stripped)) {
    return { isUrl: true, target: `https://${stripped}`, displayTitle: stripped, extractedWaitMs };
  }

  // 6. Application aliases
  const appAliases: Record<string, string> = {
    calculator: "calc",
    calc: "calc",
    notepad: "notepad",
    editor: "notepad",
    chrome: "chrome",
    browser: "msedge",
    edge: "msedge",
    terminal: "powershell",
    powershell: "powershell",
    cmd: "cmd",
    explorer: "explorer",
    files: "explorer",
    code: "code",
    vscode: "code",
    paint: "mspaint",
    taskmgr: "taskmgr",
  };

  if (appAliases[stripped]) {
    return { isUrl: false, target: appAliases[stripped], displayTitle: appAliases[stripped], extractedWaitMs };
  }
  if (appAliases[rawLower]) {
    return { isUrl: false, target: appAliases[rawLower], displayTitle: appAliases[rawLower], extractedWaitMs };
  }

  // 7. Single recognized executable
  if (!stripped.includes(" ") && (stripped.endsWith(".exe") || /^[a-zA-Z0-9_-]+$/.test(stripped))) {
    return { isUrl: false, target: stripped, displayTitle: stripped, extractedWaitMs };
  }

  // 8. Safe web search fallback for multi-word phrases (prevents "Windows cannot find ..." modal)
  return {
    isUrl: true,
    target: `https://www.google.com/search?q=${encodeURIComponent(stripped || trimmed)}`,
    displayTitle: `Search for "${stripped || trimmed}"`,
    extractedWaitMs,
  };
}

async function performMouseMove(action: CUAAction, start: number): Promise<CUAResult> {
  const coords = action.coordinates || { x: 960, y: 540 };
  const duration = action.duration || 160;

  recordCUATelemetry({
    action: "move",
    x: coords.x,
    y: coords.y,
    source: action.source || "agent",
    stepTitle: action.stepTitle || `Move cursor to (${coords.x}, ${coords.y})`,
  });

  const nativeTool = getNativeToolPath();
  if (nativeTool) {
    try {
      await execFileAsync(nativeTool, ["move", String(coords.x), String(coords.y), String(duration)], {
        timeout: 4000,
        windowsHide: true,
      });
      return {
        success: true,
        action: "move",
        output: `Glided cursor to (${coords.x}, ${coords.y})`,
        latency: Date.now() - start,
      };
    } catch {
      // Fall through to PowerShell
    }
  }

  try {
    const psScript = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${coords.x}, ${coords.y})
`;
    await execFileAsync("powershell", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", psScript], {
      timeout: 4000,
      windowsHide: true,
    });
    return {
      success: true,
      action: "move",
      output: `Moved cursor to (${coords.x}, ${coords.y}) via Windows subsystem`,
      latency: Date.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      action: "move",
      error: `Move failed: ${err instanceof Error ? err.message : String(err)}`,
      latency: Date.now() - start,
    };
  }
}

async function performDoubleClick(action: CUAAction, start: number): Promise<CUAResult> {
  const coords = action.coordinates || { x: 960, y: 540 };

  recordCUATelemetry({
    action: "double_click",
    x: coords.x,
    y: coords.y,
    source: action.source || "agent",
    stepTitle: action.stepTitle || `Double-click at (${coords.x}, ${coords.y})`,
  });

  const nativeTool = getNativeToolPath();
  if (nativeTool) {
    try {
      lastActionMarker = coords;
      await execFileAsync(nativeTool, ["double_click", String(coords.x), String(coords.y)], {
        timeout: 4000,
        windowsHide: true,
      });
      const screenRes = await captureScreenshot(start, coords);
      return {
        success: true,
        action: "double_click",
        output: `Double-clicked at (${coords.x}, ${coords.y}) via native CUA engine`,
        screenshot: screenRes.screenshot,
        latency: Date.now() - start,
      };
    } catch {
      // Fall through
    }
  }

  // PowerShell fallback
  try {
    lastActionMarker = coords;
    const psScript = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class DpiAwareDClick {
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
    [DllImport("user32.dll", CharSet=CharSet.Auto)] public static extern void mouse_event(long dwFlags, long dx, long dy, long cButtons, long dwExtraInfo);
}
"@
[DpiAwareDClick]::SetProcessDPIAware() | Out-Null
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${coords.x}, ${coords.y})
[DpiAwareDClick]::mouse_event(0x0002, 0, 0, 0, 0)
Start-Sleep -Milliseconds 40
[DpiAwareDClick]::mouse_event(0x0004, 0, 0, 0, 0)
Start-Sleep -Milliseconds 80
[DpiAwareDClick]::mouse_event(0x0002, 0, 0, 0, 0)
Start-Sleep -Milliseconds 40
[DpiAwareDClick]::mouse_event(0x0004, 0, 0, 0, 0)
`;
    await execFileAsync("powershell", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", psScript], {
      timeout: 6000,
      windowsHide: true,
    });
    const screenRes = await captureScreenshot(start, coords);
    return {
      success: true,
      action: "double_click",
      output: `Double-clicked at (${coords.x}, ${coords.y})`,
      screenshot: screenRes.screenshot,
      latency: Date.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      action: "double_click",
      error: `Double click failed: ${err instanceof Error ? err.message : String(err)}`,
      latency: Date.now() - start,
    };
  }
}

async function performRightClick(action: CUAAction, start: number): Promise<CUAResult> {
  const coords = action.coordinates || { x: 960, y: 540 };

  recordCUATelemetry({
    action: "right_click",
    x: coords.x,
    y: coords.y,
    source: action.source || "agent",
    stepTitle: action.stepTitle || `Right-click at (${coords.x}, ${coords.y})`,
  });

  const nativeTool = getNativeToolPath();
  if (nativeTool) {
    try {
      lastActionMarker = coords;
      await execFileAsync(nativeTool, ["right_click", String(coords.x), String(coords.y)], {
        timeout: 4000,
        windowsHide: true,
      });
      const screenRes = await captureScreenshot(start, coords);
      return {
        success: true,
        action: "right_click",
        output: `Right-clicked at (${coords.x}, ${coords.y}) via native CUA engine`,
        screenshot: screenRes.screenshot,
        latency: Date.now() - start,
      };
    } catch {
      // Fall through
    }
  }

  try {
    lastActionMarker = coords;
    const psScript = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class DpiAwareRClick {
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
    [DllImport("user32.dll", CharSet=CharSet.Auto)] public static extern void mouse_event(long dwFlags, long dx, long dy, long cButtons, long dwExtraInfo);
}
"@
[DpiAwareRClick]::SetProcessDPIAware() | Out-Null
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${coords.x}, ${coords.y})
[DpiAwareRClick]::mouse_event(0x0008, 0, 0, 0, 0)
Start-Sleep -Milliseconds 45
[DpiAwareRClick]::mouse_event(0x0010, 0, 0, 0, 0)
`;
    await execFileAsync("powershell", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", psScript], {
      timeout: 6000,
      windowsHide: true,
    });
    const screenRes = await captureScreenshot(start, coords);
    return {
      success: true,
      action: "right_click",
      output: `Right-clicked at (${coords.x}, ${coords.y})`,
      screenshot: screenRes.screenshot,
      latency: Date.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      action: "right_click",
      error: `Right click failed: ${err instanceof Error ? err.message : String(err)}`,
      latency: Date.now() - start,
    };
  }
}

async function performDrag(action: CUAAction, start: number): Promise<CUAResult> {
  const from = action.fromCoordinates || { x: 500, y: 500 };
  const to = action.coordinates || { x: 700, y: 700 };
  const duration = action.duration || 300;

  recordCUATelemetry({
    action: "drag",
    fromX: from.x,
    fromY: from.y,
    x: to.x,
    y: to.y,
    source: action.source || "agent",
    stepTitle: action.stepTitle || `Drag from (${from.x}, ${from.y}) to (${to.x}, ${to.y})`,
  });

  const nativeTool = getNativeToolPath();
  if (nativeTool) {
    try {
      await execFileAsync(nativeTool, ["drag", String(from.x), String(from.y), String(to.x), String(to.y), String(duration)], {
        timeout: 5000,
        windowsHide: true,
      });
      const screenRes = await captureScreenshot(start, to);
      return {
        success: true,
        action: "drag",
        output: `Dragged from (${from.x}, ${from.y}) to (${to.x}, ${to.y})`,
        screenshot: screenRes.screenshot,
        latency: Date.now() - start,
      };
    } catch {
      // Fall through
    }
  }

  return {
    success: false,
    action: "drag",
    error: "Drag action requires native tool or complete coordinates",
    latency: Date.now() - start,
  };
}

async function performClick(action: CUAAction, start: number): Promise<CUAResult> {
  if (action.coordinates) {
    recordCUATelemetry({
      action: "click",
      x: action.coordinates.x,
      y: action.coordinates.y,
      source: action.source || "agent",
      stepTitle: action.stepTitle || `Click at (${action.coordinates.x}, ${action.coordinates.y})`,
    });
  }

  const nativeTool = getNativeToolPath();
  if (nativeTool && action.coordinates) {
    try {
      lastActionMarker = action.coordinates;
      await execFileAsync(nativeTool, ["click", String(action.coordinates.x), String(action.coordinates.y)], {
        timeout: 4000,
        windowsHide: true,
      });
      const screenRes = await captureScreenshot(start, action.coordinates);
      return {
        success: true,
        action: "click",
        output: `Clicked at (${action.coordinates.x}, ${action.coordinates.y}) via native CUA engine`,
        screenshot: screenRes.screenshot,
        latency: Date.now() - start,
      };
    } catch {
      // Fall through to CUA CLI or PowerShell
    }
  }

  const bin = await getCUABinary();
  if (bin) {
    const args = ["click"];
    if (action.coordinates) {
      args.push("--x", String(action.coordinates.x), "--y", String(action.coordinates.y));
    } else if (action.target) {
      args.push("--element", action.target);
    }

    try {
      const { stdout } = await execFileAsync(bin, args, {
        timeout: 5000,
        windowsHide: true,
      });

      if (action.coordinates) lastActionMarker = action.coordinates;

      return {
        success: true,
        action: "click",
        output: stdout.trim() || `Clicked at ${action.coordinates ? `(${action.coordinates.x}, ${action.coordinates.y})` : action.target || "target"}`,
        latency: Date.now() - start,
      };
    } catch {
      // Fall through to native
    }
  }

  // Fallback: move and click via PowerShell
  if (action.coordinates) {
    try {
      lastActionMarker = action.coordinates;
      const psScript = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class DpiAwareClick {
    [DllImport("user32.dll")]
    public static extern bool SetProcessDPIAware();
    [DllImport("user32.dll", CharSet=CharSet.Auto, CallingConvention=CallingConvention.StdCall)]
    public static extern void mouse_event(long dwFlags, long dx, long dy, long cButtons, long dwExtraInfo);
}
"@
[DpiAwareClick]::SetProcessDPIAware() | Out-Null
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${action.coordinates.x}, ${action.coordinates.y})
[DpiAwareClick]::mouse_event(0x0002, 0, 0, 0, 0) # left down
[DpiAwareClick]::mouse_event(0x0004, 0, 0, 0, 0) # left up
`;
      await execFileAsync(
        "powershell",
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", psScript],
        { timeout: 6000, windowsHide: true }
      );
      const screenRes = await captureScreenshot(start, action.coordinates);
      return {
        success: true,
        action: "click",
        output: `Clicked at coordinates (${action.coordinates.x}, ${action.coordinates.y}) with visual target tracking`,
        screenshot: screenRes.screenshot,
        latency: Date.now() - start,
      };
    } catch (err) {
      return {
        success: false,
        action: "click",
        error: `Click failed: ${err instanceof Error ? err.message : String(err)}`,
        latency: Date.now() - start,
      };
    }
  }

  return {
    success: false,
    action: "click",
    error: `Could not click target: ${action.target || "unspecified"}`,
    latency: Date.now() - start,
  };
}

async function performType(action: CUAAction, start: number): Promise<CUAResult> {
  const textToType = action.text || "";

  recordCUATelemetry({
    action: "type",
    text: textToType,
    source: action.source || "agent",
    stepTitle: action.stepTitle || `Type "${textToType.slice(0, 30)}${textToType.length > 30 ? "..." : ""}"`,
  });

  const nativeTool = getNativeToolPath();
  if (nativeTool) {
    try {
      await execFileAsync(nativeTool, ["type", textToType], {
        timeout: 4000,
        windowsHide: true,
      });
      const screenRes = await captureScreenshot(start);
      return {
        success: true,
        action: "type",
        output: `Typed: "${textToType.slice(0, 50)}${textToType.length > 50 ? "..." : ""}" via native CUA engine`,
        screenshot: screenRes.screenshot,
        latency: Date.now() - start,
      };
    } catch {
      // Fall through
    }
  }

  const bin = await getCUABinary();
  if (bin) {
    try {
      const { stdout } = await execFileAsync(bin, ["type", "--text", textToType], {
        timeout: 5000,
        windowsHide: true,
      });

      return {
        success: true,
        action: "type",
        output: stdout.trim() || `Typed: "${textToType.slice(0, 50)}${textToType.length > 50 ? "..." : ""}"`,
        latency: Date.now() - start,
      };
    } catch {
      // Fall through to native
    }
  }

  // Fallback: Windows SendKeys
  try {
    const escaped = textToType.replace(/"/g, '""');
    const psScript = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait("${escaped}")
`;
    await execFileAsync(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", psScript],
      { timeout: 6000, windowsHide: true }
    );
    const screenRes = await captureScreenshot(start);
    return {
      success: true,
      action: "type",
      output: `Typed "${textToType.slice(0, 50)}" via Windows input subsystem`,
      screenshot: screenRes.screenshot,
      latency: Date.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      action: "type",
      error: `Typing failed: ${err instanceof Error ? err.message : String(err)}`,
      latency: Date.now() - start,
    };
  }
}

async function launchApp(
  appName: string,
  start: number,
  stepTitle?: string,
  source?: "agent" | "human"
): Promise<CUAResult> {
  const rawTarget = appName.trim();
  if (!rawTarget) {
    return { success: false, action: "launch", error: "Missing app or URL to launch", latency: Date.now() - start };
  }

  const resolved = resolveLaunchTarget(rawTarget);

  recordCUATelemetry({
    action: "launch",
    text: resolved.displayTitle,
    source: source || "agent",
    stepTitle: stepTitle || `Launch ${resolved.displayTitle}`,
  });

  // 1. Try native tool if available
  const nativeTool = getNativeToolPath();
  if (nativeTool) {
    try {
      const { stdout } = await execFileAsync(nativeTool, ["launch", resolved.target], {
        timeout: 8000,
        windowsHide: true,
      });
      return {
        success: true,
        action: "launch",
        output: stdout.trim() || `Launched ${resolved.displayTitle}`,
        latency: Date.now() - start,
      };
    } catch {
      // Fall through to browser/subsystem
    }
  }

  // 2. If target is a website URL, open in default browser
  if (resolved.isUrl) {
    try {
      await execFileAsync(
        "powershell",
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", `Start-Process "${resolved.target}"`],
        {
          timeout: 8000,
          windowsHide: true,
        }
      );
      return {
        success: true,
        action: "launch",
        output: `Opened ${resolved.target} in default browser`,
        latency: Date.now() - start,
      };
    } catch (err) {
      return {
        success: false,
        action: "launch",
        error: `Failed to open ${resolved.target}: ${err instanceof Error ? err.message : String(err)}`,
        latency: Date.now() - start,
      };
    }
  }

  // 3. Try CUA CLI if installed
  const bin = await getCUABinary();
  if (bin) {
    try {
      const { stdout } = await execFileAsync(bin, ["launch", resolved.target], {
        timeout: 8000,
        windowsHide: true,
      });
      return {
        success: true,
        action: "launch",
        output: stdout.trim() || `Launched ${resolved.target}`,
        latency: Date.now() - start,
      };
    } catch {
      // Fall through to native
    }
  }

  // 4. Fallback: native Windows Start-Process
  try {
    const psScript = `
$target = "${resolved.target}"
if ($target -ieq "calc") {
  Start-Process "calc" -ErrorAction Stop
} elseif ($target -ieq "notepad") {
  Start-Process "notepad" -ErrorAction Stop
} else {
  try {
    Start-Process $target -ErrorAction Stop
  } catch {
    Start-Process "cmd.exe" -ArgumentList "/c", "start", "", "\`"$target\`"" -ErrorAction Stop
  }
}
Write-Output "Launched $target"
`;
    const { stdout: psOut } = await execFileAsync(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", psScript],
      { timeout: 8000, windowsHide: true }
    );
    await new Promise((r) => setTimeout(r, 600));
    const screenRes = await captureScreenshot(start);
    return {
      success: true,
      action: "launch",
      output: psOut.trim() || `Launched ${resolved.target} via Windows subsystem`,
      screenshot: screenRes.screenshot,
      latency: Date.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      action: "launch",
      error: `Failed to launch "${resolved.target}": ${err instanceof Error ? err.message : String(err)}`,
      latency: Date.now() - start,
    };
  }
}

async function pressKey(
  key: string,
  start: number,
  stepTitle?: string,
  source?: "agent" | "human"
): Promise<CUAResult> {
  recordCUATelemetry({
    action: "key",
    key,
    source: source || "agent",
    stepTitle: stepTitle || `Press Key [${key.toUpperCase()}]`,
  });

  const nativeTool = getNativeToolPath();
  if (nativeTool) {
    try {
      await execFileAsync(nativeTool, ["key", key], {
        timeout: 4000,
        windowsHide: true,
      });
      const screenRes = await captureScreenshot(start);
      return {
        success: true,
        action: "key",
        output: `Pressed key "${key}" via native CUA engine`,
        screenshot: screenRes.screenshot,
        latency: Date.now() - start,
      };
    } catch {
      // Fall through
    }
  }

  // Native Windows SendKeys
  try {
    const keyMap: Record<string, string> = {
      enter: "{ENTER}",
      return: "{ENTER}",
      tab: "{TAB}",
      esc: "{ESC}",
      escape: "{ESC}",
      space: " ",
      backspace: "{BACKSPACE}",
      up: "{UP}",
      down: "{DOWN}",
      left: "{LEFT}",
      right: "{RIGHT}",
      "ctrl+c": "^c",
      "ctrl+v": "^v",
      "ctrl+s": "^s",
      "ctrl+a": "^a",
      "ctrl+z": "^z",
      "alt+f4": "%{F4}",
    };
    const sendKeyStr = keyMap[key.toLowerCase()] || key;
    await execFileAsync(
      "powershell",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `[System.Windows.Forms.SendKeys]::SendWait("${sendKeyStr}")`,
      ],
      {
        timeout: 5000,
        windowsHide: true,
      }
    );
    const screenRes = await captureScreenshot(start);
    return {
      success: true,
      action: "key",
      output: `Pressed key "${key}" via Windows input subsystem`,
      screenshot: screenRes.screenshot,
      latency: Date.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      action: "key",
      error: `Key press failed: ${err instanceof Error ? err.message : String(err)}`,
      latency: Date.now() - start,
    };
  }
}

async function performHotkey(
  combo: string,
  start: number,
  stepTitle?: string,
  source?: "agent" | "human"
): Promise<CUAResult> {
  const cleanCombo = combo.trim().toLowerCase();

  recordCUATelemetry({
    action: "hotkey",
    combo: cleanCombo,
    source: source || "agent",
    stepTitle: stepTitle || `Hotkey [${cleanCombo.toUpperCase()}]`,
  });

  const nativeTool = getNativeToolPath();
  if (nativeTool) {
    try {
      await execFileAsync(nativeTool, ["hotkey", cleanCombo], {
        timeout: 4000,
        windowsHide: true,
      });
      const screenRes = await captureScreenshot(start);
      return {
        success: true,
        action: "hotkey",
        output: `Executed hotkey "${cleanCombo}" via native CUA engine`,
        screenshot: screenRes.screenshot,
        latency: Date.now() - start,
      };
    } catch {
      // Fall through to PowerShell
    }
  }

  try {
    const psScript = `
Add-Type -AssemblyName System.Windows.Forms
$combo = "${cleanCombo}"
if ($combo -eq "win+r") {
  $wscript = New-Object -ComObject WScript.Shell
  $wscript.SendKeys("^{ESC}r")
} else {
  $mapped = $combo.Replace("ctrl+", "^").Replace("alt+", "%").Replace("shift+", "+").Replace("enter", "{ENTER}").Replace("esc", "{ESC}").Replace("tab", "{TAB}")
  [System.Windows.Forms.SendKeys]::SendWait($mapped)
}
`;
    await execFileAsync(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", psScript],
      { timeout: 5000, windowsHide: true }
    );
    const screenRes = await captureScreenshot(start);
    return {
      success: true,
      action: "hotkey",
      output: `Executed hotkey "${cleanCombo}" via Windows subsystem`,
      screenshot: screenRes.screenshot,
      latency: Date.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      action: "hotkey",
      error: `Hotkey failed: ${err instanceof Error ? err.message : String(err)}`,
      latency: Date.now() - start,
    };
  }
}

async function performGetActiveWindow(start: number): Promise<CUAResult> {
  const nativeTool = getNativeToolPath();
  if (nativeTool) {
    try {
      const { stdout } = await execFileAsync(nativeTool, ["active_window"], {
        timeout: 3000,
        windowsHide: true,
      });
      const parsed = JSON.parse(stdout);
      return {
        success: true,
        action: "active_window",
        output: parsed.title || "Unknown Window",
        latency: Date.now() - start,
      };
    } catch {
      // Fall through
    }
  }

  try {
    const psScript = `
Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  using System.Text;
  public class WinHelper {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll", CharSet = CharSet.Auto)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  }
"@
$hwnd = [WinHelper]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 256
[WinHelper]::GetWindowText($hwnd, $sb, 256) | Out-Null
$sb.ToString()
`;
    const { stdout } = await execFileAsync(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", psScript],
      { timeout: 4000, windowsHide: true }
    );
    return {
      success: true,
      action: "active_window",
      output: stdout.trim() || "Active Window",
      latency: Date.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      action: "active_window",
      error: `Active window inspection failed: ${err instanceof Error ? err.message : String(err)}`,
      latency: Date.now() - start,
    };
  }
}

async function performScroll(action: CUAAction, start: number): Promise<CUAResult> {
  const direction = action.direction || "down";
  const amount = action.amount || 3;
  const bin = await getCUABinary();

  if (bin) {
    try {
      const { stdout } = await execFileAsync(bin, ["scroll", "--direction", direction, "--amount", String(amount)], {
        timeout: 5000,
        windowsHide: true,
      });

      return {
        success: true,
        action: "scroll",
        output: stdout.trim() || `Scrolled ${direction} by ${amount}`,
        latency: Date.now() - start,
      };
    } catch {
      // Fall through to native
    }
  }

  // Fallback via PageUp/PageDown keys
  try {
    const keyToSend = direction === "down" ? "{PGDN}" : "{PGUP}";
    await execFileAsync(
      "powershell",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `[System.Windows.Forms.SendKeys]::SendWait("${keyToSend}")`,
      ],
      {
        timeout: 5000,
        windowsHide: true,
      }
    );
    return {
      success: true,
      action: "scroll",
      output: `Scrolled ${direction} via Windows input subsystem`,
      latency: Date.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      action: "scroll",
      error: `Scroll failed: ${err instanceof Error ? err.message : String(err)}`,
      latency: Date.now() - start,
    };
  }
}

/**
 * Quick check if CUA Driver is installed and available.
 */
export async function isCUADriverAvailable(): Promise<boolean> {
  if (getNativeToolPath()) return true;
  const bin = await getCUABinary();
  return bin !== null;
}


