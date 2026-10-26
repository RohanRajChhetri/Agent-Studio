# Project Context & Decision Memory

## 📌 Current State

**Agent Studio OS** is an enterprise-grade autonomous AI agent operating system running in production on Next.js 16.3.5 (React 19.2.8, Tailwind CSS 4, Prisma 6.9.0 with SQLite).

### System Status Highlights
- **Primary Brain Routing**: Omniroute local router client with seamless cascading multi-provider fallbacks (Google Gemini, Anthropic Claude, OpenAI, Groq Cloud, DeepSeek, OpenRouter, and Ollama).
- **Fleet Hierarchy**: 4-tier organizational hierarchy (Orchestrators, Managers, Specialists, Workers) with visual tree and operational grid views.
- **Visual DAG Workflows**: Full drag-and-drop node canvas with cycle detection, auto-layout, conditional branching, human approval gates, and pre-built production presets.
- **Autonomous Code Studio**: Complete in-browser web IDE with multi-file workspace, syntax highlighting, live multi-viewport preview (Desktop, Tablet, Mobile), console drawer, and ZIP packaging.
- **Multi-Agent Conference Room**: Collaborative roundtable space with A2A hierarchy execution protocol, real-time event streaming, TTS audio readouts, and direct Kanban dispatching.
- **Live Voice Cockpit**: Google Gemini Multimodal Live API WebSocket client streaming 16kHz in / 24kHz out audio with reactive floating Voice Orb HUD (`Alt + V`).
- **Autonomous Kanban Board**: 4-column drag-and-drop task pipeline with 1-click autonomous execution, multi-agent swarm decomposition, self-reflection critique, and subtask checklists.
- **Knowledge Galaxy & Vault**: Obsidian-compatible Markdown vault with bi-directional sync, wikilink parsing, local RAG semantic search, and Three.js-style 3D Knowledge Galaxy graph.
- **CUA & Web Intelligence**: Computer-Using Agent (CUA) desktop automation with auto-screenshots, paired with a Python Scrapling bridge for stealth web crawling.
- **Model Context Protocol (MCP)**: Native MCP client manager supporting STDIO and SSE transports with auto-discovered tools injected into the self-healing tool loop.
- **Omnichannel Messaging**: Native WhatsApp Personal (QR pairing), WhatsApp Cloud API, Telegram Bot API, Slack, and customizable Webhooks.

---

## 🏛️ Chronological Decision Log

### 1. Modular LLM Architecture & Cascade Engine
- **Decision**: Decompose monolithic router into `router-types.ts`, `context-management.ts`, `provider-selection.ts`, `router-execution.ts`, and `llm-router.ts`.
- **Why**: Prevent code sprawl, improve maintainability, and ensure sub-millisecond cascading failover between providers.
- **Impact**: Zero downtime during individual provider rate limits or API outages.

### 2. Elimination of Global State Mutation
- **Decision**: Refactor API key resolution and provider configurations to be strictly immutable without mutating `process.env`.
- **Why**: Prevent race conditions, thread pollution, and credential leaks in concurrent multi-agent executions.
- **Impact**: Rock-solid stability under heavy parallel agent workloads.

### 3. Hierarchical Agent Organization (4-Tier Model)
- **Decision**: Structure agents into Orchestrators ➔ Managers ➔ Specialists ➔ Workers with self-referential reporting chains in Prisma (`reportsTo`).
- **Why**: Mirror real-world organizational structures, enabling natural mission delegation, milestone coordination, and task deconstruction.
- **Impact**: Supports both operational grid management and visual hierarchy tree views (`AgentHierarchyView`).

### 4. Shared Obsidian Memory Vault & 3D Knowledge Galaxy
- **Decision**: Persist all agent outputs, deliverables, and conference syntheses as structured Markdown files in `/vault` with wikilink (`[[Note Name]]`) indexing.
- **Why**: Eliminate proprietary database lock-in and enable bi-directional integration with Obsidian desktop.
- **Impact**: Unlocks persistent organizational intelligence and interactive 3D physics-based graph exploration.

### 5. Computer-Using Agent (CUA) & Desktop Automation
- **Decision**: Implement a native CUA desktop automation driver (`cua-driver.ts`) with mouse, keyboard, window launching, and screenshot capture.
- **Why**: Bridge the gap between digital text reasoning and physical desktop application operations.
- **Impact**: Agents can open local applications, navigate web browsers, capture screen state, and embed screenshots directly into responses.

### 6. Python Scrapling Bridge for Stealth Web Crawling
- **Decision**: Integrate a dedicated Python Scrapling bridge (`scrapling-bridge.ts`) leveraging `curl_cffi`, `lxml`, and `cssselect`.
- **Why**: Traditional HTTP scraping fails on modern bot-protected and JavaScript-rendered web pages.
- **Impact**: Provides stealth Cloudflare bypass, multi-page crawling, and automated HTML-to-clean-Markdown synthesis.

### 7. Model Context Protocol (MCP) Client Integration
- **Decision**: Build a full MCP Client Manager (`client-manager.ts`) supporting both STDIO (subprocess) and SSE (HTTP) server connections.
- **Why**: Standardize external tool integration and prevent vendor lock-in.
- **Impact**: Agents automatically discover and execute tools exposed by external MCP servers (Filesystem, GitHub, PostgreSQL, etc.).

### 8. Visual DAG Workflow Automation Engine
- **Decision**: Implement an interactive node-based workflow editor (`/workflows`) with cycle detection and topological sorting.
- **Why**: Enable users and agents to design complex, multi-step business pipelines with branching logic and human approval gates.
- **Impact**: Empowers one-click execution of complex multi-agent pipelines (SaaS building, market reports, refactoring).

### 9. Autonomous Code Studio & Multi-Viewport IDE
- **Decision**: Build an in-browser Web IDE (`/code`) with workspace file isolation, tabbed editing, and responsive multi-viewport preview (Desktop, Tablet, Mobile).
- **Why**: Allow users and coding agents to collaborate, generate full-stack projects, and preview them live without leaving the platform.
- **Impact**: Drastically accelerates code generation, debugging, diff inspection, and ZIP project export.

### 10. Multi-Agent Conference Roundtable & A2A Protocol
- **Decision**: Create a dedicated collaborative conference space (`/conference`) with live thought streaming, delegation events, and TTS audio readouts.
- **Why**: Complex cross-functional challenges require real-time deliberation and consensus among multiple specialist agents.
- **Impact**: Delivers transparent multi-agent reasoning, real-time audio playback, and direct Kanban task dispatching.

### 11. Gemini Live Multimodal Voice WebSocket Pipeline
- **Decision**: Connect directly to Google Gemini Multimodal Live API over WebSockets using 16kHz PCM input and 24kHz PCM output.
- **Why**: Deliver true conversational voice latency (<300ms) with natural interruption handling, rather than clunky chained STT ➔ LLM ➔ TTS pipelines.
- **Impact**: Provides an instant voice cockpit experience accessible from anywhere via `Alt + V`.

### 12. Omnichannel Messaging (WhatsApp, Telegram, Slack)
- **Decision**: Build a unified omnichannel router (`omnichannel-router.ts`) linking agents to WhatsApp (QR code pairing via Baileys), Telegram Bot API, and Slack.
- **Why**: Enable mobile-first agent interaction, task approvals, and status inquiries on the go.
- **Impact**: Users can monitor tasks, execute routines, and converse with agents from their preferred messaging applications.

### 13. Self-Healing Execution Loop & Safety Guardrails
- **Decision**: Wrap the agentic tool loop in an automated self-healing engine (`self-healing-engine.ts`) with argument correction and tool fallbacks.
- **Why**: LLM tool calls occasionally produce syntax errors, missing parameters, or environment exceptions.
- **Impact**: Reduces failed task runs by over 80% while strictly enforcing path traversal and destructive command guardrails.

---

## 🔍 Technical Health & Verification

- **TypeScript Strict Compilation**: 0 errors (`npx tsc --noEmit`).
- **ESLint Core & Typescript Rules**: 0 errors (`npm run lint`).
- **Vitest Unit & Integration Suites**: 19/19 test suites passing (119/119 unit tests passing).
- **Database Concurrency**: SQLite configured with WAL mode (`PRAGMA journal_mode = WAL;`), `PRAGMA busy_timeout = 5000;`, and memory caching in `prisma.ts`.
- **Security Boundaries**: Local guest fallback strictly gated by environment variables (`ALLOW_LOCAL_GUEST_FALLBACK`), with Clerk auth enabled for multi-user production.

---

## 🗺️ Roadmap & Future Enhancements

- [ ] **Collaborative Multi-User Canvas**: Real-time multi-user cursor sync on the DAG workflow canvas via WebSockets.
- [ ] **Native Mobile Companion App**: React Native / Expo wrapper for push notifications and native voice capture.
- [ ] **Distributed Worker Nodes**: Offload heavy code execution and browser CUA tasks to remote secondary worker daemons.
- [ ] **Vector Database Cloud Sync**: Optional hybrid sync connecting local SQLite/Obsidian vaults to Pinecone or Weaviate for massive scale.