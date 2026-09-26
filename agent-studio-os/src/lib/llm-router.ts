/**
 * Agent Studio OS — Universal LLM Router Facade
 * 
 * Modular architecture:
 * - router-types.ts: Core interfaces and verified models
 * - context-management.ts: Prompt building, intent detection & sliding window
 * - provider-selection.ts: Strategy pattern provider implementations
 * - router-execution.ts: Completion pipeline, key management & key verification
 */

export type { LLMMessage, LLMResponse, PromptIntent, LLMProvider } from "./router-types";
export { VERIFIED_MODELS } from "./router-types";

export {
  buildDefaultSystemPrompt,
  detectPromptIntent,
  trimMessagesToContext,
} from "./context-management";

export {
  BaseLLMProvider,
  GeminiProvider,
  OpenAIProvider,
  GroqProvider,
  AnthropicProvider,
  OmniRouteGatewayProvider,
  OmnirouteLocalProvider,
  ALL_PROVIDERS,
} from "./provider-selection";

export {
  getActiveApiKeys,
  invalidateActiveApiKeysCache,
  cleanupExpiredCache,
  checkOmnirouteStatusCached,
  normalizeModelName,
  executeChatCompletion,
  testProviderKey,
} from "./router-execution";
