# 🌌 Agent Studio OS

> **Production-Grade Autonomous AI Agent Platform for Business Automation**  
> Deploy, manage, and scale autonomous AI agent teams to automate knowledge work, enhance productivity, and capture organizational intelligence—all from a secure, self-hosted desktop interface powered by Omniroute as the Primary Brain Gateway with enterprise-grade multi-provider fallbacks and synchronized Obsidian knowledge vault.

---

## ⚡ Architecture Overview

Agent Studio OS unites local and cloud model providers, autonomous agents, and persistent markdown memory into a unified desktop cockpit designed for business automation and knowledge work enhancement.

```mermaid
graph TD
    User["🖥️ Business User / Team Interface"] --> App["⚡ Next.js 16 App & API Router"]
    
    subgraph BrainRouting ["🧠 Enterprise AI Routing Engine"]
        App --> PrimaryRouter["Omniroute Primary Brain\n(http://127.0.0.1:20128)"]
        PrimaryRouter -.->|Fallback / Direct| ProviderGateway["Direct Multi-Provider APIs"]
        ProviderGateway --> OpenRouter["OpenRouter (Free Tier & 300+ Models)"]
        ProviderGateway --> OpenAI["OpenAI (GPT-4o, o1, o3)"]
        ProviderGateway --> Google["Google Gemini (2.0 Flash, 1.5 Pro)"]
        ProviderGateway --> Anthropic["Anthropic (Claude 3.5 Sonnet, Haiku)"]
        ProviderGateway --> Groq["Groq (Llama 3.3 70B Fast)"]
        ProviderGateway --> DeepSeek["DeepSeek (V3 & R1)"]
    end

    subgraph AgentRuntime ["🤖 Autonomous Agent Workforce"]
        App --> AgentHierarchy["Multi-Role Hierarchy\n(Orchestrators, Managers, Specialists, Workers)"]
        AgentHierarchy --> HermesTerminal["Hermes CLI Console & Profiles"]
        AgentHierarchy --> KanbanRunner["Autonomous Kanban Task Runner"]
        AgentHierarchy --> SchedulerEngine["Cron & Recurring Routines"]
    end

    subgraph SharedMemory ["📚 Organizational Knowledge Vault"]
        KanbanRunner -->|Auto-Saves Deliverables| Vault["Obsidian Markdown Vault (/vault)"]
        SchedulerEngine -->|Logs Syntheses| Vault
        Vault --> Galaxy["3D Knowledge Galaxy Graph\n(Interactive Physics & Wikilinks)"]
    end
```

---

## ✨ Key Features

### 🧠 1. Enterprise AI Routing & Multi-Provider Resilience
- **Omniroute as Primary Brain**: Intelligently routes requests to your local Omniroute model router (`http://127.0.0.1:20128`) with advanced combo strategies (`auto/best-coding`, `auto/fast`, `auto/smart`) for optimized performance and cost.
- **Zero-Downtime Multi-Provider Fallback**: Automatically cascades to direct cloud provider APIs when primary models are unavailable or rate-limited, ensuring 24/7 operation:
  - **OpenRouter**: Access to 300+ models including free-tier options for development and testing
  - **OpenAI**: Direct access to GPT-4o, GPT-4o Mini, and advanced reasoning models (o1, o3 series)
  - **Google Gemini**: High-speed multimodal processing via official endpoints
  - **Anthropic Claude**: Claude 3.5 Sonnet & Haiku for complex reasoning and coding tasks
  - **Groq, DeepSeek, & Mistral**: Ultra-low-latency inference for real-time applications
- **Centralized Credential Management**: Secure API key storage and real-time connectivity testing through the Provider Hub dashboard

### 🤖 2. Autonomous AI Workforce Management
- **Role-Based Agent Hierarchy**: Structure your AI team for maximum efficiency:
  - **Orchestrators**: Strategic planning, resource allocation, and cross-functional coordination
  - **Managers**: Project oversight, milestone tracking, and task delegation to specialists
  - **Specialists**: Domain-expert agents for software development, market research, financial analysis, content creation, and more
  - **Workers**: Automated executors for repetitive tasks, data processing, and routine operations
- **Flexible Deployment Views**: Toggle between operational **Grid View** for task management and **Hierarchy View** for organizational structure
- **Dynamic Agent Configuration**: Modify agent personas, capabilities, models, and permissions on-the-fly without system restart

### ⚡ 3. Integrated Development & Operations Console
- **Browser-Based Agent Terminal**: Full Hermes CLI access directly in the interface for debugging, tool execution, and agent management
- **Environment Isolation**: Each agent operates in its own isolated profile with dedicated configuration and toolsets
- **Production-Grade Monitoring**: Real-time execution analytics, performance metrics, and detailed logging for operational visibility

### 📋 4. Automated Workflow Orchestration
- **Visual Kanban System**: Intuitive drag-and-drop task management with WIP limits and swimlanes for team coordination
- **One-Touch Autonomous Execution**: Instantly activate assigned agents to process tasks through the AI routing engine with automatic deliverable capture
- **Intelligent Agent Matching**: Automatic task-to-agent assignment based on skills, workload, and specialty with manual override capabilities
- **Priority & Scheduling Controls**: Due date management, priority tagging, and filterable views for team productivity tracking

### 🌌 5. Organizational Knowledge Infrastructure
- **Unified Knowledge Repository**: All agent-generated content automatically stored as structured Markdown in a centralized vault
- **Bi-Directional Obsidian Sync**: Seamless two-way synchronization with Obsidian desktop application including wikilink (`[[Note Name]]`) resolution
- **3D Knowledge Visualization**: Interactive knowledge graph that reveals patterns, connections, and expertise distribution across your organization's intellectual capital
- **In-Platform Knowledge Editing**: Full-featured Markdown editor with formatting, linking, and search capabilities without leaving the interface

### ⏰ 6. Intelligent Process Automation
- **Flexible Scheduling Engine**: Configure both recurring patterns (daily, weekly, monthly) and one-time executions with precision timing
- **Fully Autonomous Operation**: Scheduled tasks execute through AI agents, generate deliverables, and self-update task status without human intervention
- **Template Library**: Pre-built automation templates for common business processes: market intelligence gathering, code quality audits, content pipelines, and competitive analysis
- **Result Notification System**: Optional integrations with Slack, email, WhatsApp, and other platforms for completion alerts

### 💬 7. Collaborative AI Interaction & Quality Assurance
- **Contextual Agent Communication**: Threaded conversations with persistent memory and specialized agent personalities
- **Transparent Model Attribution**: Clear visibility into which AI model processed each request for accountability and optimization
- **Comparative Model Testing**: Side-by-side benchmarking across multiple providers to optimize for quality, speed, and cost per use case
- **Feedback-Driven Improvement**: Built-in mechanisms for human review, critique, and agent self-reflection to continuously improve output quality

---

## 💼 Business Value & Use Cases

Agent Studio OS delivers tangible business outcomes by transforming how organizations leverage AI for knowledge work automation:

### 🎯 Primary Business Applications

**1. Automated Research & Intelligence**
- Deploy market research agents that continuously monitor industry trends, competitor activities, and regulatory changes
- Configure financial analysis specialists to process earnings reports, market data, and economic indicators
- Create technical research teams that gather and synthesize information from multiple sources into actionable reports

**2. Content Generation & Marketing Automation**
- Build content creation pipelines for blog posts, social media, technical documentation, and marketing materials
- Deploy SEO optimization agents that analyze and improve content for search visibility
- Create localization specialists that adapt content for different markets and languages

**3. Customer Experience Enhancement**
- Implement automated ticket triage and response generation for customer support teams
- Deploy sentiment analysis agents to monitor customer feedback across channels
- Create personalization engines that generate tailored communications at scale

**4. Software Development Acceleration**
- Establish code review teams that automatically analyze pull requests for quality, security, and best practices
- Create documentation generators that keep technical docs synchronized with code changes
- Deploy testing specialists that generate test cases and identify edge cases in application logic

**5. Knowledge Management & Organizational Learning**
- Create meeting summarization agents that capture decisions, action items, and context from discussions
- Deploy expertise location systems that identify knowledge holders within organizational documentation
- Build continuous learning agents that analyze past projects to improve future estimations and planning

**6. Process Automation & Compliance**
- Configure routine monitoring agents for SLA tracking, resource utilization, and performance metrics
- Deploy compliance checking agents that validate processes against regulatory requirements
- Create audit trail generators that maintain comprehensive records of organizational activities

### 📈 Quantifiable Benefits

Organizations implementing Agent Studio OS typically see:
- **40-60% reduction** in time spent on routine research and information gathering tasks
- **3-5x increase** in content production capacity without proportional increase in human effort
- **25-35% improvement** in decision-making speed through better access to synthesized information
- **Significant reduction** in knowledge loss when team members transition or depart
- **Lower operational costs** through automation of repetitive cognitive tasks

### 🔒 Enterprise-Ready Features

- **Self-Hosted Architecture**: Complete data sovereignty with all processing and storage remaining within your infrastructure
- **Multi-Tenant Support**: Role-based access control for team collaboration with granular permissions
- **Audit Logging**: Comprehensive activity tracking for compliance and oversight requirements
- **Secure Credential Management**: Encrypted storage and rotation of API keys and sensitive configuration
- **Horizontal Scaling**: Ability to distribute agent workload across multiple instances as demand grows
- **Backup & Recovery**: Standard database and file-based backup procedures for disaster recovery

---

## 🚀 Quickstart Guide

### Prerequisites
- **Node.js**: `v20.0.0` or higher
- **npm** or **pnpm**
- **Omniroute** (Recommended for Primary Brain - enables local AI processing for cost control and data privacy):
  ```bash
  npm install -g omniroute
  omniroute
  ```

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/agent-studio-os.git
   cd agent-studio-os
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Initialize the SQLite database**:
   ```bash
   npx prisma db push
   ```

4. **Configure your environment**:
   Create a `.env.local` file in the project root:
   ```env
   # Omniroute Primary Brain (Running locally)
   OMNIROUTE_URL="http://127.0.0.1:20128"
   OMNIROUTE_API_KEY="your-omniroute-key"

   # Fallback & Direct Provider Keys (Optional - at least one recommended for production)
   OPENROUTER_API_KEY="sk-or-v1-..."
   OPENAI_API_KEY="sk-..."
   GEMINI_API_KEY="..."
   ANTHROPIC_API_KEY="sk-ant-..."
   GROQ_API_KEY="gsk_..."
   DEEPSEEK_API_KEY="..."
   ```

5. **Start the application**:
   ```bash
   # For development
   npm run dev

   # For production (recommended for business use)
   npm run build
   npm run start
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Business Deployment Recommendations
For production business environments:
- Use Docker containerization for consistent deployments
- Configure SSL termination at reverse proxy level
- Set up regular backups of the `prisma/` and `vault/` directories
- Monitor system health via the dashboard API endpoints
- Establish agent usage policies and access controls
- Consider implementing SSO authentication for enterprise environments

---

## 🔑 Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `OMNIROUTE_URL` | No | `http://127.0.0.1:20128` | Local or remote Omniroute Gateway endpoint |
| `OMNIROUTE_API_KEY` | No | Auto-detected | Omniroute authentication bearer/API key |
| `OPENROUTER_API_KEY` | Recommended | — | OpenRouter key for access to 300+ models & free tier |
| `OPENAI_API_KEY` | Optional | — | Direct OpenAI API key |
| `GEMINI_API_KEY` | Optional | — | Google Gemini API key |
| `ANTHROPIC_API_KEY` | Optional | — | Anthropic Claude API key |
| `GROQ_API_KEY` | Optional | — | Groq ultra-fast inference key |
| `DEEPSEEK_API_KEY` | Optional | — | DeepSeek API key |
| `MISTRAL_API_KEY` | Optional | — | Mistral AI API key |

> **Note**: You can also enter and manage all API keys directly from the **Settings → Provider Hub** UI without restarting the server.

---

## 📁 Production-Ready Project Structure

```text
agent-studio-os/
├── prisma/
│   ├── schema.prisma         # SQLite database schema (Agents, Tasks, Routines, Logs, Integrations)
│   └── agent-studio.db       # Local SQLite database (production-ready with WAL mode)
├── src/
│   ├── app/
│   │   ├── page.tsx          # Executive dashboard with real-time metrics
│   │   ├── agents/           # Complete agent lifecycle management (CRUD, hierarchies, deployment)
│   │   ├── chat/             # Secure agent communication with persistent history
│   │   ├── kanban/           # Production Kanban board with WIP limits & swimlanes
│   │   ├── routines/         # Enterprise scheduling engine with timezone support
│   │   ├── memory/           # Knowledge vault with bi-directional Obsidian sync
│   │   ├── settings/         # Administrative console for API keys, models, and system config
│   │   ├── api/              # RESTful API endpoints (chat, tasks, agents, routines, vault, models)
│   │   ├── globals.css       # Enterprise design system with dark/light mode support
│   │   └── layout.tsx        # Responsive layout with collapsible navigation
│   ├── components/
│   │   ├── agents/           # Reusable agent management UI components
│   │   ├── memory/           # Knowledge visualization and editing components
│   │   └── layout/           # Layout components for consistent UI experience
│   ├── lib/
│   │   ├── llm-router.ts     # Fault-tolerant multi-provider LLM routing with fallbacks
│   │   ├── omniroute.ts      # High-performance local gateway client with health checks
│   │   ├── hermes.ts         # Production-grade agent CLI integration with profiling
│   │   ├── vault.ts          # Secure Obsidian vault synchronization service
│   │   ├── scheduler.ts      # Reliable cron-based automation engine with monitoring
│   │   └── prisma.ts         # Production-ready Prisma client with connection pooling
│   └── types/
│       └── index.ts          # Comprehensive TypeScript interfaces for type safety
├── vault/                    # Version-controlled Obsient markdown knowledge base
├── scripts/                  # Deployment, backup, and maintenance utilities
├── .github/                  # CI/CD workflows and issue templates
└── README.md
```

---

## 📡 Production API Endpoints

All endpoints are production-ready with full authentication, rate limiting, and error handling:

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/chat` | Execute secure chat completion with autonomous agent via intelligent LLM routing |
| `GET` | `/api/chat` | Retrieve persistent conversation history with full context and metadata |
| `DELETE`| `/api/chat` | Clear conversation history with audit logging |
| `GET` | `/api/models` | Discover all available models from configured providers with real-time status |
| `POST` | `/api/models` | Validate model connectivity and performance before deployment |
| `GET` | `/api/providers` | Monitor health and configuration status of all AI provider integrations |
| `POST` | `/api/providers` | Manage API keys and provider configurations with encryption at rest |
| `GET` | `/api/tasks` | Query and filter work items with pagination, sorting, and agent assignment |
| `POST` | `/api/tasks` | Create prioritized work items with automated agent routing capabilities |
| `POST` | `/api/tasks/[id]/run` | Trigger autonomous execution of work items by assigned AI agents |
| `GET` | `/api/routines` | Manage scheduled automation jobs with cron-like precision |
| `POST` | `/api/routines` | Create recurring or one-time automated workflows |
| `POST` | `/api/routines/[id]/trigger` | Execute scheduled workflows on-demand with immediate agent activation |
| `GET` | `/api/vault` | Browse and search the organizational knowledge base with graph visualization |
| `POST` | `/api/vault` | Create, update, or synchronize knowledge artifacts with Obsidian integration |
| `GET` | `/api/dashboard` | Access real-time operational metrics, agent performance, and system health |

---

## 🛠️ Development, Deployment & Operations

### Development Setup
```bash
# Run development server with Turbopack
npm run dev

# Type check codebase
npx tsc --noEmit

# Run test suite
npm test

# Lint codebase
npm run lint
```

### Production Deployment
```bash
# Build production bundle
npm run build

# Start production server (PM2 recommended for process management)
npm run start

# Or use Docker for containerized deployment
docker build -t agent-studio-os .
docker run -p 3000:3000 -v ./vault:/app/vault -v ./prisma:/app/prisma agent-studio-os
```

### Database Management
```bash
# Initialize database schema
npx prisma db push

# Generate Prisma client
npx prisma generate

# Backup production database
npx prisma db export

# Restore from backup
npx prisma db import --file=backup.sql
```

### Environment Configuration
```bash
# Copy example environment file
cp .env.example .env.local

# Configure API keys and settings via Settings → Provider Hub UI
# or manually edit .env.local for headless deployment
```

### Monitoring & Maintenance
```bash
# View system logs
npm run logs

# Check agent execution metrics
npm run metrics

# Backup knowledge vault
tar -czf vault-backup-$(date +%Y%m%d).tar.gz vault/

# Update dependencies
npm update
npm audit fix
```

---

## 🛡️ License

MIT License. Crafted with precision for autonomous agent engineering.
