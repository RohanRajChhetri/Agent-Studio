# Coding Rules & Development Guidelines

## 📐 Code Style & Architecture Standards

### Language Standards
- **TypeScript**: Strict mode enabled (`"strict": true` in `tsconfig.json`). No implicit `any`, no untyped return values on public API methods.
- **Next.js & React**: Next.js 16 App Router conventions with React 19 compliance:
  - **No Render-Phase Ref Mutations**: Never mutate `useRef` values during render phase; use `useEffect` or event handlers.
  - **Dynamic Route Flags**: Explicitly define `export const dynamic = "force-dynamic"` on interactive client/server pages where appropriate.
  - **Client/Server Boundaries**: Explicit `"use client"` directives at the top of interactive components.
- **Naming Conventions**:
  - Functions & Variables: `camelCase`
  - React Components & TypeScript Interfaces/Types: `PascalCase`
  - Constants & Enums: `UPPER_SNAKE_CASE`
  - Files: `kebab-case.ts` / `kebab-case.tsx`
  - Directories: `kebab-case`

### Code Organization & Modularity
- **Focused Modules**: Keep files modular and single-responsibility (< 300 lines preferred, up to 600 lines for complex UI coordinators).
- **Service Layer Pattern**: Business logic resides in `src/lib/` service modules (e.g., `cua-driver.ts`, `scrapling-bridge.ts`, `dag-engine.ts`, `vault.ts`), not inside React page components or route handlers.
- **Path Aliases**: Use `@/` resolving to `src/` for clean imports across the entire application.

---

## 🛡️ Tool Execution & Safety Guardrails

### 1. Agentic Tool Execution Loop Rules
- **Name & Argument Normalization**: All incoming tool names and arguments from various LLM formats (Qwen/Hermes tokens, XML tags, JSON-RPC) must be normalized via `normalizeToolName` and `normalizeArgKey` in [`agentic-tool-loop.ts`](file:///c:/Users/rohan/Projects/Agent%20Os/agent-studio-os/src/lib/agentic-tool-loop.ts).
- **Self-Healing Requirement**: All tool invocations must route through [`self-healing-engine.ts`](file:///c:/Users/rohan/Projects/Agent%20Os/agent-studio-os/src/lib/self-healing-engine.ts) to intercept runtime errors, evaluate reflection guidance, and attempt alternative tool fallbacks before failing.
- **No Decorative Horizontal Dividers**: System prompts and templates must strictly instruct agents never to generate decorative markdown horizontal rules (`---`, `***`, `___`) to prevent UI visual clutter.

### 2. CUA (Computer-Using Agent) Safety Rules
- **Viewport Stabilization**: All CUA app launch and click actions must include viewport stabilization delays before capturing post-action screenshots.
- **Download Vault Scoping**: Captured desktop screenshots must be written exclusively to `public/downloads/` with timestamped filenames (`screenshot-[timestamp].png`).
- **Destructive Command Blocking**: The safety guardrails engine (`safety-guardrails.ts`) must block destructive shell commands (`rm -rf /`, drive formatting, irreversible cloud teardown).

### 3. File System & MCP Sandboxing
- **Workspace Confinement**: All file creation, editing, and listing tools (`create_file`, `write_file`, `read_file`, `list_dir`) are strictly sandboxed to the project root, `/workspace`, `/vault`, or `/downloads`.
- **Path Traversal Protection**: Directory traversal sequences (`../`, `..\\`) targeting locations outside project roots must immediately throw a security exception.

---

## 🚨 Error Handling & API Standards

### Centralized Middleware Pattern
- All API route handlers must utilize the standardized [`handleApiError`](file:///c:/Users/rohan/Projects/Agent%20Os/agent-studio-os/src/lib/api-middleware.ts) wrapper:
  ```typescript
  export async function POST(request: Request) {
    try {
      // Endpoint logic...
      return NextResponse.json({ success: true, data });
    } catch (error) {
      return handleApiError(error, "RouteContextName", "User-friendly error message", 500);
    }
  }
  ```
- **Error Sanitization**: Error messages returned to client browsers must be clean and sanitized; technical stack traces and raw error objects must be logged server-side only.

---

## 🧪 Testing Standards

- **Vitest Framework**: All unit and integration tests are executed using Vitest (`npm test`).
- **Test Scoping**:
  - Every new service module in `src/lib/` must have a corresponding test suite in `src/lib/__tests__/`.
  - Maintain 100% test passing rate (currently 19/19 suites, 119/119 tests).
- **Type Checking & Linting**:
  - Run `npx tsc --noEmit` before committing code. Must produce 0 errors.
  - Run `npm run lint` before committing code. Must produce 0 errors.

---

## 📦 Git & Commit Conventions

- **Conventional Commits**: Format commit messages as `<type>(<scope>): <imperative description>`:
  - `feat`: New feature (e.g., `feat(code): add tablet viewport preview`)
  - `fix`: Bug fix (e.g., `fix(voice): prevent render-phase ref mutation`)
  - `docs`: Documentation updates (e.g., `docs: update architecture and prd`)
  - `refactor`: Code reorganization without functional changes
  - `test`: Adding or updating test suites
  - `chore`: Tooling, dependencies, or configuration updates
- **Branch Strategy**: Feature branches off `main` merged cleanly with verified tests and typecheck passes.