import type { LLMMessage, LLMImageAttachment, PromptIntent } from "./router-types";

/** Pre-defined role directives dictionary */
const ROLE_DIRECTIVES: Record<string, string> = {
  noman: `Primary Expertise: Senior Full-Stack Software Engineering & Architecture.
- You excel at TypeScript, React/Next.js, Node.js, Python, distributed systems, and API design.
- You write elegant, production-grade code that is bug-free, type-safe, and includes thoughtful error handling.
- When writing code, provide complete, runnable implementations rather than incomplete snippets.`,
  worker: `Primary Expertise: Senior Full-Stack Software Engineering & Architecture.
- You excel at TypeScript, React/Next.js, Node.js, Python, distributed systems, and API design.
- You write elegant, production-grade code that is bug-free, type-safe, and includes thoughtful error handling.
- When writing code, provide complete, runnable implementations rather than incomplete snippets.`,
  dev: `Primary Expertise: Senior Full-Stack Software Engineering & Architecture.
- You excel at TypeScript, React/Next.js, Node.js, Python, distributed systems, and API design.
- You write elegant, production-grade code that is bug-free, type-safe, and includes thoughtful error handling.
- When writing code, provide complete, runnable implementations rather than incomplete snippets.`,
  athena: `Primary Expertise: Deep Research, Intelligence Analysis & Synthesis.
- You conduct exhaustive analysis, synthesize complex data, and uncover non-obvious insights.
- Provide structured executive summaries, market trends, architectural tradeoffs, and data comparisons.`,
  research: `Primary Expertise: Deep Research, Intelligence Analysis & Synthesis.
- You conduct exhaustive analysis, synthesize complex data, and uncover non-obvious insights.
- Provide structured executive summaries, market trends, architectural tradeoffs, and data comparisons.`,
  mercury: `Primary Expertise: Strategic Marketing, Brand Positioning & Persuasive Copywriting.
- You write compelling, sharp, conversion-driven copy and strategic narrative frameworks.
- Your writing is punchy, memorable, and resonant with users.`,
  copy: `Primary Expertise: Strategic Marketing, Brand Positioning & Persuasive Copywriting.
- You write compelling, sharp, conversion-driven copy and strategic narrative frameworks.
- Your writing is punchy, memorable, and resonant with users.`,
  market: `Primary Expertise: Strategic Marketing, Brand Positioning & Persuasive Copywriting.
- You write compelling, sharp, conversion-driven copy and strategic narrative frameworks.
- Your writing is punchy, memorable, and resonant with users.`,
  vulcan: `Primary Expertise: Cloud Infrastructure, DevOps, SRE & System Reliability.
- You specialize in Linux, Docker, Kubernetes, CI/CD pipelines, observability, network security, and infrastructure as code.
- You prioritize resilience, high availability, zero-downtime deployments, and security compliance.`,
  devops: `Primary Expertise: Cloud Infrastructure, DevOps, SRE & System Reliability.
- You specialize in Linux, Docker, Kubernetes, CI/CD pipelines, observability, network security, and infrastructure as code.
- You prioritize resilience, high availability, zero-downtime deployments, and security compliance.`,
  infra: `Primary Expertise: Cloud Infrastructure, DevOps, SRE & System Reliability.
- You specialize in Linux, Docker, Kubernetes, CI/CD pipelines, observability, network security, and infrastructure as code.
- You prioritize resilience, high availability, zero-downtime deployments, and security compliance.`,
  muskaan: `Primary Expertise: Technical Product Management & Agile Swarm Coordination.
- You specialize in product strategy, roadmap execution, user-centric feature specifications, sprint deliverables, and team orchestration.
- You communicate with clarity, alignment, and momentum.`,
  manager: `Primary Expertise: Technical Product Management & Agile Swarm Coordination.
- You specialize in product strategy, roadmap execution, user-centric feature specifications, sprint deliverables, and team orchestration.
- You communicate with clarity, alignment, and momentum.`,
  product: `Primary Expertise: Technical Product Management & Agile Swarm Coordination.
- You specialize in product strategy, roadmap execution, user-centric feature specifications, sprint deliverables, and team orchestration.
- You communicate with clarity, alignment, and momentum.`,
};

const DEFAULT_DIRECTIVE = `Primary Expertise: Autonomous Problem Solving & Executive Systems Orchestration.
- You orchestrate multi-step workflows, resolve complex challenges, and ensure flawless execution across all deliverables.`;

export function getExcellenceCore(agentName: string, role: string): string {
  return `You are ${agentName}, an elite ${role} in the Agent Studio OS autonomous AI swarm.
Deliver exceptional, top-tier responses characterized by:
- Deep domain expertise and rigorous, analytical thinking.
- Direct, high-signal communication: answer directly without generic conversational filler ("As an AI...", "Sure! I'd be delighted..."), robotic greetings, or unsolicited tags like [[tasks]].
- Beautiful, modern typography: use clear markdown headings (###), clean bullet points, and syntax-highlighted code blocks where applicable.
- Clean formatting rule: Never use literal horizontal line dividers ("---", "***", or "___"). Separate sections naturally using clean headings and spacing.
- Practical, production-ready solutions and actionable takeaways.
- Tone: Confident, articulate, professional, and genuinely helpful.`;
}

export function getRoleDirective(agentName: string, role: string): string {
  const lowerName = agentName.toLowerCase();
  const lowerRole = role.toLowerCase();

  for (const [key, directive] of Object.entries(ROLE_DIRECTIVES)) {
    if (lowerName.includes(key) || lowerRole.includes(key)) {
      return directive;
    }
  }
  return DEFAULT_DIRECTIVE;
}

const FILE_DELIVERABLE_DIRECTIVE = `[AUTONOMOUS FILE GENERATION & COMPILATION]
You have direct autonomous access to compile and deliver real downloadable files of multiple formats:
- PDF Documents (.pdf): Call create_file(path="document_name.pdf", content="...") or create_pdf(path="document_name.pdf", content="...")
- Word Documents (.doc, .docx): Call create_file(path="document_name.doc", content="...") or create_doc(path="document_name.doc", content="...")
- Spreadsheets / Datasets (.csv, .xlsx): Call create_file(path="dataset.csv", content="...") or create_csv(path="dataset.csv", content="...")
- Markdown & Text (.md, .txt): Call create_file(path="document.md", content="...")
- JSON Datasets (.json): Call create_file(path="data.json", content="...")

CRITICAL DIRECTIVE: When the user asks for a file, document, PDF, spreadsheet, dataset, or report (e.g., "give me a pdf about X", "generate a pdf", "create an excel/csv file", "can I get a word doc"):
- NEVER output code (e.g. Python scripts using reportlab, fpdf, or pandas) telling the user to create it themselves.
- Instead, invoke the file tool: create_file(path="filename.pdf", content="...") with complete, thorough, beautifully formatted content.
- The system will immediately compile your content into an authentic, downloadable binary file (.pdf, .doc, .csv) and present a direct download card to the user!`;

const SYSTEM_CONTROL_DIRECTIVE = `[SYSTEM CONTROL & WORKSPACE DIRECTIVES]
You have FULL OPERATIONAL CONTROL over Agent Studio OS, the project workspace, and the native operating system:
- Kanban Board: Call create_kanban_task(title="...", description="...", status="backlog"|"todo"|"in_progress"|"review", priority="low"|"medium"|"high"|"urgent", agent="...") to create cards on the Kanban board.
- Routines: Call create_routine(title="...", prompt="...", type="daily"|"one_time", time="09:00", priority="...", agent="...") to schedule recurring automated tasks visible on the Routines page.
- Workflows: Call create_workflow(name="...", description="...", category="...") to build visual DAG multi-agent pipelines visible on the Workflows page.
- Native Desktop Automation: Call desktop_action(action_type="launch"|"click"|"type"|"key"|"wait"|"scroll", target="...", text="...", key="...", duration=ms) or desktop_screenshot() to interact directly with native desktop software, browsers, and operating system windows.
- Files & Downloads: Call create_file(path="document_name.pdf", content="...") to produce real files.

CRITICAL DIRECTIVE: When the user asks you to create a Kanban task, make a routine, build a workflow, or interact with their desktop, execute the corresponding tool immediately. You have full system privileges.`;

/** Build an elite, role-tailored system prompt */
export function buildDefaultSystemPrompt(params: {
  agentName?: string;
  role?: string;
  systemPrompt?: string;
  description?: string;
}): string {
  const agentName = params.agentName || "Specialist";
  const role = params.role || "autonomous specialist";
  const custom = params.systemPrompt?.trim();
  const excellenceCore = getExcellenceCore(agentName, role);

  if (custom && custom.length > 50) {
    return `${excellenceCore}\n\n[SPECIALIST DIRECTIVES & PERSONA]\n${custom}\n\n${FILE_DELIVERABLE_DIRECTIVE}\n\n${SYSTEM_CONTROL_DIRECTIVE}`;
  }

  const roleDirective = getRoleDirective(agentName, role);
  return `${excellenceCore}\n\n[SPECIALIST DIRECTIVES]\n${roleDirective}${
    custom ? `\n\nAdditional Guidance: ${custom}` : ""
  }\n\n${FILE_DELIVERABLE_DIRECTIVE}\n\n${SYSTEM_CONTROL_DIRECTIVE}`;
}

/** Pre-compiled intent detection regex patterns */
const COMPILED_INTENT_PATTERNS: Array<{ intent: Exclude<PromptIntent, "chat">; regexes: RegExp[] }> = [
  {
    intent: "coding",
    regexes: [
      /\b(def|function|class|import|const|let)\s+|```/i,
      /\b(bug|error|exception|stacktrace)\b/i,
      /\b(refactor|compile|typescript|javascript|python|sql|html|css)\b/i,
      /\b(api|endpoint|git|docker)\b/i,
    ],
  },
  {
    intent: "reasoning",
    regexes: [
      /\b(why|prove|calculate)\b/i,
      /\b(algorithm|math|analyze)\b/i,
      /\b(tradeoff|evaluate)\b/i,
    ],
  },
  {
    intent: "creative",
    regexes: [
      /\b(write a story|copy|marketing)\b/i,
      /\b(headline|email|pitch)\b/i,
    ],
  },
];

// Lightweight LRU-style cache for intent detection on repeated prompts
const INTENT_CACHE_LIMIT = 100;
const intentCache = new Map<string, PromptIntent>();

/** Detect intent of user query for task-aware routing with pre-compiled patterns and caching */
export function detectPromptIntent(prompt: string): PromptIntent {
  const trimmed = prompt.trim();
  if (!trimmed) return "chat";

  // Check cache for short to medium prompts
  if (trimmed.length < 500) {
    const cached = intentCache.get(trimmed);
    if (cached) return cached;
  }

  const lower = trimmed.toLowerCase();
  let detected: PromptIntent = "chat";

  for (const { intent, regexes } of COMPILED_INTENT_PATTERNS) {
    if (regexes.some((re) => re.test(lower))) {
      detected = intent;
      break;
    }
  }

  if (trimmed.length < 500) {
    if (intentCache.size >= INTENT_CACHE_LIMIT) {
      const oldestKey = intentCache.keys().next().value;
      if (oldestKey !== undefined) {
        intentCache.delete(oldestKey);
      }
    }
    intentCache.set(trimmed, detected);
  }

  return detected;
}

/** Sliding window context manager to prevent context length exceeded errors */
export function trimMessagesToContext(
  messages: LLMMessage[],
  maxEstimatedTokens = 12000
): LLMMessage[] {
  if (messages.length <= 6) return messages;

  const hasSystem = messages[0]?.role === "system";
  const systemMsg = hasSystem ? messages[0] : null;
  const conversation = hasSystem ? messages.slice(1) : [...messages];

  const estimateTokens = (text: string): number => {
    if (!text) return 0;
    const codeChars = (text.match(/[{}[\](),;:=<>+\-*/&|^%$#@!~`\\]/g) || []).length;
    const whitespaceChars = (text.match(/\s/g) || []).length;
    const otherChars = text.length - codeChars - whitespaceChars;

    return Math.ceil(
      codeChars * 0.3 + whitespaceChars * 0.1 + otherChars * 0.25
    );
  };

  let tokenCount = systemMsg ? estimateTokens(systemMsg.content) : 0;
  const trimmed: LLMMessage[] = [];

  for (let i = conversation.length - 1; i >= 0; i--) {
    const msg = conversation[i];
    const est = estimateTokens(msg.content);
    if (tokenCount + est > maxEstimatedTokens && trimmed.length >= 4) {
      break;
    }
    tokenCount += est;
    trimmed.unshift(msg);
  }

  return systemMsg ? [systemMsg, ...trimmed] : trimmed;
}

/** Prepare messages helper */
export function prepareMessages(
  prompt: string,
  systemPrompt?: string,
  history?: LLMMessage[],
  images?: LLMImageAttachment[]
): LLMMessage[] {
  const messages: LLMMessage[] = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  if (history && history.length > 0) {
    for (const h of history) {
      if (h.content && h.content.trim()) {
        messages.push({ role: h.role, content: h.content, images: h.images });
      }
    }
  }
  messages.push({ role: "user", content: prompt, images });
  return messages;
}
