import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hermesExec } from '@/lib/hermes-exec';
import * as hermesTools from '@/lib/hermes-tools';

// Mock the hermes-exec module directly
vi.mock('@/lib/hermes-exec', () => ({
  hermesExec: vi.fn()
}));

describe('Hermes Tools - Exports', () => {
  it('should export all expected functions', () => {
    // Test that the main functions are exported
    expect(typeof hermesTools.enableTool).toBe('function');
    expect(typeof hermesTools.disableTool).toBe('function');
    expect(typeof hermesTools.listTools).toBe('function');
  });
});

describe('Hermes Tools - Functional Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('enableTool', () => {
    it('should call hermesExec with correct arguments', async () => {
      // Mock the hermesExec function to return a resolved promise
      // Access the mock directly from the mocked module
      const mockHermesExec = vi.mocked(hermesExec);
      mockHermesExec.mockResolvedValue({ stdout: 'tool enabled successfully', stderr: '' });

      await hermesTools.enableTool('test-tool');

      // Verify hermesExec was called with correct arguments
      expect(mockHermesExec).toHaveBeenCalledWith(`tools enable test-tool --platform cli`, undefined);
    });

    it('should call hermesExec with profile when provided', async () => {
      // Mock the hermesExec function to return a resolved promise
      const mockHermesExec = vi.mocked(hermesExec);
      mockHermesExec.mockResolvedValue({ stdout: 'tool enabled successfully', stderr: '' });

      await hermesTools.enableTool('test-tool', 'testProfile');

      // Verify hermesExec was called with correct arguments including profile
      expect(mockHermesExec).toHaveBeenCalledWith(`tools enable test-tool --platform cli`, 'testProfile');
    });

    it('should return trimmed stdout', async () => {
      // Mock the hermesExec function to return a resolved promise with whitespace
      const mockHermesExec = vi.mocked(hermesExec);
      mockHermesExec.mockResolvedValue({ stdout: '  tool enabled with spaces  \n', stderr: '' });

      const result = await hermesTools.enableTool('test-tool');

      expect(result).toBe('tool enabled with spaces');
    });
  });

  describe('disableTool', () => {
    it('should call hermesExec with correct arguments', async () => {
      // Mock the hermesExec function to return a resolved promise
      const mockHermesExec = vi.mocked(hermesExec);
      mockHermesExec.mockResolvedValue({ stdout: 'tool disabled successfully', stderr: '' });

      await hermesTools.disableTool('test-tool');

      // Verify hermesExec was called with correct arguments
      expect(mockHermesExec).toHaveBeenCalledWith(`tools disable test-tool --platform cli`, undefined);
    });

    it('should call hermesExec with profile when provided', async () => {
      // Mock the hermesExec function to return a resolved promise
      const mockHermesExec = vi.mocked(hermesExec);
      mockHermesExec.mockResolvedValue({ stdout: 'tool disabled successfully', stderr: '' });

      await hermesTools.disableTool('test-tool', 'testProfile');

      // Verify hermesExec was called with correct arguments including profile
      expect(mockHermesExec).toHaveBeenCalledWith(`tools disable test-tool --platform cli`, 'testProfile');
    });

    it('should return trimmed stdout', async () => {
      // Mock the hermesExec function to return a resolved promise with whitespace
      const mockHermesExec = vi.mocked(hermesExec);
      mockHermesExec.mockResolvedValue({ stdout: '  tool disabled with spaces  \n', stderr: '' });

      const result = await hermesTools.disableTool('test-tool');

      expect(result).toBe('tool disabled with spaces');
    });
  });

  describe('listTools', () => {
    it('should call hermesExec with correct arguments', async () => {
      // Mock the hermesExec function to return a resolved promise
      const mockHermesExec = vi.mocked(hermesExec);
      mockHermesExec.mockResolvedValue({ stdout: '✓ enabled tool1\n✗ disabled tool2\n', stderr: '' });

      await hermesTools.listTools();

      // Verify hermesExec was called with correct arguments
      expect(mockHermesExec).toHaveBeenCalledWith(`tools list`, undefined);
    });

    it('should call hermesExec with profile when provided', async () => {
      // Mock the hermesExec function to return a resolved promise
      const mockHermesExec = vi.mocked(hermesExec);
      mockHermesExec.mockResolvedValue({ stdout: '✓ enabled tool1\n✗ disabled tool2\n', stderr: '' });

      await hermesTools.listTools('testProfile');

      // Verify hermesExec was called with correct arguments including profile
      expect(mockHermesExec).toHaveBeenCalledWith(`tools list`, 'testProfile');
    });

    it('should parse tools output correctly', async () => {
      // Mock the hermesExec function to return a resolved promise with sample output
      const mockHermesExec = vi.mocked(hermesExec);
      mockHermesExec.mockResolvedValue({
        stdout: `✓ enabled tool1\n✗ disabled tool2\n  some other line without match\n✓ enabled another-tool\n`,
        stderr: ''
      });

      const result = await hermesTools.listTools();

      // Verify result is parsed correctly
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3); // Only 3 matching lines

      // Check first tool
      expect(result[0]).toEqual({
        id: 'tool1',
        enabled: true,
        label: 'tool1'
      });

      // Check second tool
      expect(result[1]).toEqual({
        id: 'tool2',
        enabled: false,
        label: 'tool2'
      });

      // Check third tool
      expect(result[2]).toEqual({
        id: 'another-tool',
        enabled: true,
        label: 'another-tool'
      });
    });

    it('should return empty array when no matches', async () => {
      // Mock the hermesExec function to return a resolved promise with no matching lines
      const mockHermesExec = vi.mocked(hermesExec);
      mockHermesExec.mockResolvedValue({ stdout: 'some random output\nwithout matches\n', stderr: '' });

      const result = await hermesTools.listTools();

      expect(result).toEqual([]);
    });

    it('should return trimmed stdout when hermesExec succeeds', async () => {
      // This test is actually covered by the parse test above, but keeping for clarity
      const mockHermesExec = vi.mocked(hermesExec);
      mockHermesExec.mockResolvedValue({ stdout: '✓ enabled tool1\n✗ disabled tool2\n', stderr: '' });

      const result = await hermesTools.listTools();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });
  });
});