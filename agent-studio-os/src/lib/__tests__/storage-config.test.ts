import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getDefaultOutputDir,
  getDefaultVaultDir,
  getAIOutputDir,
  getActiveVaultPath,
  getCodeOutputDir,
  getScreenshotsOutputDir,
  getFilesOutputDir,
  getStorageConfig,
  updateStorageConfig,
  saveAIOutputArtifact,
} from "@/lib/storage-config";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";

const dbSettings = new Map<string, string>();

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: {
      findUnique: vi.fn().mockImplementation(({ where }) => {
        const val = dbSettings.get(where.key);
        return Promise.resolve(val !== undefined ? { key: where.key, value: val } : null);
      }),
      upsert: vi.fn().mockImplementation(({ create, update }) => {
        const val = update?.value || create?.value;
        const key = create?.key;
        dbSettings.set(key, val);
        return Promise.resolve({ key, value: val });
      }),
    },
  },
}));

describe("Storage Configuration Engine", () => {
  it("provides valid default output directory and vault directory", () => {
    const out = getDefaultOutputDir();
    const vault = getDefaultVaultDir();

    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
    expect(typeof vault).toBe("string");
    expect(vault.length).toBeGreaterThan(0);
  });

  it("calculates correct subfolder paths for code, screenshots, and files", () => {
    const out = getAIOutputDir();
    const code = getCodeOutputDir();
    const screens = getScreenshotsOutputDir();
    const files = getFilesOutputDir();

    expect(code).toBe(path.join(out, "code"));
    expect(screens).toBe(path.join(out, "screenshots"));
    expect(files).toBe(path.join(out, "files"));
  });

  it("loads storage config with default paths when settings are not yet saved", async () => {
    const config = await getStorageConfig();
    expect(config).toBeDefined();
    expect(config.outputDir).toBeDefined();
    expect(config.vaultDir).toBeDefined();
    expect(config.codeDir).toBeDefined();
    expect(config.screenshotsDir).toBeDefined();
    expect(config.filesDir).toBeDefined();
    expect(config.stats).toBeDefined();
  });

  it("updates storage config and updates synchronous getters", async () => {
    const testOut = path.join(process.cwd(), "scratch", "test-ai-output");
    const testVault = path.join(process.cwd(), "scratch", "test-vault");

    const updated = await updateStorageConfig({
      outputDir: testOut,
      vaultDir: testVault,
    });

    expect(updated.outputDir).toBe(testOut);
    expect(updated.vaultDir).toBe(testVault);
    expect(getAIOutputDir()).toBe(testOut);
    expect(getActiveVaultPath()).toBe(testVault);
    expect(getCodeOutputDir()).toBe(path.join(testOut, "code"));
  });

  it("saves AI output artifact to configured subdirectories", async () => {
    const testOut = path.join(process.cwd(), "scratch", "test-ai-output");
    await updateStorageConfig({ outputDir: testOut });

    const codeArtifact = await saveAIOutputArtifact({
      type: "code",
      fileName: "calculator.py",
      content: "print('hello')",
    });

    expect(codeArtifact.filePath).toBe(path.join(testOut, "code", "calculator.py"));
    expect(existsSync(codeArtifact.filePath)).toBe(true);

    const content = await fs.readFile(codeArtifact.filePath, "utf-8");
    expect(content).toBe("print('hello')");

    // Clean up scratch file
    try {
      await fs.unlink(codeArtifact.filePath);
    } catch {}
  });
});
