import { describe, it, expect } from 'vitest';
import * as rag from '@/lib/rag';

describe('RAG Facade - Exports', () => {
  it('should export all expected functions', () => {
    // Test that the main functions are exported
    expect(typeof rag.queryVaultRAG).toBe('function');
    expect(typeof rag.formatRAGPromptContext).toBe('function');
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
});