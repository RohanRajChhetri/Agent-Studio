export interface AgentProfile {
  id: string;
  name: string;
  displayName: string;
  avatar: string;
  systemPrompt: string;
  model: string | null;
  themeColor: string;
  status: "online" | "offline" | "busy";
  profilePath: string | null;
  description: string;
  createdAt: string;
  updatedAt: string;
  tools: AgentToolConfig[];
  integrations?: AgentIntegrationConfig[];
  role?: "orchestrator" | "manager" | "specialist" | "worker";
  department?: string;
  reportsToId?: string | null;
  reportsTo?: AgentProfile | null;
  subordinates?: AgentProfile[];
}

export interface AgentToolConfig {
  id: string;
  toolId: string;
  enabled: boolean;
}

export interface AgentIntegrationConfig {
  id: string;
  platform: string;
  enabled: boolean;
  config: string | null;
}

export interface SubtaskItem {
  id: string;
  title: string;
  description?: string;
  agentId?: string | null;
  agentName?: string | null;
  agentAvatar?: string | null;
  priority?: "low" | "medium" | "high";
  completed: boolean;
}

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  status: "backlog" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high";
  position: number;
  dueDate: string | null;
  agentId: string | null;
  agent?: AgentProfile | null;
  result?: string | null;
  subtasks?: SubtaskItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ModelInfo {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export interface ModelsResponse {
  data: ModelInfo[];
  online: boolean;
}

export interface ProviderKey {
  provider: string;
  envVar: string;
  label: string;
  masked: string;
  isSet: boolean;
}

export interface VaultFile {
  name: string;
  path: string;
  relativePath: string;
  isDirectory: boolean;
  size?: number;
  modifiedAt?: string;
  children?: VaultFile[];
}

export interface GraphStats {
  nodes: number;
  edges: number;
  communities: number;
  godNodes: string[];
}

export interface ActivityEntry {
  id: string;
  type: "task_moved" | "note_created" | "agent_chat" | "agent_created" | "agent_deleted" | "task_created";
  message: string;
  agentId: string | null;
  metadata: string | null;
  createdAt: string;
}

export interface DashboardStats {
  totalAgents: number;
  activeTasks: number;
  vaultNotes: number;
  omnirouteOnline: boolean;
  completedTasks?: number;
  totalTokensUsed?: number;
  estimatedCostUsd?: string;
}

export interface ChatCompletionMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatCompletionMessage[];
  max_tokens?: number;
  stream?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  agentId: string;
  agent?: AgentProfile;
  model: string | null;
  pinned: boolean;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
  lastMessage?: string | null;
}

export interface ChatMessageItem {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  model?: string | null;
  agentId?: string | null;
  sessionId?: string | null;
  latency?: number | null;
  tokens?: number | null;
  createdAt: string;
}

export interface TestModelResult {
  success: boolean;
  latency: number;
  error?: string;
}

export const TOOL_DEFINITIONS = [
  { id: "terminal", label: "Terminal", icon: "Terminal", description: "Terminal & Processes" },
  { id: "file", label: "Files", icon: "FileText", description: "File Operations" },
  { id: "browser", label: "Browser", icon: "Globe", description: "Browser Automation" },
  { id: "web", label: "Web Search", icon: "Search", description: "Web Search & Scraping" },
  { id: "code_execution", label: "Code Exec", icon: "Code", description: "Code Execution" },
  { id: "vision", label: "Vision", icon: "Eye", description: "Vision / Image Analysis" },
  { id: "image_gen", label: "Image Gen", icon: "Image", description: "Image Generation" },
  { id: "memory", label: "Memory", icon: "Brain", description: "Memory" },
  { id: "todo", label: "Tasks", icon: "ListTodo", description: "Task Planning" },
  { id: "skills", label: "Skills", icon: "BookOpen", description: "Skills" },
  { id: "delegation", label: "Delegation", icon: "Users", description: "Task Delegation" },
  { id: "computer_use", label: "Computer Use", icon: "Monitor", description: "Computer Use" },
  { id: "x_search", label: "X Search", icon: "Twitter", description: "X (Twitter) Search" },
  { id: "tts", label: "TTS", icon: "Volume2", description: "Text-to-Speech" },
  { id: "spotify", label: "Spotify", icon: "Music", description: "Spotify" },
] as const;

export const INTEGRATION_DEFINITIONS = [
  { id: "whatsapp", label: "WhatsApp", description: "WhatsApp personal — pair via QR code", setupCmd: "hermes whatsapp" },
  { id: "whatsapp_cloud", label: "WhatsApp Cloud", description: "WhatsApp Business Cloud API", setupCmd: "hermes whatsapp-cloud" },
  { id: "telegram", label: "Telegram", description: "Telegram Bot API via gateway", setupCmd: "hermes gateway setup" },
  { id: "discord", label: "Discord", description: "Discord bot integration", setupCmd: "hermes gateway setup" },
  { id: "slack", label: "Slack", description: "Slack workspace app with slash commands", setupCmd: "hermes slack manifest" },
  { id: "signal", label: "Signal", description: "Signal messenger via linked device", setupCmd: "hermes gateway setup" },
  { id: "webhook", label: "Webhook", description: "HTTP webhook for custom event-driven activation", setupCmd: "hermes webhook subscribe" },
] as const;

export const PROVIDER_DEFINITIONS = [
  { provider: "google", envVar: "GEMINI_API_KEY", label: "Google Gemini", models: ["gemini-3.6-flash", "gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-pro-latest"] },
  { provider: "omniroute", envVar: "OMNIROUTE_API_KEY", label: "OmniRoute Gateway", models: ["auto/fast", "auto/smart", "auto/best-coding", "auto/best-chat"] },
  { provider: "groq", envVar: "GROQ_API_KEY", label: "Groq High-Speed", models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "deepseek-r1-distill-llama-70b"] },
  { provider: "anthropic", envVar: "ANTHROPIC_API_KEY", label: "Anthropic", models: ["claude-3-7-sonnet", "claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"] },
  { provider: "openai", envVar: "OPENAI_API_KEY", label: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "o3-mini", "o1"] },
  { provider: "deepseek", envVar: "DEEPSEEK_API_KEY", label: "DeepSeek", models: ["deepseek-chat", "deepseek-reasoner"] },
  { provider: "xai", envVar: "XAI_API_KEY", label: "xAI (Grok)", models: ["grok-2", "grok-beta"] },
  { provider: "moonshot", envVar: "MOONSHOT_API_KEY", label: "Moonshot (Kimi)", models: ["moonshot-v1"] },
] as const;

export const KANBAN_COLUMNS = [
  { id: "backlog" as const, title: "Backlog", color: "#6b7280" },
  { id: "in_progress" as const, title: "In Progress", color: "#3b82f6" },
  { id: "review" as const, title: "Review", color: "#f59e0b" },
  { id: "done" as const, title: "Done", color: "#22c55e" },
];

export const PRIORITY_COLORS = {
  low: "#6b7280",
  medium: "#f59e0b",
  high: "#ef4444",
} as const;
