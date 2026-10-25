export interface ExternalSkillParameter {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  description: string;
  required?: boolean;
  default?: any;
}

export interface ExternalSkill {
  id: string;
  name: string; // Identifier used by LLM e.g. "crypto_price", "weather_info"
  displayName: string;
  description: string;
  category: "Finance" | "Data & Web" | "Productivity" | "Developer" | "Communication" | "Utility";
  type: "api" | "script" | "instruction" | "mcp";
  enabled: boolean;
  // For MCP type
  mcpServer?: string;
  // For API type
  endpoint?: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  bodyTemplate?: string;
  // For Script type
  language?: "javascript" | "python";
  code?: string;
  // For Instruction type
  instructions?: string;
  // Parameters
  parameters: ExternalSkillParameter[];
  createdAt: string;
  updatedAt: string;
}

export interface ExternalSkillExecutionResult {
  success: boolean;
  output: any;
  error?: string;
  latency: number;
}
