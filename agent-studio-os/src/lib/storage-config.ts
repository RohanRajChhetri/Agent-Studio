import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { spawn } from "child_process";
import { prisma } from "@/lib/prisma";

export const STORAGE_KEY_OUTPUT_DIR = "storage_ai_output_dir";
export const STORAGE_KEY_VAULT_DIR = "storage_obsidian_vault_dir";
export const STORAGE_KEY_CODE_DIR = "storage_code_output_dir";
export const STORAGE_KEY_SCREENSHOTS_DIR = "storage_screenshots_output_dir";
export const STORAGE_KEY_FILES_DIR = "storage_files_output_dir";

/**
 * Returns default root output directory for AI deliverables
 */
export function getDefaultOutputDir(): string {
  if (process.env.AI_OUTPUT_PATH) {
    return path.resolve(process.env.AI_OUTPUT_PATH);
  }
  const userHome = process.env.USERPROFILE || process.env.HOME || "";
  if (userHome) {
    return path.join(userHome, "AgentStudio-Output");
  }
  return path.join(process.cwd(), "agent-workspace", "output");
}

/**
 * Returns default Obsidian vault path
 */
export function getDefaultVaultDir(): string {
  if (process.env.OBSIDIAN_VAULT_PATH) {
    return path.resolve(process.env.OBSIDIAN_VAULT_PATH);
  }
  const userHome = process.env.USERPROFILE || process.env.HOME || "";
  if (userHome) {
    return path.join(userHome, "agent-studio", "memory");
  }
  return path.join(process.cwd(), "agent-workspace", "memory");
}

// In-memory cache for synchronous access
let cachedOutputDir: string | null = null;
let cachedVaultDir: string | null = null;
let cachedCodeDir: string | null = null;
let cachedScreenshotsDir: string | null = null;
let cachedFilesDir: string | null = null;

export interface StorageConfig {
  outputDir: string;
  vaultDir: string;
  codeDir: string;
  screenshotsDir: string;
  filesDir: string;
  outputDirExists: boolean;
  vaultDirExists: boolean;
  stats?: {
    codeFilesCount: number;
    screenshotsCount: number;
    documentsCount: number;
    vaultNotesCount: number;
    totalSizeBytes: number;
  };
}

/**
 * Synchronous getter for the active master output directory
 */
export function getAIOutputDir(): string {
  return cachedOutputDir || getDefaultOutputDir();
}

/**
 * Synchronous getter for the active Obsidian vault directory
 */
export function getActiveVaultPath(): string {
  return cachedVaultDir || getDefaultVaultDir();
}

/**
 * Synchronous getter for the code output directory
 */
export function getCodeOutputDir(): string {
  return cachedCodeDir || path.join(getAIOutputDir(), "code");
}

/**
 * Synchronous getter for the screenshots output directory
 */
export function getScreenshotsOutputDir(): string {
  return cachedScreenshotsDir || path.join(getAIOutputDir(), "screenshots");
}

/**
 * Synchronous getter for the documents/files output directory
 */
export function getFilesOutputDir(): string {
  return cachedFilesDir || path.join(getAIOutputDir(), "files");
}

/**
 * Helper to count files and calculate size in a folder recursively
 */
async function inspectDirectoryStats(dirPath: string): Promise<{ count: number; bytes: number }> {
  let count = 0;
  let bytes = 0;
  if (!existsSync(dirPath)) return { count, bytes };

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.name.startsWith(".")) continue;
      const full = path.join(dirPath, ent.name);
      try {
        if (ent.isDirectory()) {
          const sub = await inspectDirectoryStats(full);
          count += sub.count;
          bytes += sub.bytes;
        } else if (ent.isFile()) {
          const stat = await fs.stat(full);
          count++;
          bytes += stat.size;
        }
      } catch {
        // Skip unreadable files
      }
    }
  } catch {
    // Ignore read errors
  }
  return { count, bytes };
}

/**
 * Ensure directory structure exists on disk
 */
export async function ensureStorageDirectories(config?: {
  outputDir?: string;
  vaultDir?: string;
  codeDir?: string;
  screenshotsDir?: string;
  filesDir?: string;
}): Promise<void> {
  const output = config?.outputDir || getAIOutputDir();
  const vault = config?.vaultDir || getActiveVaultPath();
  const code = config?.codeDir || (config?.outputDir ? path.join(config.outputDir, "code") : getCodeOutputDir());
  const screenshots = config?.screenshotsDir || (config?.outputDir ? path.join(config.outputDir, "screenshots") : getScreenshotsOutputDir());
  const files = config?.filesDir || (config?.outputDir ? path.join(config.outputDir, "files") : getFilesOutputDir());

  await fs.mkdir(output, { recursive: true });
  await fs.mkdir(vault, { recursive: true });
  await fs.mkdir(code, { recursive: true });
  await fs.mkdir(screenshots, { recursive: true });
  await fs.mkdir(files, { recursive: true });

  // Ensure Obsidian essential folders exist
  await fs.mkdir(path.join(vault, "tasks"), { recursive: true });
  await fs.mkdir(path.join(vault, "research"), { recursive: true });
  await fs.mkdir(path.join(vault, "swarms"), { recursive: true });
  await fs.mkdir(path.join(vault, ".obsidian"), { recursive: true });

  // Update in-memory caches
  cachedOutputDir = output;
  cachedVaultDir = vault;
  cachedCodeDir = code;
  cachedScreenshotsDir = screenshots;
  cachedFilesDir = files;
}

/**
 * Load active storage configuration from Prisma settings & environment
 */
export async function getStorageConfig(): Promise<StorageConfig> {
  try {
    const [outSetting, vaultSetting, codeSetting, screenSetting, fileSetting] = await Promise.all([
      prisma.setting.findUnique({ where: { key: STORAGE_KEY_OUTPUT_DIR } }),
      prisma.setting.findUnique({ where: { key: STORAGE_KEY_VAULT_DIR } }),
      prisma.setting.findUnique({ where: { key: STORAGE_KEY_CODE_DIR } }),
      prisma.setting.findUnique({ where: { key: STORAGE_KEY_SCREENSHOTS_DIR } }),
      prisma.setting.findUnique({ where: { key: STORAGE_KEY_FILES_DIR } }),
    ]);

    const outputDir = outSetting?.value?.trim() || getDefaultOutputDir();
    const vaultDir = vaultSetting?.value?.trim() || getDefaultVaultDir();
    const codeDir = codeSetting?.value?.trim() || path.join(outputDir, "code");
    const screenshotsDir = screenSetting?.value?.trim() || path.join(outputDir, "screenshots");
    const filesDir = fileSetting?.value?.trim() || path.join(outputDir, "files");

    // Populate in-memory caches
    cachedOutputDir = outputDir;
    cachedVaultDir = vaultDir;
    cachedCodeDir = codeDir;
    cachedScreenshotsDir = screenshotsDir;
    cachedFilesDir = filesDir;

    const [codeStats, screenStats, fileStats, vaultStats] = await Promise.all([
      inspectDirectoryStats(codeDir),
      inspectDirectoryStats(screenshotsDir),
      inspectDirectoryStats(filesDir),
      inspectDirectoryStats(vaultDir),
    ]);

    return {
      outputDir,
      vaultDir,
      codeDir,
      screenshotsDir,
      filesDir,
      outputDirExists: existsSync(outputDir),
      vaultDirExists: existsSync(vaultDir),
      stats: {
        codeFilesCount: codeStats.count,
        screenshotsCount: screenStats.count,
        documentsCount: fileStats.count,
        vaultNotesCount: vaultStats.count,
        totalSizeBytes: codeStats.bytes + screenStats.bytes + fileStats.bytes + vaultStats.bytes,
      },
    };
  } catch (err) {
    console.warn("Falling back to default storage config due to error:", err);
    const outputDir = getDefaultOutputDir();
    const vaultDir = getDefaultVaultDir();
    return {
      outputDir,
      vaultDir,
      codeDir: path.join(outputDir, "code"),
      screenshotsDir: path.join(outputDir, "screenshots"),
      filesDir: path.join(outputDir, "files"),
      outputDirExists: existsSync(outputDir),
      vaultDirExists: existsSync(vaultDir),
      stats: {
        codeFilesCount: 0,
        screenshotsCount: 0,
        documentsCount: 0,
        vaultNotesCount: 0,
        totalSizeBytes: 0,
      },
    };
  }
}

/**
 * Update storage configuration paths in database & disk
 */
export async function updateStorageConfig(updates: {
  outputDir?: string;
  vaultDir?: string;
  codeDir?: string;
  screenshotsDir?: string;
  filesDir?: string;
}): Promise<StorageConfig> {
  const current = await getStorageConfig();

  const newOutputDir = updates.outputDir?.trim() || current.outputDir;
  // If outputDir changed and vaultDir wasn't explicitly changed, or if user requested to sync
  const newVaultDir = updates.vaultDir?.trim() || current.vaultDir;
  const newCodeDir = updates.codeDir?.trim() || (updates.outputDir ? path.join(newOutputDir, "code") : current.codeDir);
  const newScreenshotsDir =
    updates.screenshotsDir?.trim() || (updates.outputDir ? path.join(newOutputDir, "screenshots") : current.screenshotsDir);
  const newFilesDir = updates.filesDir?.trim() || (updates.outputDir ? path.join(newOutputDir, "files") : current.filesDir);

  // Ensure directories exist on disk
  await ensureStorageDirectories({
    outputDir: newOutputDir,
    vaultDir: newVaultDir,
    codeDir: newCodeDir,
    screenshotsDir: newScreenshotsDir,
    filesDir: newFilesDir,
  });

  // Save to database
  await Promise.all([
    prisma.setting.upsert({
      where: { key: STORAGE_KEY_OUTPUT_DIR },
      update: { value: newOutputDir },
      create: { key: STORAGE_KEY_OUTPUT_DIR, value: newOutputDir },
    }),
    prisma.setting.upsert({
      where: { key: STORAGE_KEY_VAULT_DIR },
      update: { value: newVaultDir },
      create: { key: STORAGE_KEY_VAULT_DIR, value: newVaultDir },
    }),
    prisma.setting.upsert({
      where: { key: STORAGE_KEY_CODE_DIR },
      update: { value: newCodeDir },
      create: { key: STORAGE_KEY_CODE_DIR, value: newCodeDir },
    }),
    prisma.setting.upsert({
      where: { key: STORAGE_KEY_SCREENSHOTS_DIR },
      update: { value: newScreenshotsDir },
      create: { key: STORAGE_KEY_SCREENSHOTS_DIR, value: newScreenshotsDir },
    }),
    prisma.setting.upsert({
      where: { key: STORAGE_KEY_FILES_DIR },
      update: { value: newFilesDir },
      create: { key: STORAGE_KEY_FILES_DIR, value: newFilesDir },
    }),
  ]);

  return await getStorageConfig();
}

/**
 * Open target folder in native Windows Explorer / Mac Finder / Linux File Manager
 */
export async function openFolderInExplorer(targetPath?: string): Promise<{ success: boolean; path: string; error?: string }> {
  const folder = path.resolve(targetPath || getAIOutputDir());
  try {
    if (!existsSync(folder)) {
      await fs.mkdir(folder, { recursive: true });
    }

    if (process.platform === "win32") {
      spawn("explorer.exe", [folder], { detached: true, stdio: "ignore" }).unref();
    } else if (process.platform === "darwin") {
      spawn("open", [folder], { detached: true, stdio: "ignore" }).unref();
    } else {
      spawn("xdg-open", [folder], { detached: true, stdio: "ignore" }).unref();
    }
    return { success: true, path: folder };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to open directory";
    return { success: false, path: folder, error: errorMsg };
  }
}

/**
 * Save an AI output artifact into the user-configured storage folders
 */
export async function saveAIOutputArtifact(params: {
  type: "code" | "screenshot" | "file" | "vault";
  fileName: string;
  content: string | Buffer;
  subFolder?: string;
}): Promise<{
  filePath: string;
  fileUrl: string;
  size: number;
}> {
  const { type, fileName, content, subFolder } = params;
  let targetDirectory: string;

  switch (type) {
    case "code":
      targetDirectory = getCodeOutputDir();
      break;
    case "screenshot":
      targetDirectory = getScreenshotsOutputDir();
      break;
    case "vault":
      targetDirectory = getActiveVaultPath();
      break;
    case "file":
    default:
      targetDirectory = getFilesOutputDir();
      break;
  }

  if (subFolder) {
    targetDirectory = path.join(targetDirectory, subFolder);
  }

  await fs.mkdir(targetDirectory, { recursive: true });
  const cleanName = path.basename(fileName);
  const targetPath = path.join(targetDirectory, cleanName);

  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf-8");
  await fs.writeFile(targetPath, buffer);

  // For web preview, also mirror screenshots and documents to public/downloads/
  const downloadDir = path.join(process.cwd(), "public", "downloads");
  try {
    await fs.mkdir(downloadDir, { recursive: true });
    const mirrorPath = path.join(downloadDir, cleanName);
    await fs.writeFile(mirrorPath, buffer);
  } catch {
    // Mirror failure should not block primary artifact saving
  }

  return {
    filePath: targetPath,
    fileUrl: `/downloads/${encodeURIComponent(cleanName)}`,
    size: buffer.length,
  };
}

/**
 * List recent deliverables across output directories
 */
export async function listRecentAIOutputs(limit = 25): Promise<
  Array<{
    name: string;
    type: "code" | "screenshot" | "file" | "vault";
    path: string;
    fileUrl: string;
    size: number;
    mtime: string;
  }>
> {
  const results: Array<{
    name: string;
    type: "code" | "screenshot" | "file" | "vault";
    path: string;
    fileUrl: string;
    size: number;
    mtime: string;
  }> = [];

  const targets: Array<{ dir: string; type: "code" | "screenshot" | "file" | "vault" }> = [
    { dir: getCodeOutputDir(), type: "code" },
    { dir: getScreenshotsOutputDir(), type: "screenshot" },
    { dir: getFilesOutputDir(), type: "file" },
    { dir: getActiveVaultPath(), type: "vault" },
  ];

  for (const { dir, type } of targets) {
    if (!existsSync(dir)) continue;
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const ent of entries) {
        if (ent.isFile() && !ent.name.startsWith(".")) {
          const fullPath = path.join(dir, ent.name);
          try {
            const stat = await fs.stat(fullPath);
            results.push({
              name: ent.name,
              type,
              path: fullPath,
              fileUrl: `/downloads/${encodeURIComponent(ent.name)}`,
              size: stat.size,
              mtime: stat.mtime.toISOString(),
            });
          } catch {}
        }
      }
    } catch {}
  }

  // Sort newest first
  results.sort((a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime());
  return results.slice(0, limit);
}
