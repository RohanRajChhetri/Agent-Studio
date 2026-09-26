# Product Requirements Document

## Project Overview
Agent Studio OS is a Next-Generation Autonomous Multi-Agent Orchestration Operating System designed to build, coordinate, schedule, and interact with autonomous AI agents from a sleek desktop GUI. The primary problem being solved is the fragmentation and complexity of managing multiple AI agents, models, and workflows in a unified, intelligent system that provides persistent memory, autonomous execution, and seamless integration across local and cloud-based LLM providers.

## Target Audience
- **AI Engineers & Developers**: Professionals building and deploying AI agent systems who need orchestration tools
- **Researchers & Analysts**: Users conducting complex research requiring multi-agent collaboration and persistent knowledge synthesis
- **Power Users & Technologists**: Advanced individuals seeking to automate complex workflows through AI agent fleets
- **Product Managers & Team Leads**: Coordinators managing AI-augmented teams and workflow automation
- **DevOps & SRE Engineers**: Specialists focused on infrastructure, reliability, and automated system management

## Core Features (MVP Scope)
1. **Omniroute Primary Brain & Multi-API Router**
   - Intelligent model routing with local Omniroute prioritization
   - Resilient fallback to direct cloud provider APIs (OpenRouter, OpenAI, Google Gemini, Anthropic, Groq, DeepSeek, etc.)
   - Provider Hub with real-time ping testing and secure credential management

2. **Autonomous Agent Studio & Hierarchy**
   - Hierarchical fleet management (Orchestrators, Managers, Specialists, Workers)
   - Dual visual modes (Grid Card View and Visual Tree Hierarchy View)
   - Unified agent form for creating/editing avatars, personas, system prompts, models, themes, and departments

3. **Hermes CLI Console**
   - Interactive in-browser terminal for executing live Hermes CLI commands
   - Dedicated profile scoping targeting selected agent's isolated environment
   - Clean UI with real-time execution logs, latency tracking, and instant clear

4. **Autonomous Kanban Pipeline**
   - Drag-and-drop task management (Backlog → In Progress → Review → Done)
   - One-click autonomous execution committing deliverables to Obsidian Vault
   - Agent assignment filtering and priority badges with due dates

5. **Shared Memory Vault & 3D Knowledge Galaxy**
   - Single source of truth: All agent outputs written as Markdown notes to vault/
   - Obsidian compatibility with bidirectional wikilink ([[Note Name]]) resolution
   - Interactive 3D Memory Galaxy exploring knowledge clusters and connection nodes
   - Built-in Markdown Editor for viewing, editing, formatting, and deleting vault notes

6. **Scheduled Routines & Background Automation**
   - Recurring & one-time routines (e.g., daily market scans, code audits)
   - Autonomous execution logging results to shared memory and moving deliverables to Review
   - Quick-start templates for common automation scenarios

7. **Interactive Agent Chat & Model Arena**
   - Real-time dialogue with specific agents using custom system prompts
   - Dynamic source badges showing execution origin (Omniroute, OpenRouter, OpenAI, Gemini, Anthropic, Groq)
   - Model Comparison Arena for side-by-side prompt benchmarks across 3 models

## Out of Scope / Non-Goals
- **Mobile Applications**: Focus is strictly on desktop web browser experience
- **Pre-built Template Marketplace**: While templates exist in agent creation, a public marketplace is not part of MVP
- **Large-scale Cloud Infrastructure**: Designed for individual/team use, not enterprise cloud-scale deployments
- **Native Desktop Clients**: Progressive Web App approach prioritized over Electron/native wrappers
- **Proprietary LLM Development**: Focuses on integrating existing models, not training new foundation models
- **Complex Enterprise SSO**: Authentication remains API-key based for simplicity in MVP
- **Advanced Video/Audio Processing**: While multimodal models are supported, specialized media tooling is not core

## Success Metrics
- **Active Agent Count**: Number of concurrently active agents in the fleet
- **Task Completion Rate**: Percentage of tasks successfully executed vs. failed
- **Average Response Latency**: Time from prompt to response delivery (target: <2s for simple queries)
- **Memory Vault Growth**: Vault size and interlink density over time (indicating knowledge accumulation)
- **User Engagement Metrics**: Daily/weekly active users, session duration, feature adoption rates
- **System Reliability**: Uptime percentage, error rates, and recovery time from failures
- **Model Utilization Diversity**: Distribution of usage across different providers and model types