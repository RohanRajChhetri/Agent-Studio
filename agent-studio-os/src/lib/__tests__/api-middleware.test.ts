import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies at top level
vi.mock('@/lib/prisma', () => ({
  prisma: {
    agent: {
      findFirst: vi.fn()
    },
    chatSession: {
      findFirst: vi.fn(),
      create: vi.fn()
    },
    chatMessage: {
      create: vi.fn()
    }
  }
}));

// Import after mocking
import * as apiMiddleware from '@/lib/api-middleware';

describe('API Middleware - Exports', () => {
  it('should export all expected functions', () => {
    // Test that the main functions are exported
    expect(typeof apiMiddleware.resolveAgentAndSession).toBe('function');
    expect(typeof apiMiddleware.persistChatMessages).toBe('function');
    expect(typeof apiMiddleware.formatApiResponse).toBe('function');
    expect(typeof apiMiddleware.handleApiError).toBe('function');
  });
});

describe('API Middleware - Functional Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleApiError', () => {
    it('should return formatted error response', async () => {
      const error = new Error('Test error');
      const result = await apiMiddleware.handleApiError(error, 'TestContext', 'User error message', 400);

      // NextResponse.json() returns a Response object, we need to parse the body
      const body = await result.json();

      expect(result.status).toBe(400);
      expect(body).toHaveProperty('error', 'User error message');
      expect(body).toHaveProperty('response', 'Test error');
    });

    it('should use default values when not provided', async () => {
      const error = new Error('Test error');
      const result = await apiMiddleware.handleApiError(error);

      // NextResponse.json() returns a Response object, we need to parse the body
      const body = await result.json();

      expect(result.status).toBe(500);
      expect(body).toHaveProperty('error', 'Failed to process request');
      expect(body).toHaveProperty('response', 'Test error');
    });
  });

  describe('formatApiResponse', () => {
    it('should format a successful response', async () => {
      const mockResult = {
        content: 'Test response',
        latency: 100,
        source: 'openai' as const,
        modelUsed: 'test-model',
        ragCitations: [],
        toolCalls: []
      };

      const result = await apiMiddleware.formatApiResponse({
        result: mockResult,
        effectiveModel: 'test-model'
      });

      // NextResponse.json() returns a Response object, we need to parse the body
      const body = await result.json();

      expect(result.status).toBe(200);
      expect(body).toHaveProperty('response', 'Test response');
      expect(body).toHaveProperty('latency', 100);
      expect(body).toHaveProperty('model', 'test-model');
    });
  });
});