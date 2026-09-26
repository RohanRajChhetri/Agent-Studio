import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the hermes-exec module directly
vi.mock('@/lib/hermes-exec', () => ({
  hermesExec: vi.fn()
}));

// Import after mocking
import * as hermes from '@/lib/hermes';

describe('Hermes Agent CLI Facade - Exports', () => {
  it('should export all expected functions', () => {
    // Test that the main functions are exported
    expect(typeof hermes.setConfig).toBe('function');
    expect(typeof hermes.runOneshot).toBe('function');
    expect(typeof hermes.tailLogs).toBe('function');

    // Test that re-exports work
    expect(typeof hermes.hermesExec).toBe('function');
    expect(typeof hermes.getHermesHome).toBe('function');
    expect(typeof hermes.getProfileEnvPath).toBe('function');
    expect(typeof hermes.readEnvFile).toBe('function');
    expect(typeof hermes.writeEnvKey).toBe('function');
    expect(typeof hermes.invalidateProfileCache).toBe('function');
    expect(typeof hermes.listProfiles).toBe('function');
    expect(typeof hermes.createProfile).toBe('function');
    expect(typeof hermes.deleteProfile).toBe('function');
    expect(typeof hermes.showProfile).toBe('function');
    expect(typeof hermes.describeProfile).toBe('function');
    expect(typeof hermes.exportProfile).toBe('function');
    expect(typeof hermes.getProfileNames).toBe('function');
    expect(typeof hermes.enableTool).toBe('function');
    expect(typeof hermes.disableTool).toBe('function');
    expect(typeof hermes.listTools).toBe('function');
  });
});

describe('Hermes Agent CLI Facade - Functional Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('setConfig', () => {
    it('should call hermesExec with correct arguments', async () => {
      // Mock the hermesExec function to return a resolved promise
      vi.mocked(hermes.hermesExec).mockResolvedValue({ stdout: 'config set successfully', stderr: '' });

      await hermes.setConfig('testKey', 'testValue');

      // Verify hermesExec was called with correct arguments (without "hermes" prefix)
      expect(hermes.hermesExec).toHaveBeenCalledWith(`config set testKey "testValue"`, undefined);
    });

    it('should call hermesExec with profile when provided', async () => {
      // Mock the hermesExec function to return a resolved promise
      vi.mocked(hermes.hermesExec).mockResolvedValue({ stdout: 'config set successfully', stderr: '' });

      await hermes.setConfig('testKey', 'testValue', 'testProfile');

      // Verify hermesExec was called with correct arguments including profile
      expect(hermes.hermesExec).toHaveBeenCalledWith(`config set testKey "testValue"`, 'testProfile');
    });

    it('should return trimmed stdout', async () => {
      // Mock the hermesExec function to return a resolved promise with whitespace
      vi.mocked(hermes.hermesExec).mockResolvedValue({ stdout: '  config value with spaces  \n', stderr: '' });

      const result = await hermes.setConfig('testKey', 'testValue');

      expect(result).toBe('config value with spaces');
    });
  });

  describe('runOneshot', () => {
    it('should call hermesExec with correct arguments for basic prompt', async () => {
      // Mock the hermesExec function to return a resolved promise
      vi.mocked(hermes.hermesExec).mockResolvedValue({ stdout: 'AI response', stderr: '' });

      await hermes.runOneshot('Hello world');

      // Verify hermesExec was called with correct arguments (without "hermes" prefix)
      expect(hermes.hermesExec).toHaveBeenCalledWith(`-z \"Hello world\"`, undefined, 120000);
    });

    it('should call hermesExec with model option', async () => {
      // Mock the hermesExec function to return a resolved promise
      vi.mocked(hermes.hermesExec).mockResolvedValue({ stdout: 'AI response', stderr: '' });

      await hermes.runOneshot('Hello world', { model: 'gpt-4' });

      // Verify hermesExec was called with correct arguments including model
      expect(hermes.hermesExec).toHaveBeenCalledWith(`-z \"Hello world\" -m gpt-4`, undefined, 120000);
    });

    it('should call hermesExec with toolsets option', async () => {
      // Mock the hermesExec function to return a resolved promise
      vi.mocked(hermes.hermesExec).mockResolvedValue({ stdout: 'AI response', stderr: '' });

      await hermes.runOneshot('Hello world', { toolsets: 'web-search,file-read' });

      // Verify hermesExec was called with correct arguments including toolsets
      expect(hermes.hermesExec).toHaveBeenCalledWith(`-z \"Hello world\" -t web-search,file-read`, undefined, 120000);
    });

    it('should call hermesExec with profile when provided', async () => {
      // Mock the hermesExec function to return a resolved promise
      vi.mocked(hermes.hermesExec).mockResolvedValue({ stdout: 'AI response', stderr: '' });

      await hermes.runOneshot('Hello world', { profile: 'testProfile' });

      // Verify hermesExec was called with correct arguments including profile
      expect(hermes.hermesExec).toHaveBeenCalledWith(`-z \"Hello world\"`, 'testProfile', 120000);
    });

    it('should escape quotes in prompt', async () => {
      // Mock the hermesExec function to return a resolved promise
      vi.mocked(hermes.hermesExec).mockResolvedValue({ stdout: 'AI response', stderr: '' });

      await hermes.runOneshot('Say "hello world"');

      // Verify hermesExec was called with escaped quotes
      expect(hermes.hermesExec).toHaveBeenCalledWith(`-z \"Say \\"hello world\\"\"`, undefined, 120000);
    });

    it('should return trimmed stdout', async () => {
      // Mock the hermesExec function to return a resolved promise with whitespace
      vi.mocked(hermes.hermesExec).mockResolvedValue({ stdout: '  AI response with spaces  \n', stderr: '' });

      const result = await hermes.runOneshot('Hello world');

      expect(result).toBe('AI response with spaces');
    });
  });

  describe('tailLogs', () => {
    it('should call hermesExec with correct arguments', async () => {
      // Mock the hermesExec function to return a resolved promise
      vi.mocked(hermes.hermesExec).mockResolvedValue({ stdout: 'log line 1\nlog line 2\n', stderr: '' });

      await hermes.tailLogs();

      // Verify hermesExec was called with correct arguments (without "hermes" prefix)
      expect(hermes.hermesExec).toHaveBeenCalledWith(`logs -n 50`, undefined, 10000);
    });

    it('should call hermesExec with custom lines count', async () => {
      // Mock the hermesExec function to return a resolved promise
      vi.mocked(hermes.hermesExec).mockResolvedValue({ stdout: 'log line\n', stderr: '' });

      await hermes.tailLogs(undefined, 100);

      // Verify hermesExec was called with correct arguments
      expect(hermes.hermesExec).toHaveBeenCalledWith(`logs -n 100`, undefined, 10000);
    });

    it('should call hermesExec with profile when provided', async () => {
      // Mock the hermesExec function to return a resolved promise
      vi.mocked(hermes.hermesExec).mockResolvedValue({ stdout: 'log line\n', stderr: '' });

      await hermes.tailLogs('testProfile');

      // Verify hermesExec was called with correct arguments including profile
      expect(hermes.hermesExec).toHaveBeenCalledWith(`logs -n 50`, 'testProfile', 10000);
    });

    it('should return stdout when hermesExec succeeds', async () => {
      // Mock the hermesExec function to return a resolved promise
      vi.mocked(hermes.hermesExec).mockResolvedValue({ stdout: 'log line 1\nlog line 2\n', stderr: '' });

      const result = await hermes.tailLogs();

      expect(result).toBe('log line 1\nlog line 2\n');
    });

    it('should return default message when hermesExec fails', async () => {
      // Mock the hermesExec function to return a rejected promise
      vi.mocked(hermes.hermesExec).mockRejectedValue(new Error('Hermes not found'));

      const result = await hermes.tailLogs();

      expect(result).toBe('No logs available.');
    });
  });
});