import type {
  MCPServerConfig,
  MCPToolDefinition,
  MCPResourceDefinition,
  MCPExecutionResult,
} from "@/types/mcp";

/**
 * MCP Client Manager
 * Manages connections, tool discovery, and execution across MCP servers.
 */
class MCPManager {
  private servers: Map<string, MCPServerConfig> = new Map();
  private tools: Map<string, MCPToolDefinition> = new Map();

  constructor() {
    this.initDefaultPresets();
  }

  private initDefaultPresets() {
    // Default recommended MCP servers that can be enabled by the user
    const presets: MCPServerConfig[] = [
      {
        id: "mcp-filesystem",
        name: "Local Filesystem",
        description: "Read, write, and explore files in the workspace with safety bounds",
        transport: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", "./"],
        enabled: false,
        status: "disconnected",
      },
      {
        id: "mcp-github",
        name: "GitHub API",
        description: "Interact with repositories, pull requests, issues, and branches",
        transport: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-github"],
        env: { GITHUB_PERSONAL_ACCESS_TOKEN: "" },
        enabled: false,
        status: "disconnected",
      },
      {
        id: "mcp-postgres",
        name: "PostgreSQL Database",
        description: "Inspect schema, run read-only queries, and monitor tables",
        transport: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-postgres"],
        env: { DATABASE_URL: "" },
        enabled: false,
        status: "disconnected",
      },
    ];

    for (const p of presets) {
      this.servers.set(p.id, p);
    }
  }

  public listServers(): MCPServerConfig[] {
    return Array.from(this.servers.values());
  }

  public getServer(id: string): MCPServerConfig | undefined {
    return this.servers.get(id);
  }

  public registerServer(config: MCPServerConfig): void {
    this.servers.set(config.id, config);
  }

  public removeServer(id: string): boolean {
    return this.servers.delete(id);
  }

  public listTools(): MCPToolDefinition[] {
    return Array.from(this.tools.values());
  }

  public async executeTool(
    toolName: string,
    args: Record<string, any>
  ): Promise<MCPExecutionResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        content: [{ type: "text", text: `MCP Tool "${toolName}" not found.` }],
        isError: true,
      };
    }

    // In a live stdio/SSE environment, this invokes the active client session
    return {
      content: [
        {
          type: "text",
          text: `[MCP: ${toolName}] Simulated tool execution with arguments: ${JSON.stringify(args)}`,
        },
      ],
      isError: false,
    };
  }
}

export const mcpManager = new MCPManager();
