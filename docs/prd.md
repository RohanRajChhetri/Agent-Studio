# Product Requirements Document (PRD)

## 🎯 Executive Overview & Vision

**Agent Studio OS** is a production-grade autonomous AI operating system designed to build, deploy, manage, and scale autonomous AI agent teams. It unifies intelligent local and cloud model routing, hierarchical agent fleets, autonomous visual workflow pipelines, a live web-based Code Studio IDE, multi-agent conference roundtable rooms, real-time Gemini Live multimodal voice streaming, omnichannel messaging (WhatsApp, Telegram, Slack), and an Obsidian-synced 3D Knowledge Galaxy graph into a unified, self-hosted command cockpit.

The platform eliminates the fragmentation of managing disconnected AI tools, scripts, and model subscriptions by providing a coherent operating system where agents collaborate, self-heal, retain persistent memory, and execute complex knowledge and engineering workflows with 100% data sovereignty.

---

## 👥 Target Audience & Personas

1. **AI Engineers & Developers**: Professionals building multi-agent systems who require deep orchestration, Model Context Protocol (MCP) tool integration, live code sandboxes, and Hermes CLI profile management.
2. **Technical Solopreneurs & Founders**: Builders seeking a 24/7 digital workforce to automate full-stack software development, competitive research, and daily operations.
3. **Product Managers & Team Leads**: Leaders orchestrating multi-faceted projects through visual DAG workflows, autonomous Kanban task pipelines, and automated sprint reviews.
4. **Market Researchers & Analysts**: Knowledge workers conducting continuous competitive intelligence, web scraping, document synthesis, and automated briefing generation.
5. **DevOps & Infrastructure Engineers**: Specialists automating routine maintenance, security audits, log diagnostics, and external webhook integrations.

---

## 🚀 Core Product Capabilities & Functional Requirements

### 1. 🧠 Multi-Provider AI Routing & Resilience Gateway
- **Primary Brain Routing**: Prioritize local Omniroute router (`http://127.0.0.1:20128`) with combo strategies (`auto/best-coding`, `auto/smart`, `auto/fast`, `auto/best-chat`).
- **Cascading Multi-Provider Fallbacks**: Zero-downtime automatic failover across:
  - Google Gemini (Gemini 2.5 Flash, 2.0 Flash, 1.5 Pro, Multimodal Live WebSockets)
  - Anthropic Claude (Claude 3.7 Sonnet, Claude 3.5 Sonnet, Claude 3.5 Haiku)
  - OpenAI (GPT-4o, GPT-4o Mini, o1, o3-mini)
  - Groq Cloud (Llama 3.3 70B, Llama 3.1 8B, DeepSeek R1 Distill)
  - DeepSeek (V3 and R1 reasoning architecture)
  - OpenRouter (300+ models with free-tier access)
  - Local Models (Ollama, LM Studio)
- **Provider Hub & Benchmark Suite (`/settings?tab=providers`)**:
  - Encrypted API key storage with in-memory resolution.
  - Live latency testing and connectivity health checks per provider and model.

### 2. 🤖 Autonomous Agent Fleet & Hierarchy Management (`/agents`)
- **4-Tier Organizational Hierarchy**: Structure agents into Orchestrators (strategy), Managers (coordination), Specialists (domain execution), and Workers (routines) with self-referential reporting chains (`reportsTo`).
- **Dual Visual Fleet Modes**: Toggle between an operational Grid Card view and an interactive Organizational Hierarchy Tree (`AgentHierarchyView`).
- **Agent Team Packs (`AgentPacksModal`)**: One-click deployment of pre-configured agent squads (Engineering Squad, Marketing Agency, Executive Staff).
- **Agent Pipeline Builder**: Drag-and-wire visual designer for chaining sequential and parallel agent workflows.
- **Hermes CLI Terminal Sandbox**: In-browser terminal emulator executing commands within isolated agent profile environments.

### 3. 🎙️ Gemini Live Multimodal Voice Cockpit
- **Real-Time Voice Streaming**: Native bidirectional audio streaming over WebSockets connecting to Google Gemini Multimodal Live API (`models/gemini-2.0-flash-exp`).
- **Audio Pipeline**: 16kHz PCM mono microphone capture and 24kHz PCM mono playback with echo cancellation and conversational interruption handling.
- **Voice Selection & Customization**: Multiple high-fidelity voice profiles (*Puck*, *Aoede*, *Charon*, *Fenrir*, *Kore*).
- **Interactive Voice Orb HUD (`gemini-live-orb.tsx`)**: Reactive visualizer with dynamic sound waves, volume metering, and global keyboard trigger (`Alt + V`).

### 4. 👥 Autonomous Agent Conference & Roundtable (`/conference`)
- **Multi-Agent Collaboration Space**: Live roundtable room where multiple agents debate, delegate, and synthesize solutions for complex missions.
- **A2A (Agent-to-Agent) Protocol**:
  - Hierarchical delegation from Orchestrator down to Managers and Specialists.
  - Real-time event stream tracking internal thoughts, speaking turns, delegations, and phase syntheses.
  - Agent Inspector Modal showing prompt context, model assignment, and token usage.
- **Auditory Readouts**: Integrated speech synthesis (TTS) reading out agent contributions in real time.
- **Direct Kanban Dispatching**: Convert conference consensus and action items directly into Kanban cards with a single click.

### 5. 🔀 Visual DAG Workflow Automation Canvas (`/workflows`)
- **Node-Based Visual Editor**: Interactive pan-and-zoom canvas for constructing Directed Acyclic Graphs.
- **Supported Node Types**: Agent Execution, Conditional Branching, Router, Human-in-the-Loop Approval Gate, Tool & MCP Execution, and Deliverable Output.
- **Topological Sorting & Safety**: Built-in cycle detection preventing infinite loops and automatic layout optimization (`autoLayoutDAG`).
- **Production Workflow Presets**: Pre-built templates for Full-Stack SaaS Builds, Market Intelligence Synthesis, and Autonomous Code Audits.

### 6. 💻 Autonomous Code Studio & Web IDE (`/code`)
- **Full-Featured In-Browser IDE**: File explorer, tabbed editor, syntax highlighting, search & replace, and workspace isolation (`/workspace`).
- **Multi-Viewport Responsive Sandbox Preview**: Live iframe preview toggling between Desktop (`1200px`), Tablet (`768px`), and Mobile (`375px`) with console log bridging.
- **Code Console Drawer**: Real-time console logs, stdout/stderr, and runtime execution metrics.
- **AI Code Assistant**: Natural language project generation, scaffolding, automated debugging, and code diff visualizer (`CodeDiffModal`).
- **ZIP Export**: 1-click download of the complete generated project workspace as a ZIP archive.

### 7. 📋 Autonomous Kanban Board (`/kanban`)
- **4-Column Drag-and-Drop Pipeline**: Backlog ➔ In Progress ➔ Review ➔ Done powered by `@dnd-kit`.
- **Advanced Task Drawer**:
  - *Autonomous Execution*: One-touch trigger activating assigned agents.
  - *Swarm Decomposition*: Spawns multi-agent parallel execution for large tickets.
  - *Self-Reflection Critique*: Agent self-evaluates deliverable quality before moving to Review.
  - *Subtask Checklists*: Breaks high-level tasks into granular checkable items.
  - *Human-in-the-Loop Validation*: Approve, Revise with critique feedback, or Reject with re-delegation.
  - *Vault Archiving*: Automatically saves approved deliverables to the Obsidian vault.

### 8. 🌌 Organizational Knowledge Infrastructure & 3D Galaxy (`/memory`)
- **Bi-Directional Obsidian Sync**: Native file-level integration with the local `./vault` markdown repository.
- **Interactive 3D Galaxy Graph (`ObsidianGraph`)**: Force-directed 3D physics network visualizing note relationships, cluster communities, and central God Nodes.
- **Dual-Pane Markdown Studio**: In-app editing with GitHub Flavored Markdown preview, wikilink auto-completion, and folder tree management.
- **Local RAG (Retrieval-Augmented Generation)**: Semantic search and embedding-based context injection across vault documents.

### 9. ⏰ Intelligent Routines & Cron Automation (`/routines`)
- **Timezone-Aware Scheduling**: Daily recurring cron schedules (e.g., `09:00 Daily Briefing`) and one-time future executions.
- **Autonomous Deliverable Generation**: Scheduled routines run in the background, assign work to agents, and compile finished reports into the vault.
- **Inbound Webhook Simulator**: Interactive payload tester for validating external HTTP webhook triggers.

### 10. 📱 Omnichannel Messaging & Hardware Integrations (`/settings?tab=devices`)
- **WhatsApp Personal**: Pair personal WhatsApp via QR code or pairing code to enable bi-directional chat with your agent fleet.
- **WhatsApp Cloud API & Telegram Bot**: Official webhook and bot integrations for mobile agent interaction.
- **Slack Workspace**: Slack app integration with slash commands and channel webhook dispatching.
- **Signal & Discord**: Multi-channel bridges for team communication platforms.

### 11. 🔌 Model Context Protocol (MCP) & Skills Ecosystem (`/settings?tab=mcp`)
- **MCP Client Manager**: Connects to external MCP servers via STDIO (subprocess) or SSE (HTTP) with automated tool discovery and injection into agent prompts.
- **External Skills Registry**: Discover, activate, and configure Hermes skills and custom skill modules per agent.

### 12. 🖥️ Computer-Using Agent (CUA) Desktop Automation
- **Autonomous Desktop Control**: Mouse clicking, text typing, window launching, and coordinate scrolling.
- **Automated Screenshot Capture**: Takes desktop screenshots, saves them to public downloads (`/downloads`), and embeds them directly in chat responses.
- **Compound Action Resolution**: Resolves complex commands like *"Open YouTube, search for AI agents, and capture screen"*.

### 13. 🕷️ Stealth Web Scraping & Crawling (Scrapling Bridge)
- **High-Performance Python Bridge**: Native integration with Scrapling, `curl_cffi`, and `lxml`.
- **Anti-Bot Bypass**: Bypasses Cloudflare and bot mitigations in stealth mode.
- **Deep Site Crawling**: Recursive domain crawling with CSS selector filtering and automated Markdown synthesis.

### 14. ⚡ Centralized Slash Commands
- 18 core slash commands across MVP, Core, Advanced, and Admin categories (`/new`, `/help`, `/status`, `/stop`, `/branch`, `/queue`, `/retry`, `/undo`, `/model`, `/agents`, `/plan`, `/compress`, `/review`, `/loop`, `/image`, `/code`, `/usage`, `/profile`).

---

## 🛡️ Non-Functional Requirements (NFRs)

1. **Complete Data Sovereignty**: All processing, databases, vault files, and credentials remain 100% self-hosted on user infrastructure.
2. **Zero-Downtime Resilience**: Multi-tier cascading fallback guarantees continuous execution even during cloud provider outages.
3. **Sub-Second UI Latency**: Dashboard interactions, command inputs, and navigation transitions execute in <100ms.
4. **Concurrency Hardening**: SQLite database operates with WAL mode, busy timeouts, and connection pooling to prevent write locks.
5. **Sandboxed File Operations**: Agent file execution is strictly sandboxed to project directories (`/workspace`, `/vault`, `/downloads`) with path traversal protections.
6. **Cross-Platform Compatibility**: Fully compatible with modern Chromium, Safari, and Firefox browsers, with responsive mobile PWA layout.

---

## 📈 Success Metrics

- **System Uptime & Fallback Success Rate**: >99.9% task completion rate across multi-provider cascades.
- **Task Automation Velocity**: 50–70% reduction in time required to complete research, coding, and reporting tasks.
- **Knowledge Vault Density**: Continuous growth in interlinked markdown notes and backlink density in the 3D Galaxy.
- **Model Efficiency & Cost**: Optimized token utilization and cost reduction via local Omniroute combo routing.