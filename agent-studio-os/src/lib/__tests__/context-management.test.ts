import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LLMMessage } from '@/lib/router-types';
import * as contextMgmt from '@/lib/context-management';

describe('Context Management - Functional Tests', () => {
  // Mock date for consistent testing
  const fixedDate = new Date('2023-01-01T00:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getExcellenceCore', () => {
    it('should return formatted excellence core string', () => {
      const result = contextMgmt.getExcellenceCore('TestAgent', 'tester');
      expect(result).toContain('You are TestAgent, an elite tester');
      expect(result).toContain('Deliver exceptional, top-tier responses');
    });
  });

  describe('getRoleDirective', () => {
    it('should return directive for matching agent name', () => {
      const result = contextMgmt.getRoleDirective('nomanSpecialist', 'anyRole');
      expect(result).toContain('Senior Full-Stack Software Engineering');
    });

    it('should return directive for matching role', () => {
      const result = contextMgmt.getRoleDirective('anyAgent', 'workerRole');
      expect(result).toContain('Senior Full-Stack Software Engineering');
    });

    it('should return default directive when no match', () => {
      const result = contextMgmt.getRoleDirective('unknownAgent', 'unknownRole');
      expect(result).toContain('Autonomous Problem Solving & Executive Systems Orchestration');
    });
  });

  describe('buildDefaultSystemPrompt', () => {
    it('should build prompt with excellence core and role directive', () => {
      const result = contextMgmt.buildDefaultSystemPrompt({
        agentName: 'TestAgent',
        role: 'tester'
      });

      expect(result).toContain('You are TestAgent, an elite tester');
      expect(result).toContain('[SPECIALIST DIRECTIVES]');
    });

    it('should include custom system prompt when provided and long enough', () => {
      const customPrompt = 'This is a very long custom system prompt that should be included because it exceeds fifty characters in length';
      const result = contextMgmt.buildDefaultSystemPrompt({
        agentName: 'TestAgent',
        role: 'tester',
        systemPrompt: customPrompt
      });

      expect(result).toContain(customPrompt);
      expect(result).toContain('[SPECIALIST DIRECTIVES & PERSONA]');
    });

    it('should not include custom system prompt when too short but add as additional guidance', () => {
      const customPrompt = 'Short';
      const result = contextMgmt.buildDefaultSystemPrompt({
        agentName: 'TestAgent',
        role: 'tester',
        systemPrompt: customPrompt
      });

      expect(result).toContain('Additional Guidance: Short');
      expect(result).not.toContain('[SPECIALIST DIRECTIVES & PERSONA]');
      expect(result).toContain('[SPECIALIST DIRECTIVES]');
    });
  });

  describe('detectPromptIntent', () => {
    it('should detect coding intent', () => {
      const result = contextMgmt.detectPromptIntent('How do I fix this bug in my code?');
      expect(result).toBe('coding');
    });

    it('should detect reasoning intent', () => {
      const result = contextMgmt.detectPromptIntent('Why does this algorithm work?');
      expect(result).toBe('reasoning');
    });

    it('should detect creative intent', () => {
      const result = contextMgmt.detectPromptIntent('Write a story about a hero');
      expect(result).toBe('creative');
    });

    it('should default to chat for unrecognized intent', () => {
      const result = contextMgmt.detectPromptIntent('Hello, how are you?');
      expect(result).toBe('chat');
    });

    it('should handle empty prompt', () => {
      const result = contextMgmt.detectPromptIntent('');
      expect(result).toBe('chat');
    });
  });

  describe('prepareMessages', () => {
    it('should prepare messages with system prompt and history', () => {
      const systemPrompt = 'You are a helpful assistant';
      const history: LLMMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ];
      const prompt = 'How are you?';

      const result = contextMgmt.prepareMessages(prompt, systemPrompt, history);

      expect(result).toHaveLength(4);
      expect(result[0]).toEqual({ role: 'system', content: systemPrompt });
      expect(result[1]).toEqual({ role: 'user', content: 'Hello' });
      expect(result[2]).toEqual({ role: 'assistant', content: 'Hi there!' });
      expect(result[3]).toEqual({ role: 'user', content: prompt });
    });

    it('should prepare messages with just prompt', () => {
      const prompt = 'Hello world';
      const result = contextMgmt.prepareMessages(prompt);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ role: 'user', content: prompt });
    });

    it('should filter out empty history messages', () => {
      const history: LLMMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: '' },
        { role: 'user', content: 'How are you?' }
      ];
      const prompt = 'Testing';

      const result = contextMgmt.prepareMessages(prompt, undefined, history);

      expect(result).toHaveLength(3); // system not included, empty message filtered out
      expect(result[0]).toEqual({ role: 'user', content: 'Hello' });
      expect(result[1]).toEqual({ role: 'user', content: 'How are you?' });
      expect(result[2]).toEqual({ role: 'user', content: prompt });
    });
  });

  describe('trimMessagesToContext', () => {
    it('should return messages as-is when under limit', () => {
      const messages: LLMMessage[] = [
        { role: 'system', content: 'System' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' }
      ];

      const result = contextMgmt.trimMessagesToContext(messages, 12000);
      expect(result).toEqual(messages);
    });

    it('should handle various message counts correctly', () => {
      // Test with 0 messages
      expect(contextMgmt.trimMessagesToContext([])).toEqual([]);

      // Test with 1 message
      const singleMsg: LLMMessage[] = [{ role: 'user', content: 'Hello' }];
      expect(contextMgmt.trimMessagesToContext(singleMsg)).toEqual(singleMsg);

      // Test with 6 messages (boundary where trimming might start)
      const sixMessages: LLMMessage[] = Array.from({ length: 6 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`
      }));
      const resultSix = contextMgmt.trimMessagesToContext(sixMessages, 1000);
      expect(resultSix.length).toBeGreaterThan(0);
      expect(resultSix.length).toBeLessThanOrEqual(6);

      // Test with system message
      const messagesWithSystem: LLMMessage[] = [
        { role: 'system', content: 'System instructions' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' }
      ];
      const resultWithSystem = contextMgmt.trimMessagesToContext(messagesWithSystem, 1000);
      expect(resultWithSystem.length).toBeGreaterThan(0);
      expect(resultWithSystem[0]?.role).toBe('system');
    });
  });
});