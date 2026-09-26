import { describe, it, expect } from 'vitest';
import * as providerSelection from '@/lib/provider-selection';

describe('Provider Selection - Exports', () => {
  it('should export all expected providers', () => {
    // Test that the main providers are exported
    expect(typeof providerSelection.BaseLLMProvider).toBe('function');
    expect(typeof providerSelection.GeminiProvider).toBe('function');
    expect(typeof providerSelection.OpenAIProvider).toBe('function');
    expect(typeof providerSelection.GroqProvider).toBe('function');
    expect(typeof providerSelection.AnthropicProvider).toBe('function');
    expect(typeof providerSelection.OmniRouteGatewayProvider).toBe('function');
    expect(typeof providerSelection.OmnirouteLocalProvider).toBe('function');

    // Test that ALL_PROVIDERS is exported and is an array
    expect(Array.isArray(providerSelection.ALL_PROVIDERS)).toBe(true);
    expect(providerSelection.ALL_PROVIDERS.length).toBeGreaterThan(0);
  });
});

describe('Provider Selection - Functional Tests', () => {
  describe('ALL_PROVIDERS', () => {
    it('should contain instantiated providers', () => {
      const providers = providerSelection.ALL_PROVIDERS;

      // Should have 6 providers as defined in the file
      expect(providers.length).toBe(6);

      // Each provider should be an instance of BaseLLMProvider
      providers.forEach(provider => {
        expect(provider).toBeInstanceOf(providerSelection.BaseLLMProvider);
      });
    });

    it('should contain specific provider types', () => {
      const providers = providerSelection.ALL_PROVIDERS;

      // Check that we have the expected provider types
      const providerTypes = providers.map(p => p.constructor.name);
      expect(providerTypes).toContain('GeminiProvider');
      expect(providerTypes).toContain('OpenAIProvider');
      expect(providerTypes).toContain('GroqProvider');
      expect(providerTypes).toContain('AnthropicProvider');
      expect(providerTypes).toContain('OmniRouteGatewayProvider');
      expect(providerTypes).toContain('OmnirouteLocalProvider');
    });
  });
});