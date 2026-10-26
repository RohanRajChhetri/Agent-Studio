# 🌌 Agent Studio OS (Core Web Application)

> **The Next.js 16 Web Application & Core Engine for Agent Studio OS**

This folder contains the main frontend GUI and API engine for Agent Studio OS, built with **Next.js 16 App Router**, **React 19**, **Tailwind CSS 4**, and **Prisma ORM with SQLite**.

For comprehensive documentation, feature guides, architecture diagrams, and full system capabilities, please refer to the primary repository documentation:
👉 **[Main Project README.md](../README.md)**

---

## 🚀 Quick Development Commands

Run these commands inside the `agent-studio-os/` directory:

```bash
# Install dependencies
npm install

# Initialize or push SQLite database schema
npx prisma db push

# Generate Prisma client
npx prisma generate

# Launch local development server with Turbopack
npm run dev

# Run Vitest test suite
npm test

# Build for production
npm run build

# Start production server
npm run start
```

## 🔑 Environment Configuration

Create a `.env.local` file in this directory with your API keys:

```env
# Primary Brain Gateway
OMNIROUTE_URL="http://127.0.0.1:20128"
OMNIROUTE_API_KEY=""

# Direct Provider Keys
GEMINI_API_KEY=""
ANTHROPIC_API_KEY=""
OPENAI_API_KEY=""
GROQ_API_KEY=""
DEEPSEEK_API_KEY=""
OPENROUTER_API_KEY=""
```

All API keys can also be managed and tested live in the browser via **Settings ➔ Provider Hub**.