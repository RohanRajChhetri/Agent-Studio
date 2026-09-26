# Coding Rules

## Code Style & Formatting

### Language Standards
- **TypeScript**: Strict mode enabled (`tsconfig.json` with `"strict": true`)
- **JavaScript/TSX**: Modern ES2022+ syntax
- **Naming Conventions**:
  - Variables, functions: `camelCase`
  - Components, types, interfaces: `PascalCase`
  - Constants: `UPPER_SNAKE_CASE`
  - Private members/variables: `_camelCase` (by convention)
  - Files: `kebab-case` for `.tsx`, `.ts`, `.js` files
  - Directories: `kebab-case`

### Formatting Tools
- **ESLint**: Primary linting tool configured via `eslint.config.mjs`
  - Extends: `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
  - Custom ignores: `.next/`, `out/`, `build/`, `next-env.d.ts`
- **TypeScript Compiler**: `npx tsc --noEmit` for type checking
- **Prettier**: Not explicitly configured; relies on ESLint and editor settings
- **EditorConfig**: Not present in root; relies on ESLint and IDE settings

### Code Organization
- **File Size**: Aim for focused modules (< 200 lines preferred, acceptable up to 500 lines with clear single responsibility)
- **Function Size**: Small, focused functions; prefer composition over deep nesting
- **Imports**: 
  - Grouped: external libraries, internal libraries, local components
  - Sorted alphabetically within groups
  - Path aliases: `@/` for `src/` directory
- **Barrel Files**: Used selectively (e.g., `llm-router.ts` exports submodules); prefer explicit exports for better tree-shaking when feasible

## Architecture Patterns

### Modularity & Separation of Concerns
- **Layered Architecture**: 
  - Presentation Layer (Next.js pages/components)
  - Brain Routing Layer (LLM routing system)
  - Agent Runtime Layer (agent hierarchy and execution)
  - Shared Memory Layer (vault and knowledge graph)
- **Domain Separation**: Clear boundaries between auth, agents, tasks, routines, memory, settings
- **Service Objects**: Business logic encapsulated in service-like modules (e.g., `lib/` directory)

### Key Architectural Patterns Observed
1. **Facade Pattern**: `llm-router.ts` as a unified interface to modular LLM routing subsystems
2. **Strategy Pattern**: Provider selection in `provider-selection.ts` with `BaseLLMProvider` abstract class
3. **Middleware Pattern**: Reusable API middleware in `api-middleware.ts` (resolveAgentAndSession, persistChatMessages, etc.)
4. **Factory Pattern**: Agent creation via form with template-based instantiation
5. **Observer Pattern**: Real-time updates via React state and server actions
6. **Repository Pattern**: Prisma ORM as data access layer with typed models

### Specific Implementation Patterns
- **Early Returns**: Validation checks with early returns (seen in chat route handlers)
- **Non-blocking Operations**: Fire-and-forget persistence where appropriate (e.g., chat message saving)
- **Caching**: LRU-style caches for intent detection (`context-management.ts`) and API key resolution
- **Error Boundaries**: Standardized error handling via `handleApiError` wrapper
- **Configuration Override**: Environment variables with sensible defaults
- **Feature Flags**: Runtime feature detection (e.g., custom model mode in agent creation)

## Error Handling & Logging

### Error Handling Standards
1. **Centralized Error Handling**: 
   - `handleApiError` function in `api-middleware.ts` for standardized JSON error responses
   - Consistent structure: `{ error: userMessage, response: technicalDetails }` with appropriate HTTP status codes
   - Logging to console with context prefix: `[${context}] Error:`

2. **API Route Pattern**:
   ```typescript
   export async function handler(request: Request) {
     try {
       // Logic...
     } catch (error) {
       return handleApiError(error, "API Route Name", "User-friendly message", statusCode);
     }
   }
   ```

3. **Specific Error Handling Examples**:
   - Validation errors: Return 400 with specific field errors
   - Authentication/authorization: Would return 401/403 (pattern established but not fully shown in current code)
   - Resource not found: 404 with descriptive message
   - Server errors: 500 with generic user message + logged details

4. **Non-blocking Operations**:
   - Chat persistence uses try/catch with `console.warn` for non-critical failures
   - Background operations avoid blocking main request flow

### Logging Practices
- **Console Logging**: 
  - `console.error()` for errors with context tagging
  - `console.warn()` for recoverable issues
  - `console.info()` for operational information
- **Structured Logging**: Not implemented; relies on console messages with clear context
- **Error Context**: Always includes operation context (e.g., "API Chat POST", "Failed to process chat")
- **Production Considerations**: Error messages sanitized for users; technical details logged server-side

### Specific Error Handling Files
- `src/lib/api-middleware.ts`: Contains `handleApiError` standardization function
- `src/app/api/chat/route.ts`: Demonstrates proper error handling in API routes
- `src/lib/llm-router.ts`: Modular error handling in provider execution

## Git Conventions

### Branch Naming
- **Main Branch**: `main` (protected, production-ready)
- **Feature Branches**: `feature/[ticket-number]-[short-description]` or `feat/[description]`
- **Bug Fixes**: `fix/[ticket-number]-[issue]` or `bug/[description]`
- **Refactoring**: `refactor/[description]` or `ref/[ticket-number]-[description]`
- **Documentation**: `docs/[description]` or `documentation/[description]`
- **Hotfixes**: `hotfix/[description]` (for urgent production fixes)
- **Release Branches**: `release/v[major].[minor].[patch]` or `release/[version]`

### Commit Message Conventions
- **Format**: `<type>([optional scope]): <description>`
- **Types**:
  - `feat`: New feature
  - `fix`: Bug fix
  - `docs`: Documentation changes
  - `style`: Formatting, missing semicolons, etc. (no code change)
  - `refactor`: Code refactoring (neither fixes bug nor adds feature)
  - `perf`: Performance improvements
  - `test`: Adding or correcting tests
  - `chore`: Build process, tooling changes
  - `revert`: Revert previous commit
- **Examples**:
  - `feat(agent): add hierarchical agent management`
  - `fix(llm-router): resolve cache key collision`
  - `docs: update architecture diagram`
  - `refactor(context): extract intent detection logic`
  - `chore(deps): update prisma to v6.9.0`

### Commit Message Requirements
- **Imperative Mood**: "Add feature" not "Added feature"
- **Scope**: Optional but encouraged for clarity (e.g., `feat(agents): `)
- **Description**: Clear, concise summary of changes
- **Body**: Optional detailed explanation for complex changes
- **Footers**: Optional for references to issues, breaking changes, etc.

### Workflow Practices
1. **Pull Request Process**:
   - Branch from `main`
   - Create descriptive feature branch
   - Commit frequently with meaningful messages
   - Open PR against `main` with description and testing notes
   - Require code review before merge
   - Delete branch after merge

2. **Merge Strategy**:
   - Squash merge for feature branches (clean history)
   - Merge commit for significant releases
   - Rebase feature branches before PR to keep history linear

3. **Tags & Releases**:
   - Semantic Versioning: `vMAJOR.MINOR.PATCH`
   - Tags created for releases: `git tag v1.0.0`
   - Changelog maintained in repository

4. **Ignore Patterns** (`.gitignore`):
   - Dependencies: `/node_modules`, `/.pnp`, `.yarn/*`
   - Build outputs: `/.next/`, `/out/`, `/build/`
   - Environment files: `*.env*` (except `.env.example`)
   - Database files: `*.db`, `*.sqlite`, `prisma/*.db*` (critical for security)
   - Logs: `npm-debug.log*`, `yarn-*`
   - OS artifacts: `.DS_Store`, `Thumbs.db`
   - IDE files: `.vscode/`, `*.code-workspace`
   - Misc: `.pem` files, debug logs, scratch directories

### Security & Sensitivity Rules
- **Never Commit**: 
  - API keys, tokens, secrets
  - Database files containing sensitive data
  - Environment files with real values (use `.env.example` for template)
- **Environment Management**: 
  - `.env.local` for local development (gitignored)
  - `.env.example` committed with placeholder values
  - Runtime configuration via Settings UI in application
- **Database Protection**: 
  - Prisma schema committed but not actual SQLite database
  - Database files explicitly ignored to prevent credential leaks