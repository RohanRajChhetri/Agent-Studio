import { executeChatCompletion } from "./llm-router";
import type { ParsedToolCall } from "./agentic-tool-loop";

export interface SelfHealingAuditEntry {
  toolName: string;
  originalArgs: Record<string, any>;
  error: string;
  attempt: number;
  maxAttempts: number;
  diagnosis: string;
  appliedFix: string;
  resolved: boolean;
  finalResult?: string;
  latencyMs: number;
}

export interface SelfHealingResult {
  success: boolean;
  result: string;
  auditEntries: SelfHealingAuditEntry[];
  correctedArgs?: Record<string, any>;
}

/**
 * Common known heuristic auto-fixes that can be applied without extra LLM latency
 */
function attemptHeuristicFix(
  toolName: string,
  args: Record<string, any>,
  error: string
): { canHeuristicFix: boolean; newArgs: Record<string, any>; diagnosis: string; fixDescription: string } {
  const errLower = error.toLowerCase();

  // 1. Scrapling web scraping heuristic fixes
  if (toolName.includes("scrape") || toolName === "web_scrape") {
    // If blocked by bot protection or cloudflare, switch to stealth mode with markdown
    if (errLower.includes("cloudflare") || errLower.includes("403") || errLower.includes("forbidden") || errLower.includes("blocked")) {
      return {
        canHeuristicFix: true,
        newArgs: { ...args, stealth: true, stealthMode: true, toMarkdown: true },
        diagnosis: "Target server blocked request via anti-bot or Cloudflare challenge.",
        fixDescription: "Activated Scrapling stealth mode and anti-bot bypass headers.",
      };
    }

    // If invalid selector returned empty or error
    if (errLower.includes("selector") || errLower.includes("xpath") || errLower.includes("cssselect")) {
      return {
        canHeuristicFix: true,
        newArgs: { ...args, selectors: undefined, toMarkdown: true },
        diagnosis: "CSS/XPath selector failed or was invalid on target DOM.",
        fixDescription: "Fell back to full-page Markdown extraction without restrictive selectors.",
      };
    }
  }

  // 2. Python / JS Code Sandbox heuristic fixes
  if (toolName === "python" || toolName === "code" || toolName === "execute_code") {
    const rawCode = args.code || args.script || "";

    // IndentationError in Python
    if (errLower.includes("indentationerror") && typeof rawCode === "string") {
      const fixedCode = rawCode
        .split("\n")
        .map((line: string) => line.replace(/\t/g, "    "))
        .join("\n");
      return {
        canHeuristicFix: true,
        newArgs: { ...args, code: fixedCode },
        diagnosis: "Python mixed tabs and spaces or indentation mismatch.",
        fixDescription: "Normalized all indentation tabs to 4 standard spaces.",
      };
    }

    // Missing print() in Python or console.log in JS
    if (!errLower.includes("error") && !rawCode.includes("print(") && !rawCode.includes("console.log")) {
      const lang = args.language || (toolName === "python" ? "python" : "javascript");
      const wrapped =
        lang === "python"
          ? `${rawCode}\n\n# Ensure output is printed\ntry:\n    print(result)\nexcept:\n    pass\n`
          : `${rawCode}\nif (typeof result !== 'undefined') console.log(result);`;
      return {
        canHeuristicFix: true,
        newArgs: { ...args, code: wrapped },
        diagnosis: "Code executed without emitting stdout print/console statements.",
        fixDescription: "Appended safe result printer to ensure output is captured.",
      };
    }
  }

  // 3. File Creation heuristic fixes
  if (toolName.includes("file") || toolName === "write_file" || toolName === "create_file") {
    const filePath = args.path || args.filename || "";
    // If path starts with invalid windows/posix slash
    if (filePath.startsWith("/") || filePath.startsWith("\\")) {
      const sanitized = filePath.replace(/^[/\\]+/, "");
      return {
        canHeuristicFix: true,
        newArgs: { ...args, path: sanitized, filename: sanitized },
        diagnosis: "File path had leading root slash preventing sandbox write.",
        fixDescription: "Sanitized path to relative sandbox root.",
      };
    }
  }

  return { canHeuristicFix: false, newArgs: args, diagnosis: "", fixDescription: "" };
}

/**
 * Execute an agent tool with an autonomous self-healing loop.
 * If the tool fails, it diagnoses the cause, patches arguments/code, and retries up to maxRetries.
 */
export async function executeToolWithSelfHealing(
  toolCall: ParsedToolCall,
  executor: (call: ParsedToolCall) => Promise<{ name: string; result: string; success: boolean; metadata?: any }>,
  maxRetries = 2
): Promise<SelfHealingResult> {
  const audits: SelfHealingAuditEntry[] = [];
  let currentCall = { ...toolCall };

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const start = Date.now();
    const res = await executor(currentCall);

    if (res.success) {
      if (audits.length > 0) {
        // Prior failures healed
        const lastAudit = audits[audits.length - 1];
        lastAudit.resolved = true;
        lastAudit.finalResult = res.result;
      }
      return {
        success: true,
        result: res.result,
        auditEntries: audits,
        correctedArgs: attempt > 1 ? currentCall.args : undefined,
      };
    }

    // Tool failed
    const errorMsg = res.result || "Unknown tool execution failure";

    if (attempt > maxRetries) {
      audits.push({
        toolName: currentCall.name,
        originalArgs: currentCall.args,
        error: errorMsg,
        attempt,
        maxAttempts: maxRetries + 1,
        diagnosis: "Exhausted all autonomous auto-fix retries without success.",
        appliedFix: "None (Max retries reached)",
        resolved: false,
        latencyMs: Date.now() - start,
      });

      return {
        success: false,
        result: res.result,
        auditEntries: audits,
      };
    }

    // Try heuristic fast-fix first
    const heuristic = attemptHeuristicFix(currentCall.name, currentCall.args, errorMsg);
    if (heuristic.canHeuristicFix) {
      audits.push({
        toolName: currentCall.name,
        originalArgs: currentCall.args,
        error: errorMsg,
        attempt,
        maxAttempts: maxRetries + 1,
        diagnosis: heuristic.diagnosis,
        appliedFix: heuristic.fixDescription,
        resolved: false,
        latencyMs: Date.now() - start,
      });

      currentCall = {
        ...currentCall,
        args: heuristic.newArgs,
      };
      continue;
    }

    // LLM-powered root-cause diagnosis & argument patch
    try {
      const diagStart = Date.now();
      const diagnosticPrompt = `You are the Autonomous Self-Healing Diagnostic Engine in Agent Studio OS.
A tool execution failed with the following parameters:

[TOOL NAME]: ${currentCall.name}
[TOOL ARGS]: ${JSON.stringify(currentCall.args, null, 2)}
[ERROR]: ${errorMsg}

Analyze why this failed and output ONLY a valid JSON object with the following structure:
{
  "diagnosis": "Brief 1-2 sentence explanation of the root cause",
  "fixDescription": "What was adjusted to fix it",
  "correctedArgs": { ...all arguments for the tool with corrections applied... }
}
Do not include any other markdown text or code blocks, just raw JSON.`;

      const diagCompletion = await executeChatCompletion({
        prompt: diagnosticPrompt,
        model: "auto/fast",
        systemPrompt: "You are an autonomous error repair engineer. Always return strictly valid JSON.",
      });

      const content = diagCompletion.content || "";
      const jsonStart = content.indexOf("{");
      const jsonEnd = content.lastIndexOf("}");
      if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
        audits.push({
          toolName: currentCall.name,
          originalArgs: currentCall.args,
          error: errorMsg,
          attempt,
          maxAttempts: maxRetries + 1,
          diagnosis: "LLM response did not contain structured JSON diagnostic.",
          appliedFix: "Aborted auto-fix.",
          resolved: false,
          latencyMs: Date.now() - diagStart,
        });
        break;
      }

      const rawJson = content.slice(jsonStart, jsonEnd + 1);
      const parsed = JSON.parse(rawJson);

      if (parsed.correctedArgs && typeof parsed.correctedArgs === "object") {
        audits.push({
          toolName: currentCall.name,
          originalArgs: currentCall.args,
          error: errorMsg,
          attempt,
          maxAttempts: maxRetries + 1,
          diagnosis: parsed.diagnosis || "Identified parameter or execution mismatch.",
          appliedFix: parsed.fixDescription || "Patched tool arguments based on LLM diagnosis.",
          resolved: false,
          latencyMs: Date.now() - diagStart,
        });

        currentCall = {
          ...currentCall,
          args: parsed.correctedArgs,
        };
      } else {
        // Could not generate valid fix arguments
        audits.push({
          toolName: currentCall.name,
          originalArgs: currentCall.args,
          error: errorMsg,
          attempt,
          maxAttempts: maxRetries + 1,
          diagnosis: "Could not formulate a verified correction for the tool arguments.",
          appliedFix: "Failed to patch.",
          resolved: false,
          latencyMs: Date.now() - diagStart,
        });
        break;
      }
    } catch (llmErr) {
      console.warn("[Self-Healing] LLM diagnostic failed:", llmErr);
      audits.push({
        toolName: currentCall.name,
        originalArgs: currentCall.args,
        error: errorMsg,
        attempt,
        maxAttempts: maxRetries + 1,
        diagnosis: `LLM diagnostic pass failed: ${llmErr instanceof Error ? llmErr.message : String(llmErr)}`,
        appliedFix: "Aborted auto-fix.",
        resolved: false,
        latencyMs: Date.now() - start,
      });
      break;
    }
  }

  return {
    success: false,
    result: `Tool execution failed after self-healing attempts`,
    auditEntries: audits,
  };
}
