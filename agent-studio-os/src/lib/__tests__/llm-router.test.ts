import { describe, it, expect } from 'vitest';
import * as llmRouter from '@/lib/llm-router';

describe('LLM Router Facade - Exports', () => {
  it('should export all expected functions and types', () => {
    // Test that the main functions are exported
    expect(typeof llmRouter.normalizeModelName).toBe('function');
    expect(typeof llmRouter.executeChatCompletion).toBe('function');
    expect(typeof llmRouter.testProviderKey).toBe('function');
    expect(typeof llmRouter.getActiveApiKeys).toBe('function');
    expect(typeof llmRouter.invalidateActiveApiKeysCache).toBe('function');
    expect(typeof llmRouter.cleanupExpiredCache).toBe('function');
    expect(typeof llmRouter.checkOmnirouteStatusCached).toBe('function');

    // Test that re-exports work
    expect(typeof llmRouter.buildDefaultSystemPrompt).toBe('function');
    expect(typeof llmRouter.detectPromptIntent).toBe('function');
    expect(typeof llmRouter.trimMessagesToContext).toBe('function');

    expect(typeof llmRouter.BaseLLMProvider).toBe('function');
    expect(typeof llmRouter.GeminiProvider).toBe('function');
    expect(typeof llmRouter.OpenAIProvider).toBe('function');
    expect(typeof llmRouter.GroqProvider).toBe('function');
    expect(typeof llmRouter.AnthropicProvider).toBe('function');
    expect(typeof llmRouter.OmniRouteGatewayProvider).toBe('function');
    expect(typeof llmRouter.OmnirouteLocalProvider).toBe('function');
    expect(Array.isArray(llmRouter.ALL_PROVIDERS)).toBe(true);
  });
});

describe('LLM Router Facade - Functional Tests', () => {
  describe('normalizeModelName', () => {
    it('should return auto/fast for falsy inputs', () => {
      expect(llmRouter.normalizeModelName(null)).toBe('auto/fast');
      expect(llmRouter.normalizeModelName(undefined)).toBe('auto/fast');
      expect(llmRouter.normalizeModelName('')).toBe('auto/fast');
    });

    it('should return auto/fast for specific blacklisted models', () => {
      expect(llmRouter.normalizeModelName('omniroute/owl-alpha')).toBe('auto/fast');
      expect(llmRouter.normalizeModelName('liquid/lfm-2.5-2.6b:free')).toBe('auto/fast');
    });

    it('should return trimmed model name for valid input', () => {
      expect(llmRouter.normalizeModelName('  gpt-4  ')).toBe('gpt-4');
      expect(llmRouter.normalizeModelName('gemini-pro')).toBe('gemini-pro');
    });
  });
});