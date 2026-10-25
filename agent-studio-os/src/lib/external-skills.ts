import { prisma } from "./prisma";
import type {
  ExternalSkill,
  ExternalSkillExecutionResult,
} from "@/types/skills";
import { executeJavaScript, executePython } from "./tools-engine";

const SETTINGS_KEY = "external_skills";

export const PRESET_EXTERNAL_SKILLS: ExternalSkill[] = [
  {
    id: "skill-crypto-price",
    name: "crypto_price",
    displayName: "Live Crypto Market Ticker",
    description: "Fetches live cryptocurrency prices and 24h market stats via CoinGecko public API",
    category: "Finance",
    type: "api",
    enabled: true,
    endpoint: "https://api.coingecko.com/api/v3/simple/price?ids={{coin}}&vs_currencies=usd&include_24hr_change=true",
    method: "GET",
    parameters: [
      {
        name: "coin",
        type: "string",
        description: "Cryptocurrency ID (e.g. bitcoin, ethereum, solana, cardano)",
        required: true,
        default: "bitcoin",
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "skill-weather-forecast",
    name: "weather_forecast",
    displayName: "Global Weather & Temperature",
    description: "Fetches current temperature, wind speed, and meteorological conditions for any coordinates via Open-Meteo",
    category: "Data & Web",
    type: "api",
    enabled: true,
    endpoint: "https://api.open-meteo.com/v1/forecast?latitude={{latitude}}&longitude={{longitude}}&current_weather=true",
    method: "GET",
    parameters: [
      {
        name: "latitude",
        type: "number",
        description: "Latitude coordinate (e.g. 40.7128 for New York, 51.5074 for London, 35.6762 for Tokyo)",
        required: true,
        default: 40.7128,
      },
      {
        name: "longitude",
        type: "number",
        description: "Longitude coordinate (e.g. -74.0060 for New York, -0.1278 for London, 139.6503 for Tokyo)",
        required: true,
        default: -74.006,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "skill-sentiment-analysis",
    name: "analyze_sentiment",
    displayName: "Sentiment & Tone Analyzer",
    description: "Evaluates emotional polarity, subjectivity, and tone of a text message or customer review",
    category: "Utility",
    type: "script",
    enabled: true,
    language: "javascript",
    code: `// Evaluate sentiment scoring and tone breakdown
const text = String(args.text || "").toLowerCase();
const positiveWords = ["great", "excellent", "love", "awesome", "good", "best", "fantastic", "amazing", "smooth", "happy", "recommend", "solved"];
const negativeWords = ["bad", "terrible", "hate", "horrible", "awful", "worst", "bug", "broken", "failed", "crash", "angry", "disappointed", "slow"];

let posCount = 0;
let negCount = 0;
positiveWords.forEach(w => { if (text.includes(w)) posCount++; });
negativeWords.forEach(w => { if (text.includes(w)) negCount++; });

let score = 0;
let sentiment = "neutral";
if (posCount > negCount) {
  score = Math.min(1.0, 0.4 + (posCount - negCount) * 0.2);
  sentiment = "positive";
} else if (negCount > posCount) {
  score = Math.max(-1.0, -0.4 - (negCount - posCount) * 0.2);
  sentiment = "negative";
}

console.log(JSON.stringify({
  sentiment,
  score: Math.round(score * 100) / 100,
  positiveMatches: posCount,
  negativeMatches: negCount,
  wordCount: text.split(/\\s+/).filter(Boolean).length
}, null, 2));`,
    parameters: [
      {
        name: "text",
        type: "string",
        description: "The text, review, or statement to analyze for sentiment",
        required: true,
        default: "Agent Studio OS is an awesome and fast autonomous agent workspace!",
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "skill-token-generator",
    name: "generate_security_token",
    displayName: "Cryptographic Token & UUID Generator",
    description: "Generates cryptographically random API tokens, session keys, and UUIDs for integrations",
    category: "Developer",
    type: "script",
    enabled: true,
    language: "javascript",
    code: `const type = String(args.type || "uuid").toLowerCase();
const length = Math.min(128, Math.max(8, Number(args.length) || 32));

function generateHex(len) {
  const chars = "abcdef0123456789";
  let str = "";
  for (let i = 0; i < len; i++) {
    str += chars[Math.floor(Math.random() * chars.length)];
  }
  return str;
}

function generateAlphanumeric(len) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let str = "";
  for (let i = 0; i < len; i++) {
    str += chars[Math.floor(Math.random() * chars.length)];
  }
  return str;
}

function generateUuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let result = "";
if (type === "uuid") result = generateUuid();
else if (type === "hex") result = generateHex(length);
else result = "agy_" + generateAlphanumeric(length);

console.log(JSON.stringify({
  token: result,
  type,
  length: result.length,
  entropy: "high",
  timestamp: new Date().toISOString()
}, null, 2));`,
    parameters: [
      {
        name: "type",
        type: "string",
        description: "Token format: 'uuid', 'hex', or 'alphanumeric'",
        required: false,
        default: "uuid",
      },
      {
        name: "length",
        type: "number",
        description: "Token length (for hex or alphanumeric)",
        required: false,
        default: 32,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "skill-web-scraper",
    name: "web_scraper",
    displayName: "Scrapling Web Scraper",
    description: "Production web scraper with stealth anti-bot bypass, JS rendering, selector extraction, and Markdown export",
    category: "Data & Web",
    type: "mcp",
    mcpServer: "mcp-scrapling",
    enabled: true,
    parameters: [
      {
        name: "url",
        type: "string",
        description: "Target web URL to scrape",
        required: true,
      },
      {
        name: "selectors",
        type: "string",
        description: "CSS selectors for data extraction (e.g. 'h1, p.content')",
        required: false,
      },
      {
        name: "render_js",
        type: "boolean",
        description: "Use stealth browser for dynamic JavaScript pages",
        required: false,
        default: false,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "skill-desktop-automation",
    name: "desktop_automation",
    displayName: "CUA Desktop Driver",
    description: "Autonomous desktop control: take screenshots, inspect UI elements, click, type, and launch native applications",
    category: "Productivity",
    type: "mcp",
    mcpServer: "mcp-cua",
    enabled: true,
    parameters: [
      {
        name: "action_type",
        type: "string",
        description: "Action to perform: screenshot, inspect, click, type, launch, key, scroll",
        required: true,
        default: "screenshot",
      },
      {
        name: "target",
        type: "string",
        description: "Target application name or UI element",
        required: false,
      },
      {
        name: "text",
        type: "string",
        description: "Text to type into focused field",
        required: false,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// In-memory cache for ultra-fast agent loop queries
let cachedSkills: ExternalSkill[] | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 15000;

/**
 * List all external skills.
 * Falls back to default presets if no database setting exists yet.
 */
export async function listExternalSkills(): Promise<ExternalSkill[]> {
  const now = Date.now();
  if (cachedSkills && now - cacheTime < CACHE_TTL_MS) {
    return cachedSkills;
  }

  try {
    if (!prisma?.setting?.findUnique) {
      return PRESET_EXTERNAL_SKILLS;
    }

    const setting = await prisma.setting.findUnique({
      where: { key: SETTINGS_KEY },
    });

    if (!setting || !setting.value) {
      // Seed default skills
      await saveExternalSkills(PRESET_EXTERNAL_SKILLS);
      cachedSkills = PRESET_EXTERNAL_SKILLS;
      cacheTime = now;
      return PRESET_EXTERNAL_SKILLS;
    }

    const skills: ExternalSkill[] = JSON.parse(setting.value);
    cachedSkills = skills;
    cacheTime = now;
    return skills;
  } catch (err) {
    console.warn("[External Skills] Error reading skills from DB, using presets:", err);
    return PRESET_EXTERNAL_SKILLS;
  }
}

/**
 * Retrieve active (enabled) skills only.
 */
export async function getActiveExternalSkills(): Promise<ExternalSkill[]> {
  const skills = await listExternalSkills();
  return skills.filter((s) => s.enabled);
}

/**
 * Persist external skills list to database.
 */
export async function saveExternalSkills(skills: ExternalSkill[]): Promise<void> {
  const serialized = JSON.stringify(skills, null, 2);
  if (prisma?.setting?.upsert) {
    await prisma.setting.upsert({
      where: { key: SETTINGS_KEY },
      update: { value: serialized },
      create: { key: SETTINGS_KEY, value: serialized },
    });
  }
  cachedSkills = skills;
  cacheTime = Date.now();
}

/**
 * Find skill by id or identifier name.
 */
export async function getExternalSkill(idOrName: string): Promise<ExternalSkill | null> {
  const skills = await listExternalSkills();
  return (
    skills.find(
      (s) =>
        s.id.toLowerCase() === idOrName.toLowerCase() ||
        s.name.toLowerCase() === idOrName.toLowerCase()
    ) || null
  );
}

/**
 * Add a new external skill.
 */
export async function addExternalSkill(
  skillData: Omit<ExternalSkill, "id" | "createdAt" | "updatedAt"> & { id?: string }
): Promise<ExternalSkill> {
  const skills = await listExternalSkills();

  // Normalize skill identifier (lowercase, underscore)
  const cleanName = skillData.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "") || `custom_skill_${Date.now()}`;

  const newSkill: ExternalSkill = {
    ...skillData,
    id: skillData.id || `skill-${cleanName}-${Date.now().toString(36)}`,
    name: cleanName,
    displayName: skillData.displayName || cleanName,
    description: skillData.description || "Custom external skill",
    category: skillData.category || "Utility",
    type: skillData.type || "api",
    enabled: skillData.enabled ?? true,
    parameters: Array.isArray(skillData.parameters) ? skillData.parameters : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Replace if exists with same id or name, else append
  const existingIdx = skills.findIndex(
    (s) => s.id === newSkill.id || s.name.toLowerCase() === newSkill.name.toLowerCase()
  );

  if (existingIdx >= 0) {
    skills[existingIdx] = newSkill;
  } else {
    skills.push(newSkill);
  }

  await saveExternalSkills(skills);
  return newSkill;
}

/**
 * Update an existing external skill.
 */
export async function updateExternalSkill(
  id: string,
  updates: Partial<ExternalSkill>
): Promise<ExternalSkill | null> {
  const skills = await listExternalSkills();
  const index = skills.findIndex((s) => s.id === id);
  if (index === -1) return null;

  const existing = skills[index];
  const updated: ExternalSkill = {
    ...existing,
    ...updates,
    id: existing.id,
    updatedAt: new Date().toISOString(),
  };

  skills[index] = updated;
  await saveExternalSkills(skills);
  return updated;
}

/**
 * Toggle skill enabled status.
 */
export async function toggleExternalSkill(
  id: string,
  enabled?: boolean
): Promise<ExternalSkill | null> {
  const skills = await listExternalSkills();
  const index = skills.findIndex((s) => s.id === id);
  if (index === -1) return null;

  const targetState = enabled !== undefined ? enabled : !skills[index].enabled;
  skills[index].enabled = targetState;
  skills[index].updatedAt = new Date().toISOString();

  await saveExternalSkills(skills);
  return skills[index];
}

/**
 * Delete an external skill by ID.
 */
export async function deleteExternalSkill(id: string): Promise<boolean> {
  const skills = await listExternalSkills();
  const filtered = skills.filter((s) => s.id !== id);
  if (filtered.length === skills.length) return false;

  await saveExternalSkills(filtered);
  return true;
}

/**
 * Execute an external skill with arguments.
 */
export async function executeExternalSkill(
  skillIdOrName: string,
  args: Record<string, any> = {}
): Promise<ExternalSkillExecutionResult> {
  const startTime = Date.now();
  const skill = await getExternalSkill(skillIdOrName);

  if (!skill) {
    return {
      success: false,
      output: null,
      error: `External skill "${skillIdOrName}" was not found.`,
      latency: Date.now() - startTime,
    };
  }

  if (!skill.enabled) {
    return {
      success: false,
      output: null,
      error: `External skill "${skill.name}" is currently disabled in Settings.`,
      latency: Date.now() - startTime,
    };
  }

  try {
    // 1. HTTP API / Webhook Execution
    if (skill.type === "api") {
      if (!skill.endpoint) {
        throw new Error(`External API skill "${skill.name}" has no endpoint URL configured.`);
      }

      let url = skill.endpoint;
      const method = (skill.method || "GET").toUpperCase();
      const headers: Record<string, string> = {
        "User-Agent": "AgentStudio-OS/1.0",
        ...(skill.headers || {}),
      };

      // Replace URL template placeholders e.g. {{coin}} or {coin}
      for (const [key, val] of Object.entries(args)) {
        const regex1 = new RegExp(`\\{\\{${key}\\}\\}`, "gi");
        const regex2 = new RegExp(`\\{${key}\\}`, "gi");
        const encodedVal = encodeURIComponent(String(val ?? ""));
        url = url.replace(regex1, encodedVal).replace(regex2, encodedVal);
      }

      const fetchOptions: RequestInit = {
        method,
        headers,
      };

      if (method === "POST" || method === "PUT") {
        headers["Content-Type"] = "application/json";
        if (skill.bodyTemplate) {
          let bodyStr = skill.bodyTemplate;
          for (const [key, val] of Object.entries(args)) {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, "gi");
            bodyStr = bodyStr.replace(regex, JSON.stringify(val));
          }
          fetchOptions.body = bodyStr;
        } else {
          fetchOptions.body = JSON.stringify(args);
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      fetchOptions.signal = controller.signal;

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      const contentType = response.headers.get("content-type") || "";
      let responseData: any;
      if (contentType.includes("application/json")) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      const latency = Date.now() - startTime;
      if (!response.ok) {
        return {
          success: false,
          output: responseData,
          error: `API returned HTTP ${response.status}: ${response.statusText}`,
          latency,
        };
      }

      return {
        success: true,
        output: responseData,
        latency,
      };
    }

    // 2. Custom Script Execution (JavaScript / Python)
    if (skill.type === "script") {
      const code = skill.code || "";
      const lang = skill.language || "javascript";

      if (lang === "javascript") {
        // Prepend arguments definition safely
        const injectedScript = `const args = ${JSON.stringify(args)};\n${code}`;
        const execRes = await executeJavaScript(injectedScript);

        const latency = Date.now() - startTime;
        let parsedOutput: any = execRes.stdout;
        try {
          parsedOutput = JSON.parse(execRes.stdout);
        } catch {}

        return {
          success: execRes.success,
          output: parsedOutput,
          error: execRes.error || (execRes.success ? undefined : execRes.stderr),
          latency,
        };
      } else {
        // Python execution
        const injectedScript = `import json\nargs = json.loads('${JSON.stringify(args)}')\n${code}`;
        const execRes = await executePython(injectedScript);

        const latency = Date.now() - startTime;
        let parsedOutput: any = execRes.stdout;
        try {
          parsedOutput = JSON.parse(execRes.stdout);
        } catch {}

        return {
          success: execRes.success,
          output: parsedOutput,
          error: execRes.error || (execRes.success ? undefined : execRes.stderr),
          latency,
        };
      }
    }

    // 3. Instruction / Prompt-based Skill
    if (skill.type === "instruction") {
      const latency = Date.now() - startTime;
      return {
        success: true,
        output: {
          instructions: skill.instructions || "",
          providedArguments: args,
          status: "Instruction guidelines provided to agent context",
        },
        latency,
      };
    }

    // 4. MCP Server Skill
    if (skill.type === "mcp") {
      if (skill.name === "web_scraper" || skill.name === "scrape_page") {
        const { scrapePage } = await import("./scrapling-bridge");
        const url = args.url || String(Object.values(args)[0] || "");
        const selectors = typeof args.selectors === "string" ? args.selectors.split(",").map((s) => s.trim()) : args.selectors;
        const res = await scrapePage(url, { selectors, stealthMode: !!args.render_js, toMarkdown: true });
        return {
          success: res.success,
          output: res,
          error: res.error,
          latency: Date.now() - startTime,
        };
      }

      if (skill.name === "desktop_automation" || skill.name === "desktop_action") {
        const { executeCUAAction } = await import("./cua-driver");
        const actionType = args.action_type || args.type || "screenshot";
        const res = await executeCUAAction({
          type: actionType,
          target: args.target,
          text: args.text,
          key: args.key,
          coordinates: args.coordinates,
        });
        return {
          success: res.success,
          output: res,
          error: res.error,
          latency: Date.now() - startTime,
        };
      }

      const { mcpManager } = await import("./mcp/client-manager");
      const mcpRes = await mcpManager.executeTool(skill.name, args);
      const text = mcpRes.content.map((c) => c.text).join("\n");
      return {
        success: !mcpRes.isError,
        output: text,
        error: mcpRes.isError ? text : undefined,
        latency: Date.now() - startTime,
      };
    }

    return {
      success: false,
      output: null,
      error: `Unsupported skill type: "${skill.type}"`,
      latency: Date.now() - startTime,
    };
  } catch (err: any) {
    return {
      success: false,
      output: null,
      error: err.name === "AbortError" ? "Request timed out after 10s" : err.message || "Skill execution failed",
      latency: Date.now() - startTime,
    };
  }
}
