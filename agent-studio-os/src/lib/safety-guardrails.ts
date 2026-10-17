/**
 * Safety Guardrails & Human-in-the-Loop (HITL) Validation Engine
 * Protects Agent Studio OS from destructive actions, sensitive file leaks, and unauthorized commands.
 */

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface SafetyCheckResult {
  allowed: boolean;
  requiresApproval: boolean;
  riskLevel: RiskLevel;
  reason?: string;
  sanitizedArgs?: Record<string, any>;
}

// Files that should never be overwritten or read by unprivileged agent tool calls
const SENSITIVE_FILE_PATTERNS = [
  /^\.env(?:\..+)?$/i,
  /(?:^|[\\/])\.env(?:\..+)?$/i,
  /(?:^|[\\/])id_rsa(?:\.pub)?$/i,
  /(?:^|[\\/])\.ssh[\\/]/i,
  /(?:^|[\\/])node_modules[\\/]/i,
  /(?:^|[\\/])\.git[\\/]/i,
  /prisma[\\/]schema\.prisma$/i,
];

// Dangerous shell command patterns
const DESTRUCTIVE_SHELL_PATTERNS = [
  /\brm\s+-[rf]{1,2}\b/i,
  /\bdel\s+(?:\/f|\/s|\/q)\b/i,
  /\brmdir\s+\/s\b/i,
  /\bformat\s+[a-z]:/i,
  /\b(mkfs|dd\s+if=)/i,
  /\b(?:drop\s+database|drop\s+table|truncate\s+table)\b/i,
  /\b(?:shutdown|reboot)\b/i,
  />\s*\/dev\/sd[a-z]/i,
];

/**
 * Validates a tool invocation against safety policies and identifies if human approval is needed.
 */
export function validateToolActionSafety(
  toolName: string,
  args: Record<string, any> = {},
  options?: { allowHighRiskWithApproval?: boolean; isUserExplicitlyApproved?: boolean }
): SafetyCheckResult {
  const normalizedTool = (toolName || "").toLowerCase().trim();

  // If user has explicitly approved this execution step, allow it (unless critical system-level block)
  if (options?.isUserExplicitlyApproved) {
    return {
      allowed: true,
      requiresApproval: false,
      riskLevel: "medium",
      reason: "User manually granted approval",
    };
  }

  // 1. Check target paths for sensitive files
  const targetPath = String(
    args.path || args.file || args.filename || args.filePath || args.targetFolder || ""
  ).trim();

  if (targetPath) {
    for (const pattern of SENSITIVE_FILE_PATTERNS) {
      if (pattern.test(targetPath)) {
        return {
          allowed: false,
          requiresApproval: true,
          riskLevel: "critical",
          reason: `Access to protected system file "${targetPath}" is blocked by security guardrails.`,
        };
      }
    }

    // Path traversal check (e.g. ../../Windows or /etc/passwd)
    if (
      targetPath.includes("..\\..\\") ||
      targetPath.includes("../../") ||
      /^[a-z]:\\windows/i.test(targetPath) ||
      /^\/etc\//i.test(targetPath)
    ) {
      return {
        allowed: false,
        requiresApproval: true,
        riskLevel: "critical",
        reason: `Path traversal or system directory escape attempted in "${targetPath}".`,
      };
    }
  }

  // 2. Check shell / code commands for destructive actions
  const codeOrCommand = String(
    args.code || args.command || args.cmd || args.script || args.query || ""
  );

  if (codeOrCommand) {
    for (const pattern of DESTRUCTIVE_SHELL_PATTERNS) {
      if (pattern.test(codeOrCommand)) {
        return {
          allowed: false,
          requiresApproval: true,
          riskLevel: "critical",
          reason: `Destructive command pattern detected: "${pattern}". Execution halted.`,
        };
      }
    }
  }

  // 3. Classify risk by tool category
  // Low Risk: safe read-only operations
  if (
    normalizedTool === "search" ||
    normalizedTool === "web_search" ||
    normalizedTool === "read_file" ||
    normalizedTool === "view_file" ||
    normalizedTool === "list_dir" ||
    normalizedTool === "ls" ||
    normalizedTool === "find_file" ||
    normalizedTool === "list_files" ||
    normalizedTool === "create_pdf" ||
    normalizedTool === "generate_pdf" ||
    normalizedTool === "export"
  ) {
    return {
      allowed: true,
      requiresApproval: false,
      riskLevel: "low",
    };
  }

  // Medium Risk: creating project files or documents in workspace
  if (
    normalizedTool === "write_file" ||
    normalizedTool === "create_file" ||
    normalizedTool === "save_file" ||
    normalizedTool === "make_dir" ||
    normalizedTool === "create_folder" ||
    normalizedTool === "code" ||
    normalizedTool === "execute_code"
  ) {
    return {
      allowed: true,
      requiresApproval: false,
      riskLevel: "medium",
    };
  }

  // High Risk: database mutations, external HTTP calls, or file deletions
  if (
    normalizedTool.includes("delete") ||
    normalizedTool.includes("drop") ||
    normalizedTool.startsWith("postgres_") ||
    normalizedTool === "external_skill" ||
    normalizedTool === "webhook" ||
    normalizedTool === "shell" ||
    normalizedTool === "bash" ||
    normalizedTool === "terminal"
  ) {
    if (options?.allowHighRiskWithApproval) {
      return {
        allowed: false,
        requiresApproval: true,
        riskLevel: "high",
        reason: `Tool "${toolName}" performs elevated or external actions that require confirmation.`,
      };
    }
    return {
      allowed: true,
      requiresApproval: false,
      riskLevel: "high",
      reason: `Tool "${toolName}" executed under supervised agent permissions.`,
    };
  }

  // Default: allow with low risk
  return {
    allowed: true,
    requiresApproval: false,
    riskLevel: "low",
  };
}
