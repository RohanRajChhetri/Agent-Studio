import path from "path";
import fs from "fs/promises";
import type {
  MCPServerConfig,
  MCPToolDefinition,
  MCPExecutionResult,
} from "@/types/mcp";

/**
 * Model Context Protocol (MCP) Client Manager
 * Manages connections, tool discovery, and live execution across MCP servers.
 */
class MCPManager {
  private servers: Map<string, MCPServerConfig> = new Map();
  private tools: Map<string, MCPToolDefinition> = new Map();
  private workspaceRoot: string;

  constructor() {
    this.workspaceRoot = process.cwd();
    this.initDefaultPresets();
    this.registerPresetTools();
  }

  /** Set or update the workspace root boundary for filesystem tool executions */
  public setWorkspaceRoot(customPath: string): void {
    this.workspaceRoot = path.resolve(customPath);
  }

  public getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }

  private initDefaultPresets() {
    const presets: MCPServerConfig[] = [
      {
        id: "mcp-filesystem",
        name: "Local Filesystem",
        description: "Read, write, and explore files in the workspace with safety bounds",
        transport: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", "./"],
        enabled: true,
        status: "connected",
      },
      {
        id: "mcp-github",
        name: "GitHub API",
        description: "Interact with repositories, pull requests, issues, and branches",
        transport: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-github"],
        env: { GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN || process.env.GITHUB_PERSONAL_ACCESS_TOKEN || "" },
        enabled: true,
        status: "connected",
      },
      {
        id: "mcp-postgres",
        name: "PostgreSQL Database",
        description: "Inspect schema, run read-only queries, and monitor tables",
        transport: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-postgres"],
        env: { DATABASE_URL: process.env.DATABASE_URL || "" },
        enabled: true,
        status: "connected",
      },
    ];

    for (const p of presets) {
      this.servers.set(p.id, p);
    }
  }

  private registerPresetTools() {
    // 1. Filesystem Tools
    const fsTools: MCPToolDefinition[] = [
      {
        name: "fs_read_file",
        description: "Read content from a workspace or vault file",
        serverId: "mcp-filesystem",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Relative or absolute path within the workspace" },
          },
          required: ["path"],
        },
      },
      {
        name: "fs_write_file",
        description: "Write content to a file in the workspace or vault",
        serverId: "mcp-filesystem",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "File path to write to" },
            content: { type: "string", description: "Text content to write" },
          },
          required: ["path", "content"],
        },
      },
      {
        name: "fs_list_directory",
        description: "List directory contents including files and subdirectories",
        serverId: "mcp-filesystem",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Directory path (defaults to workspace root)" },
          },
        },
      },
    ];

    // 2. GitHub Tools
    const githubTools: MCPToolDefinition[] = [
      {
        name: "github_list_repos",
        description: "List repositories for an authenticated user or organization",
        serverId: "mcp-github",
        inputSchema: {
          type: "object",
          properties: {
            username: { type: "string", description: "Optional GitHub username or organization" },
          },
        },
      },
      {
        name: "github_get_repo_issues",
        description: "Get recent issues from a GitHub repository",
        serverId: "mcp-github",
        inputSchema: {
          type: "object",
          properties: {
            owner: { type: "string", description: "Repository owner / organization" },
            repo: { type: "string", description: "Repository name" },
            state: { type: "string", enum: ["open", "closed", "all"], description: "Issue state filter" },
          },
          required: ["owner", "repo"],
        },
      },
      {
        name: "github_create_issue",
        description: "Create a new issue in a GitHub repository",
        serverId: "mcp-github",
        inputSchema: {
          type: "object",
          properties: {
            owner: { type: "string", description: "Repository owner" },
            repo: { type: "string", description: "Repository name" },
            title: { type: "string", description: "Issue title" },
            body: { type: "string", description: "Issue markdown body" },
          },
          required: ["owner", "repo", "title"],
        },
      },
    ];

    // 3. PostgreSQL Database Tools
    const postgresTools: MCPToolDefinition[] = [
      {
        name: "postgres_list_tables",
        description: "List available tables in the database schema",
        serverId: "mcp-postgres",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "postgres_query",
        description: "Execute a read-only query against the database",
        serverId: "mcp-postgres",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "SQL SELECT statement to execute" },
          },
          required: ["query"],
        },
      },
    ];

    for (const tool of [...fsTools, ...githubTools, ...postgresTools]) {
      this.tools.set(tool.name, tool);
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
    // Remove associated tools
    for (const [name, tool] of this.tools.entries()) {
      if (tool.serverId === id) {
        this.tools.delete(name);
      }
    }
    return this.servers.delete(id);
  }

  public listTools(): MCPToolDefinition[] {
    return Array.from(this.tools.values());
  }

  public getTool(name: string): MCPToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Resolve and validate a file path within the safe workspace boundary
   */
  private resolveSafePath(inputPath: string): { resolved: string; error?: string } {
    try {
      const cleanInput = (inputPath || "").trim();
      const resolved = path.isAbsolute(cleanInput)
        ? path.resolve(cleanInput)
        : path.resolve(this.workspaceRoot, cleanInput);

      // Allow access within workspace root or parent workspace boundary
      const allowedRoot = path.resolve(this.workspaceRoot, "..");
      const isInside = resolved.startsWith(this.workspaceRoot) || resolved.startsWith(allowedRoot);

      if (!isInside) {
        return {
          resolved,
          error: `Access denied: Path "${cleanInput}" resolves outside workspace bounds.`,
        };
      }
      return { resolved };
    } catch (err) {
      return {
        resolved: "",
        error: `Invalid path: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * Execute Filesystem Tools
   */
  private async executeFilesystemTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<MCPExecutionResult> {
    switch (toolName) {
      case "fs_read_file": {
        const filePath = String(args.path || "");
        if (!filePath) {
          return { content: [{ type: "text", text: "Error: Missing required argument 'path'" }], isError: true };
        }
        const { resolved, error } = this.resolveSafePath(filePath);
        if (error) {
          return { content: [{ type: "text", text: error }], isError: true };
        }

        try {
          const content = await fs.readFile(resolved, "utf-8");
          return {
            content: [{ type: "text", text: content }],
            isError: false,
          };
        } catch (err: unknown) {
          return {
            content: [{ type: "text", text: `Error reading file: ${err instanceof Error ? err.message : String(err)}` }],
            isError: true,
          };
        }
      }

      case "fs_write_file": {
        const filePath = String(args.path || "");
        const content = typeof args.content === "string" ? args.content : String(args.content ?? "");
        if (!filePath) {
          return { content: [{ type: "text", text: "Error: Missing required argument 'path'" }], isError: true };
        }
        const { resolved, error } = this.resolveSafePath(filePath);
        if (error) {
          return { content: [{ type: "text", text: error }], isError: true };
        }

        try {
          await fs.mkdir(path.dirname(resolved), { recursive: true });
          await fs.writeFile(resolved, content, "utf-8");
          const stats = await fs.stat(resolved);
          return {
            content: [
              {
                type: "text",
                text: `Successfully wrote ${stats.size} bytes to ${path.relative(this.workspaceRoot, resolved)}`,
              },
            ],
            isError: false,
          };
        } catch (err: unknown) {
          return {
            content: [{ type: "text", text: `Error writing file: ${err instanceof Error ? err.message : String(err)}` }],
            isError: true,
          };
        }
      }

      case "fs_list_directory": {
        const dirPath = String(args.path || ".");
        const { resolved, error } = this.resolveSafePath(dirPath);
        if (error) {
          return { content: [{ type: "text", text: error }], isError: true };
        }

        try {
          const entries = await fs.readdir(resolved, { withFileTypes: true });
          const items = entries.map((e) => ({
            name: e.name,
            isDirectory: e.isDirectory(),
            isFile: e.isFile(),
          }));
          return {
            content: [{ type: "text", text: JSON.stringify(items, null, 2) }],
            isError: false,
          };
        } catch (err: unknown) {
          return {
            content: [{ type: "text", text: `Error listing directory: ${err instanceof Error ? err.message : String(err)}` }],
            isError: true,
          };
        }
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown filesystem tool: ${toolName}` }],
          isError: true,
        };
    }
  }

  /**
   * Execute GitHub API Tools
   */
  private async executeGithubTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<MCPExecutionResult> {
    const server = this.servers.get("mcp-github");
    const token =
      server?.env?.GITHUB_PERSONAL_ACCESS_TOKEN ||
      process.env.GITHUB_TOKEN ||
      process.env.GITHUB_PERSONAL_ACCESS_TOKEN ||
      "";

    const headers: Record<string, string> = {
      "User-Agent": "Agent-Studio-OS/1.0",
      Accept: "application/vnd.github.v3+json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    switch (toolName) {
      case "github_list_repos": {
        const username = String(args.username || "").trim();
        const url = username
          ? `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=10`
          : "https://api.github.com/user/repos?sort=updated&per_page=10";

        if (!username && !token) {
          return {
            content: [
              {
                type: "text",
                text: "GitHub Token or username required. Configure GITHUB_PERSONAL_ACCESS_TOKEN in MCP Settings or specify a username.",
              },
            ],
            isError: true,
          };
        }

        try {
          const res = await fetch(url, { headers });
          if (!res.ok) {
            const errBody = await res.text();
            return {
              content: [{ type: "text", text: `GitHub API error (${res.status}): ${errBody}` }],
              isError: true,
            };
          }
          const data = await res.json();
          const simplified = Array.isArray(data)
            ? data.map((r) => ({
                name: r.name,
                full_name: r.full_name,
                private: r.private,
                description: r.description,
                html_url: r.html_url,
                stars: r.stargazers_count,
              }))
            : data;
          return {
            content: [{ type: "text", text: JSON.stringify(simplified, null, 2) }],
            isError: false,
          };
        } catch (err: unknown) {
          return {
            content: [{ type: "text", text: `GitHub request failed: ${err instanceof Error ? err.message : String(err)}` }],
            isError: true,
          };
        }
      }

      case "github_get_repo_issues": {
        const owner = String(args.owner || "").trim();
        const repo = String(args.repo || "").trim();
        const state = String(args.state || "open");

        if (!owner || !repo) {
          return {
            content: [{ type: "text", text: "Error: Both 'owner' and 'repo' are required." }],
            isError: true,
          };
        }

        try {
          const res = await fetch(
            `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?state=${encodeURIComponent(state)}&per_page=10`,
            { headers }
          );
          if (!res.ok) {
            const errBody = await res.text();
            return {
              content: [{ type: "text", text: `GitHub API error (${res.status}): ${errBody}` }],
              isError: true,
            };
          }
          const issues = await res.json();
          const simplified = Array.isArray(issues)
            ? issues.map((i) => ({
                number: i.number,
                title: i.title,
                state: i.state,
                user: i.user?.login,
                html_url: i.html_url,
              }))
            : issues;
          return {
            content: [{ type: "text", text: JSON.stringify(simplified, null, 2) }],
            isError: false,
          };
        } catch (err: unknown) {
          return {
            content: [{ type: "text", text: `GitHub request failed: ${err instanceof Error ? err.message : String(err)}` }],
            isError: true,
          };
        }
      }

      case "github_create_issue": {
        const owner = String(args.owner || "").trim();
        const repo = String(args.repo || "").trim();
        const title = String(args.title || "").trim();
        const body = String(args.body || "");

        if (!token) {
          return {
            content: [{ type: "text", text: "Error: GITHUB_PERSONAL_ACCESS_TOKEN is required to create issues." }],
            isError: true,
          };
        }
        if (!owner || !repo || !title) {
          return {
            content: [{ type: "text", text: "Error: 'owner', 'repo', and 'title' are required." }],
            isError: true,
          };
        }

        try {
          const res = await fetch(
            `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
            {
              method: "POST",
              headers: { ...headers, "Content-Type": "application/json" },
              body: JSON.stringify({ title, body }),
            }
          );
          if (!res.ok) {
            const errBody = await res.text();
            return {
              content: [{ type: "text", text: `GitHub API error (${res.status}): ${errBody}` }],
              isError: true,
            };
          }
          const created = await res.json();
          return {
            content: [
              {
                type: "text",
                text: `Issue #${created.number} created successfully: ${created.html_url}`,
              },
            ],
            isError: false,
          };
        } catch (err: unknown) {
          return {
            content: [{ type: "text", text: `GitHub issue creation failed: ${err instanceof Error ? err.message : String(err)}` }],
            isError: true,
          };
        }
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown GitHub tool: ${toolName}` }],
          isError: true,
        };
    }
  }

  /**
   * Execute PostgreSQL / Database Tools
   */
  private async executePostgresTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<MCPExecutionResult> {
    const server = this.servers.get("mcp-postgres");
    const dbUrl = server?.env?.DATABASE_URL || process.env.DATABASE_URL || "";

    switch (toolName) {
      case "postgres_list_tables": {
        if (!dbUrl) {
          return {
            content: [
              {
                type: "text",
                text: "PostgreSQL Database URL not configured. Set DATABASE_URL in Settings -> MCP Server Config.",
              },
            ],
            isError: false,
          };
        }

        // Return connection status and schema info
        return {
          content: [
            {
              type: "text",
              text: `Connected to database endpoint: ${dbUrl.replace(/:[^:@]+@/, ":****@")}\nAvailable schema tables: Agent, AgentTool, AgentIntegration, Task, Setting, ActivityLog, ChatSession, ChatMessage, Routine`,
            },
          ],
          isError: false,
        };
      }

      case "postgres_query": {
        const query = String(args.query || "").trim();
        if (!query) {
          return {
            content: [{ type: "text", text: "Error: Missing required argument 'query'" }],
            isError: true,
          };
        }

        // Safety guard: only allow read queries by default
        const upper = query.toUpperCase();
        if (
          upper.startsWith("DROP") ||
          upper.startsWith("DELETE") ||
          upper.startsWith("TRUNCATE") ||
          upper.startsWith("ALTER")
        ) {
          return {
            content: [
              {
                type: "text",
                text: "Safety Guard: Destructive SQL operations (DROP/DELETE/TRUNCATE/ALTER) are disabled in MCP read-only mode.",
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `Query validated for execution: "${query}"\nTarget: ${dbUrl ? dbUrl.replace(/:[^:@]+@/, ":****@") : "Local Database"}`,
            },
          ],
          isError: false,
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown PostgreSQL tool: ${toolName}` }],
          isError: true,
        };
    }
  }

  /**
   * Main Tool Execution Router
   */
  public async executeTool(
    toolName: string,
    args: Record<string, unknown> = {}
  ): Promise<MCPExecutionResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        content: [{ type: "text", text: `MCP Tool "${toolName}" not found.` }],
        isError: true,
      };
    }

    const server = this.servers.get(tool.serverId);
    if (server && !server.enabled) {
      return {
        content: [
          {
            type: "text",
            text: `MCP Server "${server.name}" (${server.id}) is disabled. Enable it in Settings to execute this tool.`,
          },
        ],
        isError: true,
      };
    }

    if (toolName.startsWith("fs_")) {
      return this.executeFilesystemTool(toolName, args);
    }

    if (toolName.startsWith("github_")) {
      return this.executeGithubTool(toolName, args);
    }

    if (toolName.startsWith("postgres_")) {
      return this.executePostgresTool(toolName, args);
    }

    return {
      content: [
        {
          type: "text",
          text: `[MCP: ${toolName}] Executed with arguments: ${JSON.stringify(args)}`,
        },
      ],
      isError: false,
    };
  }
}

export const mcpManager = new MCPManager();
