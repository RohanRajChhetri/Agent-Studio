import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface CUAAction {
  type: "click" | "type" | "screenshot" | "scroll" | "key" | "inspect" | "launch";
  target?: string;
  text?: string;
  coordinates?: { x: number; y: number };
  key?: string;
  direction?: "up" | "down" | "left" | "right";
  amount?: number;
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
 * CUA Driver must be installed: `irm https://cua.ai/driver/install.ps1 | iex`
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
      case "type":
        return await performType(action, start);
      case "launch":
        return await launchApp(action.target || "", start);
      case "key":
        return await pressKey(action.key || "", start);
      case "scroll":
        return await performScroll(action, start);
      default:
        return {
          success: false,
          action: action.type,
          error: `Unknown CUA action type: "${action.type}". Supported: screenshot, inspect, click, type, launch, key, scroll`,
          latency: Date.now() - start,
        };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Check if CUA CLI is not installed
    if (msg.includes("ENOENT") || msg.includes("not recognized") || msg.includes("command not found")) {
      return {
        success: false,
        action: action.type,
        error: "CUA Driver is not installed. Install with: irm https://cua.ai/driver/install.ps1 | iex",
        latency: Date.now() - start,
      };
    }
    return {
      success: false,
      action: action.type,
      error: msg,
      latency: Date.now() - start,
    };
  }
}

async function captureScreenshot(start: number): Promise<CUAResult> {
  try {
    const { stdout } = await execFileAsync("cua", ["screenshot", "--format", "base64"], {
      timeout: 10000,
      windowsHide: true,
    });
    return {
      success: true,
      action: "screenshot",
      screenshot: stdout.trim(),
      output: "Desktop screenshot captured successfully",
      latency: Date.now() - start,
    };
  } catch (err) {
    // Fallback: try PowerShell screenshot if CUA not available
    try {
      const psScript = `
Add-Type -AssemblyName System.Windows.Forms
$bitmap = [System.Windows.Forms.Screen]::PrimaryScreen
$bounds = $bitmap.Bounds
$bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$ms = New-Object System.IO.MemoryStream
$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
[Convert]::ToBase64String($ms.ToArray())
$graphics.Dispose()
$bmp.Dispose()
$ms.Dispose()`;
      const { stdout: psOut } = await execFileAsync("powershell", ["-Command", psScript], {
        timeout: 10000,
        windowsHide: true,
      });
      return {
        success: true,
        action: "screenshot",
        screenshot: psOut.trim(),
        output: "Desktop screenshot captured via PowerShell fallback",
        latency: Date.now() - start,
      };
    } catch {
      throw err; // Re-throw original error
    }
  }
}

async function inspectScreen(target: string | undefined, start: number): Promise<CUAResult> {
  const args = ["inspect"];
  if (target) args.push("--app", target);

  const { stdout } = await execFileAsync("cua", args, {
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
}

async function performClick(action: CUAAction, start: number): Promise<CUAResult> {
  const args = ["click"];
  if (action.coordinates) {
    args.push("--x", String(action.coordinates.x), "--y", String(action.coordinates.y));
  } else if (action.target) {
    args.push("--element", action.target);
  }

  const { stdout } = await execFileAsync("cua", args, {
    timeout: 10000,
    windowsHide: true,
  });

  return {
    success: true,
    action: "click",
    output: stdout.trim() || `Clicked at ${action.coordinates ? `(${action.coordinates.x}, ${action.coordinates.y})` : action.target || "target"}`,
    latency: Date.now() - start,
  };
}

async function performType(action: CUAAction, start: number): Promise<CUAResult> {
  const textToType = action.text || "";
  const { stdout } = await execFileAsync("cua", ["type", "--text", textToType], {
    timeout: 10000,
    windowsHide: true,
  });

  return {
    success: true,
    action: "type",
    output: stdout.trim() || `Typed: "${textToType.slice(0, 50)}${textToType.length > 50 ? "..." : ""}"`,
    latency: Date.now() - start,
  };
}

async function launchApp(appName: string, start: number): Promise<CUAResult> {
  // Try CUA launch first, fall back to platform-native launch
  try {
    const { stdout } = await execFileAsync("cua", ["launch", appName], {
      timeout: 15000,
      windowsHide: true,
    });
    return {
      success: true,
      action: "launch",
      output: stdout.trim() || `Launched ${appName}`,
      latency: Date.now() - start,
    };
  } catch {
    // Fallback: use Windows Start-Process
    try {
      const { stdout: psOut } = await execFileAsync(
        "powershell",
        ["-Command", `Start-Process "${appName}" -ErrorAction Stop; Write-Output "Launched ${appName}"`],
        { timeout: 15000, windowsHide: true }
      );
      return {
        success: true,
        action: "launch",
        output: psOut.trim() || `Launched ${appName} via system`,
        latency: Date.now() - start,
      };
    } catch (err) {
      return {
        success: false,
        action: "launch",
        error: `Failed to launch "${appName}": ${err instanceof Error ? err.message : String(err)}`,
        latency: Date.now() - start,
      };
    }
  }
}

async function pressKey(key: string, start: number): Promise<CUAResult> {
  const { stdout } = await execFileAsync("cua", ["key", key], {
    timeout: 5000,
    windowsHide: true,
  });

  return {
    success: true,
    action: "key",
    output: stdout.trim() || `Pressed key: ${key}`,
    latency: Date.now() - start,
  };
}

async function performScroll(action: CUAAction, start: number): Promise<CUAResult> {
  const direction = action.direction || "down";
  const amount = action.amount || 3;
  const args = ["scroll", "--direction", direction, "--amount", String(amount)];

  const { stdout } = await execFileAsync("cua", args, {
    timeout: 5000,
    windowsHide: true,
  });

  return {
    success: true,
    action: "scroll",
    output: stdout.trim() || `Scrolled ${direction} by ${amount}`,
    latency: Date.now() - start,
  };
}

/**
 * Quick check if CUA Driver is installed and available.
 */
export async function isCUADriverAvailable(): Promise<boolean> {
  try {
    await execFileAsync("cua", ["--version"], {
      timeout: 5000,
      windowsHide: true,
    });
    return true;
  } catch {
    return false;
  }
}
