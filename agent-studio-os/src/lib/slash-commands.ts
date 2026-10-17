/**
 * Agent Studio OS — Centralized Slash Command Dispatcher
 * 
 * All slash commands are routed through this centralized dispatcher.
 * Commands are grouped into: MVP, Core Agent, Advanced, and Admin categories.
 */

export type SlashCommandCategory = "mvp" | "core" | "advanced" | "admin";

export interface SlashCommandDefinition {
  command: string;
  aliases?: string[];
  description: string;
  category: SlashCommandCategory;
  usage: string;
  requiresArgs: boolean;
  authGated?: boolean; // Dangerous commands need confirmation
  handler: string; // Handler key for routing
}

// Complete command registry
export const SLASH_COMMANDS: SlashCommandDefinition[] = [
  // MVP / Essential
  {
    command: "/new",
    aliases: ["/fresh"],
    description: "Start a fresh session, clearing current conversation",
    category: "mvp",
    usage: "/new [session name]",
    requiresArgs: false,
    handler: "new_session",
  },
  {
    command: "/help",
    aliases: ["/commands", "/?"],
    description: "View all available slash commands",
    category: "mvp",
    usage: "/help",
    requiresArgs: false,
    handler: "help",
  },
  {
    command: "/status",
    aliases: ["/info"],
    description: "View session, model, and token usage status",
    category: "mvp",
    usage: "/status",
    requiresArgs: false,
    handler: "status",
  },
  {
    command: "/stop",
    aliases: ["/halt", "/cancel"],
    description: "Interrupt all current actions",
    category: "mvp",
    usage: "/stop",
    requiresArgs: false,
    authGated: true,
    handler: "stop",
  },

  // Core Agent & Control
  {
    command: "/branch",
    description: "Branch the current session into a new one",
    category: "core",
    usage: "/branch [branch name]",
    requiresArgs: false,
    handler: "branch",
  },
  {
    command: "/queue",
    aliases: ["/kanban", "/task"],
    description: "Queue a task to the Kanban board",
    category: "core",
    usage: "/queue <task description>",
    requiresArgs: true,
    handler: "queue_task",
  },
  {
    command: "/retry",
    description: "Retry the last agent response",
    category: "core",
    usage: "/retry",
    requiresArgs: false,
    handler: "retry",
  },
  {
    command: "/undo",
    description: "Revert N turns of conversation",
    category: "core",
    usage: "/undo [N]",
    requiresArgs: false,
    handler: "undo",
  },
  {
    command: "/model",
    description: "Switch AI model for this session",
    category: "core",
    usage: "/model [model name]",
    requiresArgs: false,
    handler: "switch_model",
  },
  {
    command: "/agents",
    aliases: ["/a2a", "/conference"],
    description: "Launch A2A hierarchical chain-of-command mission",
    category: "core",
    usage: "/agents <mission topic>",
    requiresArgs: true,
    handler: "a2a_mission",
  },

  // Advanced & Production
  {
    command: "/plan",
    description: "Generate an implementation plan for a task",
    category: "advanced",
    usage: "/plan <task description>",
    requiresArgs: true,
    handler: "plan",
  },
  {
    command: "/compress",
    description: "Compress conversation history to manage token usage",
    category: "advanced",
    usage: "/compress",
    requiresArgs: false,
    handler: "compress",
  },
  {
    command: "/review",
    description: "Run an independent review sub-agent",
    category: "advanced",
    usage: "/review [instructions]",
    requiresArgs: false,
    handler: "review",
  },
  {
    command: "/loop",
    description: "Set up recurring task execution",
    category: "advanced",
    usage: "/loop [interval] <prompt>",
    requiresArgs: true,
    handler: "loop",
  },
  {
    command: "/image",
    aliases: ["/img", "/generate"],
    description: "Generate an image from text prompt",
    category: "advanced",
    usage: "/image <prompt>",
    requiresArgs: true,
    handler: "image_gen",
  },
  {
    command: "/code",
    description: "Open code workspace",
    category: "advanced",
    usage: "/code [language]",
    requiresArgs: false,
    handler: "code",
  },

  // Administrative
  {
    command: "/usage",
    aliases: ["/cost", "/telemetry"],
    description: "Check token usage and rate limits",
    category: "admin",
    usage: "/usage",
    requiresArgs: false,
    handler: "usage",
  },
  {
    command: "/profile",
    description: "View project/user profile details",
    category: "admin",
    usage: "/profile",
    requiresArgs: false,
    handler: "profile",
  },
  {
    command: "/debug",
    description: "Export logs and debug reports",
    category: "admin",
    usage: "/debug",
    requiresArgs: false,
    handler: "debug",
  },
  {
    command: "/voice",
    description: "Open Gemini Live Voice cockpit",
    category: "admin",
    usage: "/voice",
    requiresArgs: false,
    handler: "voice",
  },
  {
    command: "/memory",
    aliases: ["/vault"],
    description: "Open Memory Vault browser",
    category: "admin",
    usage: "/memory",
    requiresArgs: false,
    handler: "memory",
  },
  {
    command: "/routines",
    description: "Open Routines manager",
    category: "admin",
    usage: "/routines",
    requiresArgs: false,
    handler: "routines",
  },
  {
    command: "/settings",
    description: "Open Settings panel",
    category: "admin",
    usage: "/settings",
    requiresArgs: false,
    handler: "settings",
  },
  {
    command: "/dump",
    aliases: ["/braindump"],
    description: "Open Brain Dump modal for rapid idea capture",
    category: "admin",
    usage: "/dump",
    requiresArgs: false,
    handler: "braindump",
  },
  {
    command: "/packs",
    description: "Browse and install agent packs",
    category: "admin",
    usage: "/packs",
    requiresArgs: false,
    handler: "packs",
  },
  {
    command: "/pipeline",
    description: "Open agent pipeline view",
    category: "admin",
    usage: "/pipeline",
    requiresArgs: false,
    handler: "pipeline",
  },
];

/**
 * Parse a slash command from raw input text.
 * Returns the matched command, extracted args, and the handler key.
 */
export function parseSlashCommand(input: string): {
  matched: boolean;
  command?: SlashCommandDefinition;
  args?: string;
  rawCommand?: string;
} {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return { matched: false };

  const parts = trimmed.split(/\s+/);
  const rawCmd = parts[0].toLowerCase();
  const args = parts.slice(1).join(" ").trim();

  // Find matching command by primary command or aliases
  const found = SLASH_COMMANDS.find(
    (def) =>
      def.command === rawCmd ||
      (def.aliases && def.aliases.includes(rawCmd))
  );

  if (found) {
    return {
      matched: true,
      command: found,
      args,
      rawCommand: rawCmd,
    };
  }

  return { matched: false, rawCommand: rawCmd };
}

/**
 * Get all commands matching a partial input (for autocomplete)
 */
export function getCommandSuggestions(partial: string): SlashCommandDefinition[] {
  const lower = partial.toLowerCase().replace(/^\//, "");
  if (!lower) return SLASH_COMMANDS;

  return SLASH_COMMANDS.filter(
    (cmd) =>
      cmd.command.slice(1).startsWith(lower) ||
      cmd.description.toLowerCase().includes(lower) ||
      (cmd.aliases && cmd.aliases.some((a) => a.slice(1).startsWith(lower)))
  );
}

/**
 * Generate help text for all commands grouped by category
 */
export function generateHelpText(): string {
  const categories: Record<SlashCommandCategory, string> = {
    mvp: "📋 MVP / Essential",
    core: "🤖 Core Agent & Control",
    advanced: "🚀 Advanced & Production",
    admin: "⚙️ Administrative",
  };

  let help = "# Agent Studio OS — Slash Commands\n\n";

  for (const [cat, label] of Object.entries(categories)) {
    const cmds = SLASH_COMMANDS.filter((c) => c.category === cat);
    help += `## ${label}\n\n`;
    for (const cmd of cmds) {
      const aliases = cmd.aliases ? ` (aliases: ${cmd.aliases.join(", ")})` : "";
      const gated = cmd.authGated ? " ⚠️" : "";
      help += `- **\`${cmd.usage}\`**${gated} — ${cmd.description}${aliases}\n`;
    }
    help += "\n";
  }

  return help;
}

/**
 * Get the category display info
 */
export function getCategoryInfo(cat: SlashCommandCategory): { label: string; emoji: string; color: string } {
  const map: Record<SlashCommandCategory, { label: string; emoji: string; color: string }> = {
    mvp: { label: "Essential", emoji: "📋", color: "text-blue-500" },
    core: { label: "Core Agent", emoji: "🤖", color: "text-purple-500" },
    advanced: { label: "Advanced", emoji: "🚀", color: "text-amber-500" },
    admin: { label: "Admin", emoji: "⚙️", color: "text-slate-500" },
  };
  return map[cat];
}
