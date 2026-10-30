# 🌌 Agent Studio OS — Core Application Engine

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-16.3.5-black?style=for-the-badge&logo=next.js)
![React](https://img.shields.io/badge/React-19.2.8-61dafb?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6.9.0-2D3748?style=for-the-badge&logo=prisma)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4.0-38bdf8?style=for-the-badge&logo=tailwind-css)
![Vitest](https://img.shields.io/badge/Tests-210%20Passed-brightgreen?style=for-the-badge&logo=vitest)

**The Next.js 16 Web Application & Autonomous Execution Engine for Agent Studio OS.**

[Main Project Documentation (Root README)](../README.md) • [Architecture](../README.md#-system-architecture) • [Feature Directory](../README.md#-comprehensive-feature-directory)

</div>

---

## 📖 Overview

This package houses the core web cockpit and API services for **Agent Studio OS**. Built on the modern Next.js 16 App Router and React 19, it implements:
- **Resilient AI Brain Gateway:** Zero-downtime cascading fallbacks between cloud and local models.
- **Multimodal Voice Cockpit:** Bidirectional WebSocket audio streaming via Google Gemini Live API.
- **Autonomous Multi-Agent Systems:** 4-tier hierarchical agent squads, A2A roundtables, visual DAG workflows, and self-reflecting Kanban task pipelines.
- **In-Browser Autonomous IDE:** Sandboxed multi-viewport Code Studio with live diff inspection.
- **Persistent Knowledge Graph:** Obsidian vault two-way synchronization and 3D Three.js physics galaxy.

---

## ⚡ Quick Development Commands

Run these commands inside this (`agent-studio-os/`) directory:

```bash
# 1. Install dependencies
npm install

# 2. Synchronize database schema (SQLite in WAL mode)
npx prisma db push

# 3. Generate Prisma client bindings
npx prisma generate

# 4. Optional: Seed default agent fleet
node scripts/seed-agents.js

# 5. Run automated unit & integration test suite (210 tests)
npm test

# 6. Start development server with Turbopack
npm run dev

# 7. Production build & verification
npm run build
npm run start
```

---

## 🔑 Environment Configuration

Create a `.env.local` file inside this directory (refer to `.env.example` for reference):

```env
# Primary Brain Gateway (Omniroute or Local Router)
OMNIROUTE_URL="http://127.0.0.1:20128"
OMNIROUTE_API_KEY=""

# Direct Cloud Providers (Configure at least one)
GEMINI_API_KEY="AIzaSy..."
ANTHROPIC_API_KEY="sk-ant-..."
OPENAI_API_KEY="sk-..."
GROQ_API_KEY="gsk_..."
DEEPSEEK_API_KEY="sk-..."
OPENROUTER_API_KEY="sk-or-v1-..."

# Optional: Authentication (Default guest mode active if unset)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=""
CLERK_SECRET_KEY=""

# Web Server Port
PORT=3000
```

> **Note:** API keys can also be dynamically configured, securely stored, and tested with live latency probes directly in the UI under **Settings ➔ Provider Hub**.

---

## 🧪 Testing & Code Quality

This package includes a comprehensive automated test suite powered by **Vitest**:

```bash
# Run all unit and integration tests
npm test

# Run tests with code coverage metrics
npm run coverage

# Run linter
npm run lint

# Run strict TypeScript compiler verification
npx tsc --noEmit
```

For the complete system architecture, slash command reference, API specs, and production deployment guides, refer to the **[Primary Project README.md](../README.md)**.
