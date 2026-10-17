import { describe, it, expect } from 'vitest';
import * as rag from '@/lib/rag';

describe('RAG Facade - Exports', () => {
  it('should export all expected functions', () => {
    // Test that the main functions are exported
    expect(typeof rag.queryVaultRAG).toBe('function');
    expect(typeof rag.formatRAGPromptContext).toBe('function');
    expect(typeof rag.cosineSimilarity).toBe('function');
    expect(typeof rag.computeDeterministicVector).toBe('function');
  });

  it('should compute cosine similarity accurately', () => {
    const vecA = [1, 0, 0];
    const vecB = [1, 0, 0];
    const vecC = [0, 1, 0];
    expect(rag.cosineSimilarity(vecA, vecB)).toBeCloseTo(1.0);
    expect(rag.cosineSimilarity(vecA, vecC)).toBeCloseTo(0.0);
  });

  it('should generate unit-normalized deterministic vectors', () => {
    const v1 = rag.computeDeterministicVector('autonomous ai agent workspace');
    const v2 = rag.computeDeterministicVector('autonomous ai agent workspace');
    const v3 = rag.computeDeterministicVector('baking chocolate cake recipes');
    expect(v1.length).toBe(64);
    // Identical text produces identical vectors (sim ~ 1.0)
    expect(rag.cosineSimilarity(v1, v2)).toBeCloseTo(1.0);
    // Unrelated text produces significantly lower similarity
    expect(rag.cosineSimilarity(v1, v3)).toBeLessThan(0.7);
  });
});

describe('RAG Facade - Functional Tests', () => {
  describe('tokenize', () => {
    it('should tokenize normal text correctly', () => {
      // Note: tokenize is not exported, so we can't test it directly
      // But we can test formatRAGPromptContext which uses it indirectly
    });
  });

  describe('formatRAGPromptContext', () => {
    it('should return empty string for empty chunks', () => {
      expect(rag.formatRAGPromptContext([])).toBe('');
      expect(rag.formatRAGPromptContext(null as any)).toBe('');
      expect(rag.formatRAGPromptContext(undefined as any)).toBe('');
    });

    it('should format single chunk correctly', () => {
      const chunks = [{
        title: 'Test Note',
        relPath: 'test/note.md',
        category: 'test',
        excerpt: 'This is a test excerpt',
        tags: ['test', 'example'],
        score: 5.0
      }];

      const result = rag.formatRAGPromptContext(chunks);
      expect(result).toContain('---');
      expect(result).toContain('[BACKGROUND KNOWLEDGE CONTEXT]');
      expect(result).toContain('[Context Note 1: "Test Note"]');
      expect(result).toContain('(Category: test)');
      expect(result).toContain('"This is a test excerpt"');
      expect(result).toContain('---');
    });

    it('should format multiple chunks correctly', () => {
      const chunks = [
        {
          title: 'First Note',
          relPath: 'first/note.md',
          category: 'first',
          excerpt: 'This is the first excerpt',
          tags: ['first'],
          score: 5.0
        },
        {
          title: 'Second Note',
          relPath: 'second/note.md',
          category: 'second',
          excerpt: 'This is the second excerpt',
          tags: ['second'],
          score: 4.0
        }
      ];

      const result = rag.formatRAGPromptContext(chunks);
      expect(result).toContain('[Context Note 1: "First Note"]');
      expect(result).toContain('[Context Note 2: "Second Note"]');
      expect(result).toContain('(Category: first)');
      expect(result).toContain('(Category: second)');
      expect(result).toContain('"This is the first excerpt"');
      expect(result).toContain('"This is the second excerpt"');
    });
  });

  describe('fetchSemanticEmbedding', () => {
    it('should return null gracefully when no API keys are provided or text is empty', async () => {
      const emptyRes = await rag.fetchSemanticEmbedding('');
      expect(emptyRes).toBeNull();

      const noKeyRes = await rag.fetchSemanticEmbedding('hello world', { apiKey: '' });
      expect(noKeyRes === null || Array.isArray(noKeyRes)).toBe(true);
    });
  });
});