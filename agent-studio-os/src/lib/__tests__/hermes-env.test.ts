import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import { getHermesHome, getProfileEnvPath, readEnvFile, writeEnvKey } from '@/lib/hermes-env';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

const originalEnv = process.env;

describe('Hermes Env - Exports', () => {
  it('should export all expected functions', () => {
    expect(typeof getHermesHome).toBe('function');
    expect(typeof getProfileEnvPath).toBe('function');
    expect(typeof readEnvFile).toBe('function');
    expect(typeof writeEnvKey).toBe('function');
  });
});

describe('Hermes Env - Functional Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getHermesHome', () => {
    it('should return HERMES_HOME when set', () => {
      process.env.HERMES_HOME = '/custom/hermes/path';
      expect(getHermesHome()).toBe('/custom/hermes/path');
    });

    it('should return LOCALAPPDATA/hermes on Windows when HERMES_HOME not set', () => {
      delete process.env.HERMES_HOME;
      process.env.LOCALAPPDATA = 'C:\\Windows\\AppData';
      delete process.env.HOME;
      expect(getHermesHome()).toBe(path.join('C:\\Windows\\AppData', 'hermes'));
    });

    it('should return HOME/hermes when HERMES_HOME and LOCALAPPDATA not set', () => {
      delete process.env.HERMES_HOME;
      delete process.env.LOCALAPPDATA;
      process.env.HOME = '/home/user';
      expect(getHermesHome()).toBe(path.join('/home/user', 'hermes'));
    });
  });

  describe('getProfileEnvPath', () => {
    it('should return default .env path when no profile or default profile', () => {
      process.env.HERMES_HOME = '/test/hermes';
      expect(getProfileEnvPath(undefined)).toBe(path.join('/test/hermes', '.env'));
      expect(getProfileEnvPath('')).toBe(path.join('/test/hermes', '.env'));
      expect(getProfileEnvPath('default')).toBe(path.join('/test/hermes', '.env'));
    });

    it('should return profile-specific .env path when profile is provided', () => {
      process.env.HERMES_HOME = '/test/hermes';
      expect(getProfileEnvPath('testProfile')).toBe(
        path.join('/test/hermes', 'profiles', 'testProfile', '.env')
      );
    });
  });

  describe('readEnvFile', () => {
    it('should return empty object for empty file', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('');

      const result = await readEnvFile('/test/path/.env');
      expect(result).toEqual({});
    });

    it('should parse key-value pairs correctly', async () => {
      const envContent = `KEY1=value1
KEY2=value2
# Comment line
KEY3=value3 with spaces
KEY4="quoted value"
KEY5='single quoted value'
KEY6=value with=equals
`;
      vi.mocked(fs.readFile).mockResolvedValue(envContent);

      const result = await readEnvFile('/test/path/.env');

      expect(result).toEqual({
        KEY1: 'value1',
        KEY2: 'value2',
        KEY3: 'value3 with spaces',
        KEY4: 'quoted value',
        KEY5: 'single quoted value',
        KEY6: 'value with=equals',
      });
    });

    it('should handle malformed lines gracefully', async () => {
      const envContent = `KEY1=value1
=no value
KEY2=
KEY3=value3
`;
      vi.mocked(fs.readFile).mockResolvedValue(envContent);

      const result = await readEnvFile('/test/path/.env');

      expect(result).toEqual({
        KEY1: 'value1',
        KEY2: '',
        KEY3: 'value3',
      });
    });

    it('should return empty object when file read fails', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

      const result = await readEnvFile('/nonexistent/path/.env');
      expect(result).toEqual({});
    });
  });

  describe('writeEnvKey', () => {
    it('should update existing key in .env file', async () => {
      const existingContent = `KEY1=old value
KEY2=another value
`;
      vi.mocked(fs.readFile).mockResolvedValue(existingContent);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await writeEnvKey('/test/path/.env', 'KEY1', 'new value');

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/test/path/.env',
        'KEY1=new value\nKEY2=another value\n',
        'utf-8'
      );
    });

    it('should append new key when it does not exist', async () => {
      const existingContent = `KEY1=value1
KEY2=value2
`;
      vi.mocked(fs.readFile).mockResolvedValue(existingContent);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await writeEnvKey('/test/path/.env', 'KEY3', 'value3');

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/test/path/.env',
        'KEY1=value1\nKEY2=value2\nKEY3=value3',
        'utf-8'
      );
    });

    it('should create new .env file when it does not exist', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await writeEnvKey('/test/path/.env', 'KEY1', 'value1');

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/test/path/.env',
        'KEY1=value1',
        'utf-8'
      );
    });

    it('should handle empty file correctly', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('');
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await writeEnvKey('/test/path/.env', 'KEY1', 'value1');

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/test/path/.env',
        'KEY1=value1',
        'utf-8'
      );
    });
  });
});