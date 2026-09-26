import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const originalEnv = { ...process.env };

let mockExecResult: { error?: any; stdout?: string; stderr?: string } = {
  stdout: 'test output',
  stderr: '',
};

vi.mock('child_process', () => ({
  exec: vi.fn((cmd: string, options: any, callback?: any) => {
    const cb = typeof options === 'function' ? options : callback;
    if (mockExecResult.error) {
      if (cb) cb(mockExecResult.error, null);
    } else {
      if (cb) cb(null, { stdout: mockExecResult.stdout ?? '', stderr: mockExecResult.stderr ?? '' });
    }
  }),
}));

import { exec } from 'child_process';
import { hermesExec } from '@/lib/hermes-exec';

describe('Hermes Exec - Exports', () => {
  it('should export hermesExec function', () => {
    expect(typeof hermesExec).toBe('function');
  });
});

describe('Hermes Exec - Functional Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    mockExecResult = { stdout: 'test output', stderr: '' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('hermesExec', () => {
    it('should call exec with correct parameters and return result', async () => {
      mockExecResult = { stdout: 'test output', stderr: '' };

      const result = await hermesExec('test arg', 'testProfile', 15000);

      expect(exec).toHaveBeenCalledWith(
        'hermes test arg',
        expect.objectContaining({
          env: expect.objectContaining({ HERMES_PROFILE: 'testProfile' }),
          timeout: 15000,
          windowsHide: true,
        }),
        expect.any(Function)
      );

      expect(result).toEqual({ stdout: 'test output', stderr: '' });
    });

    it('should use default timeout when not provided', async () => {
      mockExecResult = { stdout: 'test output', stderr: '' };

      await hermesExec('test arg');

      expect(exec).toHaveBeenCalledWith(
        'hermes test arg',
        expect.objectContaining({
          timeout: 30000,
          windowsHide: true,
        }),
        expect.any(Function)
      );
    });

    it('should not set HERMES_PROFILE when profile is not provided', async () => {
      mockExecResult = { stdout: 'test output', stderr: '' };

      await hermesExec('test arg');

      const callArgs = vi.mocked(exec).mock.calls[0];
      const options = callArgs[1] as any;
      expect(options.env.HERMES_PROFILE).toBeUndefined();
    });

    it('should set HERMES_PROFILE when profile is provided', async () => {
      mockExecResult = { stdout: 'test output', stderr: '' };

      await hermesExec('test arg', 'myProfile');

      const callArgs = vi.mocked(exec).mock.calls[0];
      const options = callArgs[1] as any;
      expect(options.env.HERMES_PROFILE).toBe('myProfile');
    });

    it('should throw formatted error when exec fails', async () => {
      mockExecResult = {
        error: { stderr: 'Command not found', message: 'unknown error' },
      };

      await expect(hermesExec('test arg')).rejects.toThrow(
        'Hermes CLI error: Command not found'
      );
    });

    it('should throw formatted error with message when stderr is empty', async () => {
      mockExecResult = {
        error: { stderr: '', message: 'Something went wrong' },
      };

      await expect(hermesExec('test arg')).rejects.toThrow(
        'Hermes CLI error: Something went wrong'
      );
    });

    it('should throw formatted error with default message when both stderr and message are empty', async () => {
      mockExecResult = {
        error: { stderr: '', message: '' },
      };

      await expect(hermesExec('test arg')).rejects.toThrow(
        'Hermes CLI error: Unknown error'
      );
    });
  });
});