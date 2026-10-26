import { executeCUAAction, resolveLaunchTarget } from "./cua-driver";
import { recordCUATelemetry } from "./cua-telemetry";
import { executeChatCompletion } from "./llm-router";
import fs from "fs/promises";
import path from "path";

export interface AutonomousStep {
  action:
    | "launch"
    | "click"
    | "double_click"
    | "right_click"
    | "move"
    | "type"
    | "key"
    | "hotkey"
    | "wait"
    | "screenshot";
  target?: string;
  coordinates?: { x: number; y: number };
  text?: string;
  key?: string;
  combo?: string;
  duration?: number;
  description: string;
}

export interface AutonomousDesktopExecutionResult {
  success: boolean;
  goal: string;
  stepsExecuted: number;
  steps: { description: string; action: string; success: boolean; latency: number }[];
  finalScreenshotUrl?: string;
  summary: string;
  totalLatency: number;
}

let globalAbortRequested = false;

/**
 * Emergency Killswitch: instantly signals any active autonomous desktop task loop to stop.
 */
export function abortAutonomousDesktopLoop(): void {
  globalAbortRequested = true;
  recordCUATelemetry({
    action: "step",
    source: "human",
    stepTitle: "CUA Emergency Killswitch Activated by Operator",
  });
}

/**
 * Autonomous Desktop Operator
 * Decomposes natural language desktop goals into sequential CUA actions,
 * executing each step with real-time mouse movement, keystrokes, and telemetry.
 */
export async function executeAutonomousDesktopTask(
  goal: string,
  onStepProgress?: (stepDesc: string, stepIndex: number, totalSteps: number) => void
): Promise<AutonomousDesktopExecutionResult> {
  globalAbortRequested = false;
  const startTime = Date.now();
  const trimmedGoal = goal.trim();

  recordCUATelemetry({
    action: "step",
    source: "agent",
    stepTitle: `Autonomous Task Started: "${trimmedGoal.slice(0, 50)}"`,
  });

  // Step 1: Capture initial screenshot & active window
  const initialWin = await executeCUAAction({ type: "active_window" });
  const activeTitle = initialWin.output || "Desktop";

  // Step 2: Use AI Reasoning to synthesize plan of concrete steps
  const planPrompt = `You are the Agent OS Desktop Autonomous Operator.
User Goal: "${trimmedGoal}"
Current Desktop Foreground Window: "${activeTitle}"
Primary Screen Resolution: 1920x1080 (standard scaling)

Decompose this user goal into a concise, ordered list of 2 to 6 concrete desktop actions.
Supported action types:
- launch: target (app name like "calc", "notepad", "chrome", "explorer", or a full URL like "https://www.youtube.com")
- move: coordinates {x, y}
- click: coordinates {x, y}
- double_click: coordinates {x, y}
- right_click: coordinates {x, y}
- type: text
- key: enter, tab, esc, space, backspace, up, down, etc.
- hotkey: win+r, win+d, ctrl+s, ctrl+c, ctrl+v, alt+tab, etc.
- wait: duration (in ms, e.g. 2000 for 2 seconds)
- screenshot: capture desktop screenshot

CRITICAL INSTRUCTION UNDERSTANDING:
1. DELAYS & WAITING: When the user says "wait 2 seconds", "wait 3s", or "pause 500ms", ALWAYS output a "wait" action with the duration in milliseconds (e.g. { "action": "wait", "duration": 2000, "description": "Wait 2 seconds" }).
2. NEVER CONFUSE WAITING WITH SEARCHING: Do NOT mistake waiting/timing directives for search queries or text to type! When the user says "open youtube wait 2 seconds and take a screen shot", the steps are:
   1. launch "https://www.youtube.com"
   2. wait 2000ms
   3. screenshot
   Do NOT search for "wait 2 seconds"!
3. WEB SEARCHES: Only perform a web search if the user explicitly says to search for a query (e.g., "search for cat videos"). Opening a site like "youtube" or "google" just launches its homepage URL.
4. SCREENSHOTS: If the user asks for a screenshot or screen capture, include a "screenshot" action.

Common Desktop Layout Guides (1920x1080):
- Start Menu / Taskbar: bottom-left around x: 28, y: 1055
- Search Bar (Taskbar): x: 120, y: 1055
- Browser URL / Search Bar: x: 600, y: 82
- Notepad main text area: x: 500, y: 350
- Calculator buttons: Center of screen, roughly x: 800 to 1100, y: 400 to 750

Respond STRICTLY with a valid JSON array of step objects, with NO conversational text or codeblock wrappers:
[
  { "action": "launch", "target": "https://www.youtube.com", "description": "Open YouTube" },
  { "action": "wait", "duration": 2000, "description": "Wait 2 seconds for page to load" },
  { "action": "screenshot", "description": "Capture desktop screenshot" }
]`;

  let plannedSteps: AutonomousStep[] = [];

  try {
    const aiRes = await executeChatCompletion({
      prompt: planPrompt,
      systemPrompt: "You are an automated desktop action planner. You strictly follow timing directives, never confuse waits with searches, and only return raw JSON arrays.",
      useVaultRAG: false,
      useEpisodicMemory: false,
    });

    const rawPlan = aiRes.content.trim();
    const cleanJson = rawPlan
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    plannedSteps = JSON.parse(cleanJson);
  } catch (_err) {
    // Rule-based fallback planner if AI JSON parsing fails
    plannedSteps = generateFallbackPlan(trimmedGoal);
  }

  if (!Array.isArray(plannedSteps) || plannedSteps.length === 0) {
    plannedSteps = generateFallbackPlan(trimmedGoal);
  }

  // Step 3: Execute planned steps with smooth telemetry
  const executedHistory: { description: string; action: string; success: boolean; latency: number }[] = [];
  let finalScreenshotUrl = "/downloads/latest-desktop.jpg";

  for (let i = 0; i < plannedSteps.length; i++) {
    const step = plannedSteps[i];
    const stepDesc = `Step ${i + 1}/${plannedSteps.length}: ${step.description}`;
    if (onStepProgress) {
      onStepProgress(stepDesc, i, plannedSteps.length);
    }

    recordCUATelemetry({
      action: "step",
      source: "agent",
      stepTitle: stepDesc,
      x: step.coordinates?.x,
      y: step.coordinates?.y,
    });

    if (globalAbortRequested) {
      recordCUATelemetry({
        action: "step",
        source: "human",
        stepTitle: "Operator Killswitch Triggered - Halting Action Sequence",
      });
      break;
    }

    const stepStart = Date.now();
    let stepSuccess = true;

    try {
      if (step.action === "wait") {
        await new Promise((r) => setTimeout(r, step.duration || 500));
      } else if (step.action === "move" && step.coordinates) {
        await executeCUAAction({
          type: "move",
          coordinates: step.coordinates,
          duration: step.duration || 180,
          stepTitle: stepDesc,
          source: "agent",
        });
      } else if (step.action === "click" && step.coordinates) {
        // Glide mouse to position first so user visually sees cursor travel!
        await executeCUAAction({
          type: "move",
          coordinates: step.coordinates,
          duration: 160,
          stepTitle: `Gliding to (${step.coordinates.x}, ${step.coordinates.y})`,
          source: "agent",
        });
        await new Promise((r) => setTimeout(r, 60));
        await executeCUAAction({
          type: "click",
          coordinates: step.coordinates,
          stepTitle: stepDesc,
          source: "agent",
        });
      } else if (step.action === "double_click" && step.coordinates) {
        await executeCUAAction({
          type: "move",
          coordinates: step.coordinates,
          duration: 160,
          stepTitle: `Gliding to (${step.coordinates.x}, ${step.coordinates.y})`,
          source: "agent",
        });
        await new Promise((r) => setTimeout(r, 60));
        await executeCUAAction({
          type: "double_click",
          coordinates: step.coordinates,
          stepTitle: stepDesc,
          source: "agent",
        });
      } else if (step.action === "right_click" && step.coordinates) {
        await executeCUAAction({
          type: "move",
          coordinates: step.coordinates,
          duration: 160,
          stepTitle: `Gliding to (${step.coordinates.x}, ${step.coordinates.y})`,
          source: "agent",
        });
        await new Promise((r) => setTimeout(r, 60));
        await executeCUAAction({
          type: "right_click",
          coordinates: step.coordinates,
          stepTitle: stepDesc,
          source: "agent",
        });
      } else if (step.action === "type" && step.text) {
        await executeCUAAction({
          type: "type",
          text: step.text,
          stepTitle: stepDesc,
          source: "agent",
        });
      } else if (step.action === "key" && step.key) {
        await executeCUAAction({
          type: "key",
          key: step.key,
          stepTitle: stepDesc,
          source: "agent",
        });
      } else if (step.action === "hotkey" && (step.combo || step.key)) {
        await executeCUAAction({
          type: "hotkey",
          combo: step.combo || step.key,
          stepTitle: stepDesc,
          source: "agent",
        });
      } else if (step.action === "launch" && step.target) {
        await executeCUAAction({
          type: "launch",
          target: step.target,
          stepTitle: stepDesc,
          source: "agent",
        });
        await new Promise((r) => setTimeout(r, 800));
      } else if (step.action === "screenshot") {
        const screenRes = await executeCUAAction({
          type: "screenshot",
          stepTitle: stepDesc,
          source: "agent",
        });
        if (screenRes.screenshot) {
          try {
            const downloadDir = path.join(process.cwd(), "public", "downloads");
            await fs.mkdir(downloadDir, { recursive: true });
            const fileName = `autonomous-step-${Date.now()}.jpg`;
            await fs.writeFile(path.join(downloadDir, fileName), Buffer.from(screenRes.screenshot, "base64"));
            finalScreenshotUrl = `/downloads/${fileName}`;
          } catch {
            finalScreenshotUrl = `data:image/jpeg;base64,${screenRes.screenshot}`;
          }
        }
      }
    } catch (_err) {
      stepSuccess = false;
    }

    executedHistory.push({
      description: step.description,
      action: step.action,
      success: stepSuccess,
      latency: Date.now() - stepStart,
    });
  }

  // Step 4: Final verification screenshot
  try {
    const finalScreen = await executeCUAAction({ type: "screenshot" });
    if (finalScreen.screenshot) {
      const downloadDir = path.join(process.cwd(), "public", "downloads");
      await fs.mkdir(downloadDir, { recursive: true });
      const fileName = `autonomous-desktop-${Date.now()}.jpg`;
      await fs.writeFile(path.join(downloadDir, fileName), Buffer.from(finalScreen.screenshot, "base64"));
      finalScreenshotUrl = `/downloads/${fileName}`;
    }
  } catch {}

  const totalLatency = Date.now() - startTime;
  const summary = `Successfully completed ${executedHistory.filter((s) => s.success).length} of ${executedHistory.length} desktop actions for goal: "${trimmedGoal}".`;

  recordCUATelemetry({
    action: "step",
    source: "agent",
    stepTitle: `Goal Completed: "${trimmedGoal.slice(0, 40)}"`,
  });

  return {
    success: executedHistory.some((s) => s.success),
    goal: trimmedGoal,
    stepsExecuted: executedHistory.length,
    steps: executedHistory,
    finalScreenshotUrl,
    summary,
    totalLatency,
  };
}

/**
 * Intelligent Fallback plan generator for common desktop actions if LLM is unavailable
 */
function generateFallbackPlan(goal: string): AutonomousStep[] {
  const trimmed = goal.trim();
  const lower = trimmed.toLowerCase();

  const hasScreenshot =
    /(?:take\s+(?:a\s+)?(?:screen\s*shot|screenshot|snapshot|screen\s*capture)|capture\s+(?:the\s+)?(?:screen|desktop)|screen\s*shot|screenshot|snapshot)/i.test(
      lower
    );

  // 1. Calculator actions
  if (/\b(?:calc|calculator)\b/i.test(lower)) {
    const calcMatch = lower.match(/(?:calculate|compute|solve|type)\s+([0-9+\-*/.=^() ]+)/i);
    const calcExpr = calcMatch ? calcMatch[1].replace(/\s+/g, "") : "42*1337=";
    const finalExpr = calcExpr.endsWith("=") ? calcExpr : `${calcExpr}=`;
    return [
      { action: "launch", target: "calc", description: "Launch Windows Calculator" },
      { action: "wait", duration: 800, description: "Wait for Calculator to open" },
      { action: "click", coordinates: { x: 800, y: 500 }, description: "Focus Calculator keypad" },
      { action: "type", text: finalExpr, description: `Compute "${finalExpr}"` },
      ...(hasScreenshot ? [{ action: "screenshot" as const, description: "Capture Calculator screenshot" }] : []),
    ];
  }

  // 2. Notepad actions
  if (/\b(?:notepad|text editor)\b/i.test(lower)) {
    const textMatch = goal.match(/(?:type|write|saying|text)\s+["']?([^"']+)["']?/i);
    const textToType = textMatch ? textMatch[1].trim() : "Agent OS Desktop Automation Session\nReady for tasks.";
    return [
      { action: "launch", target: "notepad", description: "Launch Notepad" },
      { action: "wait", duration: 700, description: "Wait for Notepad window" },
      { action: "click", coordinates: { x: 500, y: 350 }, description: "Focus Notepad text editor" },
      { action: "type", text: textToType, description: `Type text into Notepad: "${textToType.slice(0, 30)}"` },
      { action: "key", key: "enter", description: "Press Enter" },
      ...(hasScreenshot ? [{ action: "screenshot" as const, description: "Capture Notepad screenshot" }] : []),
    ];
  }

  // 3. Multi-Step or Compound Task (e.g. "open youtube wait 2 seconds and take a screen shot")
  const steps: AutonomousStep[] = [];

  // Check for explicit wait duration
  const waitMatch = lower.match(
    /\b(?:wait|pause|sleep|delay)(?:\s+for|\s+of)?\s+(\d+(?:\.\d+)?)\s*(seconds|second|secs|sec|s|milliseconds|millis|ms|minutes|mins|m)?\b/i
  );
  let explicitWaitMs: number | undefined;
  if (waitMatch) {
    const val = parseFloat(waitMatch[1]);
    const unit = (waitMatch[2] || "").toLowerCase();
    if (unit.startsWith("m") && !unit.startsWith("ms") && !unit.startsWith("millis")) {
      explicitWaitMs = Math.round(val * 60000);
    } else if (unit === "ms" || unit.startsWith("millis")) {
      explicitWaitMs = Math.round(val);
    } else {
      explicitWaitMs = val <= 10 ? Math.round(val * 1000) : Math.round(val);
    }
  } else if (/\b(?:wait|pause|sleep)\s+(?:a\s+couple\s+(?:of\s+)?seconds|a\s+few\s+seconds)\b/i.test(lower)) {
    explicitWaitMs = 2500;
  } else if (/\b(?:wait|pause|sleep)\s+(?:a\s+second|a\s+bit|a\s+moment)\b/i.test(lower)) {
    explicitWaitMs = 1500;
  }

  // Check for app or website launch
  const launchMatch = lower.match(
    /^(?:can\s+you\s+|could\s+you\s+|please\s+)?(?:open|launch|start|run|visit|browse\s+to|browse|go\s+to|goto|navigate\s+to)\s+([a-zA-Z0-9_.:/ -]+?)(?:\s+(?:and\s+)?(?:then\s+)?(?:wait|pause|sleep|delay|take|capture|screen|screenshot)|$)/i
  );

  if (launchMatch && launchMatch[1]) {
    const rawTarget = launchMatch[1].trim();
    const resolved = resolveLaunchTarget(rawTarget);
    steps.push({
      action: "launch",
      target: resolved.target,
      description: `Open ${resolved.displayTitle}`,
    });

    const waitDuration = explicitWaitMs !== undefined ? explicitWaitMs : (resolved.isUrl ? 2000 : 800);
    steps.push({
      action: "wait",
      duration: waitDuration,
      description: `Wait ${waitDuration}ms for ${resolved.displayTitle} to load and stabilize`,
    });
  } else if (explicitWaitMs !== undefined) {
    steps.push({
      action: "wait",
      duration: explicitWaitMs,
      description: `Wait ${explicitWaitMs}ms`,
    });
  }

  // Check for typing
  const typeMatch = goal.match(/(?:type|write)\s+["']?([^"']+)["']?/i);
  if (typeMatch && !lower.includes("notepad")) {
    steps.push({
      action: "type",
      text: typeMatch[1].trim(),
      description: `Type "${typeMatch[1].trim().slice(0, 30)}"`,
    });
  }

  // Check for screenshot
  if (hasScreenshot) {
    steps.push({
      action: "screenshot",
      description: "Capture desktop screenshot",
    });
  }

  if (steps.length > 0) {
    return steps;
  }

  // 4. Default: Launch target or open Run
  const resolved = resolveLaunchTarget(goal);
  return [
    { action: "launch", target: resolved.target, description: `Launch ${resolved.displayTitle}` },
    { action: "wait", duration: resolved.isUrl ? 2000 : 800, description: "Wait for application to open" },
    ...(hasScreenshot ? [{ action: "screenshot" as const, description: "Capture desktop screenshot" }] : []),
  ];
}
