# Project Context

## Current State
Agent Studio OS is a fully functional Next-generation Autonomous Multi-Agent Orchestration Operating System with the following characteristics:

**Core System Status**: 
- Built on Next.js 16.3.5, React 19.2.8, TypeScript 5
- Uses Prisma 6.9.0 with SQLite for data persistence
- Features modular LLM router architecture with Omniroute as Primary Brain Gateway
- Implements hierarchical agent system (Orchestrators, Managers, Specialists, Workers)
- Includes shared Obsidian-compatible memory vault with 3D Knowledge Galaxy visualization
- Provides autonomous task execution via Kanban pipeline and scheduling engine
- Offers Hermes CLI Console for in-browser agent interaction
- Features Provider Hub for managing multiple LLM API keys with fallback systems

**Recent Development Focus**:
- Completed major refactoring of monolithic `llm-router.ts` into focused modules (router-types, context-management, provider-selection, router-execution)
- Eliminated global state mutation in API key handling (`getActiveApiKeys` now read-only)
- Extracted reusable middleware from API routes (`resolveAgentAndSession`, `persistChatMessages`, `formatApiResponse`, `handleApiError`)
- Enhanced agent creation UI with role-based templates and directive generation
- Improved context management with caching and intent detection mechanisms
- Updated documentation to reflect current architecture

**Technical Health**:
- Codebase demonstrates strong modularity and separation of concerns
- Effective use of inheritance (BaseLLMProvider) and composition patterns
- Good encapsulation practices with proper scoping of helper functions
- Efficient algorithms in place (intent detection with caching, LRU-style caches)
- No obvious dead code detected in recent audit
- Some files exceed 200 lines but maintain single responsibility (acceptable per audit)
- Barrel file pattern used but noted for potential explicit export improvement

## Key Decisions (Chronological Log)

### 1. Transition to Modular LLM Architecture (Approx. 2026-09-15)
**Decision**: Refactor monolithic `llm-router.ts` into separate focused modules
**Why**: Improve maintainability, testability, and adherence to Single Responsibility Principle
**How**: Split into:
- `router-types.ts`: Core interfaces and verified models
- `context-management.ts`: Prompt building, intent detection & sliding window
- `provider-selection.ts`: Strategy pattern provider implementations
- `router-execution.ts`: Completion pipeline, key management & verification
- `llm-router.ts`: Facade exporting all sub-modules
**Impact**: Significantly improved code organization while maintaining backward compatibility via facade pattern

### 2. Elimination of Global State Mutation (Approx. 2026-09-16)
**Decision**: Modify `getActiveApiKeys` to read-only operation without mutating `process.env`
**Why**: Prevent unintended side effects, improve thread safety, follow functional programming principles
**How**: Changed implementation to return new keys object without modifying environment variables
**Impact**: Resolved architectural flaw noted in previous audit, improved reliability in concurrent scenarios

### 3. Middleware Extraction in API Routes (Approx. 2026-09-17)
**Decision**: Extract reusable logic from chat route handlers into middleware functions
**Why**: Reduce code duplication, improve consistency, enhance testability
**How**: Created `api-middleware.ts` with:
- `resolveAgentAndSession`: Agent/session resolution logic
- `persistChatMessages`: Chat persistence with error handling
- `formatApiResponse`: Standardized success response formatting
- `handleApiError`: Centralized error handling wrapper
**Impact**: Cleaner API routes with early validation returns and separation of concerns

### 4. Adoption of Glassmorphism Design System (Approx. 2026-09-10)
**Decision**: Implement modern glassmorphism aesthetic with dark/light theme support
**Why**: Create visually distinct, professional interface appropriate for AI agent orchestration
**How**: 
- Defined CSS variables in `globals.css` for both light and dark themes
- Created reusable utility classes (`glass`, `glass-card`, `glass-elevated`)
- Added ambient background gradients for depth
- Implemented consistent border-radius, spacing, and elevation patterns
**Impact**: Established premium, cohesive visual identity that enhances user experience

### 5. Hierarchical Agent Organization Model (Approx. 2026-09-05)
**Decision**: Structure agents into ORCHESTRATORS → MANAGERS → SPECIALISTS → WORKERS hierarchy
**Why**: Provide clear responsibility separation, enable scalable agent management
**How**: 
- Added `role` field to Agent model with enum-like string values
- Implemented `reportsTo` self-referencing relationship in Prisma schema
- Created role-based UI components with color-coded badges
- Built hierarchical view alongside grid view in agent management
**Impact**: Enabled sophisticated agent fleet organization mirroring enterprise team structures

### 6. Shared Obsidian-Compatible Memory Vault (Approx. 2026-09-01)
**Decision**: Implement persistent markdown-based memory with Wikilink support and 3D visualization
**Why**: Create interoperable, portable knowledge base leveraging popular PKM tool
**How**:
- Store agent outputs as markdown files in `/vault` directory
- Implement bidirectional Wikilink resolution (`[[Note Name]]`)
- Built 3D Knowledge Galaxy using Three.js-inspired visualization
- Added built-in markdown editor for direct vault interaction
**Impact**: Created powerful knowledge management system that integrates with external tools

## Known Issues/Quirks
- [ ] **Galaxy Generation Algorithm**: Potential O(N^2) complexity in galaxy link building (needs investigation per architectural audit)
- [ ] **Large Provider Files**: `provider-selection.ts` (574 lines) and `router-execution.ts` (515 lines) approach upper limit of preferred file size, though they maintain single responsibility
- [ ] **Barrel File Exports**: `llm-router.ts` barrel export may cause unnecessary re-exports; consider explicit exports for better tree-shaking
- [ ] **Browser Storage Limits**: Vault size may eventually exceed practical browser storage limits for purely client-side implementations
- [ ] **Mobile Optimization**: While responsive, some complex interfaces (agent hierarchy, detailed settings) could benefit from mobile-specific optimizations
- [ ] **Real-time Collaboration**: Current implementation lacks real-time sync for multi-user agent fleet management
- [ ] **Backup/Restore**: No automated backup system for SQLite database beyond manual file copying
- [ ] **Internationalization**: UI currently assumes English language; no i18n framework implemented
- [ ] **Accessibility Audit**: While color contrast appears adequate, formal accessibility testing (WCAG) not yet completed
- [ ] **Rate Limiting**: No client-side rate limiting for API keys; relies on provider-side limits

## Immediate Next Steps
- [ ] **Investigate Galaxy Generation Optimization**: Examine `galaxy-generation.ts` to determine if O(N^2) algorithm exists and implement O(N log N) alternative if needed (per audit recommendation)
- [ ] **Consider File Splitting Evaluation**: Monitor large provider files for natural split points as they evolve; split when >600 lines or clear sub-responsibilities emerge
- [ ] **Improve Barrel Exports**: Evaluate converting `llm-router.ts` from barrel pattern to explicit exports where beneficial for tree-shaking
- [ ] **Add Comprehensive Test Suite**: Implement unit and integration tests for core modules (llm-router, context-management, api-middleware)
- [ ] **Enhance Error Reporting**: Add optional detailed error reporting in development mode while maintaining production security
- [ ] **Implement Database Backup**: Add automated backup/restore functionality for SQLite database with cloud sync options
- [ ] **Add Provider Health Checks**: Implement automatic failover and health status indicators for all configured LLM providers
- [ ] **Create Agent Communication Protocols**: Implement standardized messaging between agents for collaborative tasks
- [ ] **Develop Plugin Architecture**: Create system for extending agent capabilities through community-developed plugins
- [ ] **Optimize Build Performance**: Investigate code splitting and lazy loading for initial load time improvement
- [ ] **Add Usage Analytics**: Implement optional, privacy-respecting telemetry to guide future development priorities