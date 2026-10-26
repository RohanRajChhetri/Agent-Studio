/**
 * Model Context Protocol (MCP) Types & Configuration
 * Provides standard interfaces for external tools, resources, and server transports.
 */

export type MCPTransportType = "stdio" | "sse" | "websocket";

export interface MCPServerConfig {
  id: string;
  name: string;
  description?: string;
  transport: MCPTransportType;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  enabled: boolean;
  status?: "connected" | "disconnected" | "error";
  lastError?: string;
}

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  serverId: string;
}

export interface MCPResourceDefinition {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  serverId: string;
}

export interface MCPExecutionResult {
  content: Array<{
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}
