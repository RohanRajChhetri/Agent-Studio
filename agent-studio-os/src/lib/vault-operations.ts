import fs from "fs/promises";
import path from "path";
import type { VaultFile } from "@/types";
import { getVaultPath } from "./obsidian-integration";

/** Recursively list files in the vault */
export async function listVaultFiles(dirPath?: string): Promise<VaultFile[]> {
  const basePath = dirPath || getVaultPath();
  const vaultRoot = getVaultPath();

  try {
    const entries = await fs.readdir(/*turbopackIgnore: true*/ basePath, {
      withFileTypes: true,
    });
    const files: VaultFile[] = [];

    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;

      const fullPath = path.join(basePath, entry.name);
      const relativePath = path
        .relative(vaultRoot, fullPath)
        .replace(/\\/g, "/");

      if (entry.isDirectory()) {
        const children = await listVaultFiles(fullPath);
        files.push({
          name: entry.name,
          path: fullPath,
          relativePath,
          isDirectory: true,
          children,
        });
      } else {
        const stat = await fs.stat(fullPath);
        files.push({
          name: entry.name,
          path: fullPath,
          relativePath,
          isDirectory: false,
          size: stat.size,
          modifiedAt: stat.mtime.toISOString(),
        });
      }
    }

    files.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    return files;
  } catch {
    return [];
  }
}

/** Safely resolve a path within the vault root to prevent path traversal */
export function resolveSafeVaultPath(relativePath: string): string {
  const vaultRoot = path.resolve(getVaultPath());
  const cleanPath = relativePath.replace(/^[/\\]+/, "").trim();
  const resolved = path.resolve(vaultRoot, cleanPath);
  if (!resolved.startsWith(vaultRoot)) {
    throw new Error(`Security violation: Access outside vault directory denied for path "${relativePath}"`);
  }
  return resolved;
}

/** Read a file from the vault */
export async function readVaultFile(
  relativePath: string
): Promise<{ content: string; modifiedAt: string }> {
  const fullPath = resolveSafeVaultPath(relativePath);
  const content = await fs.readFile(fullPath, "utf-8");
  const stat = await fs.stat(fullPath);
  return { content, modifiedAt: stat.mtime.toISOString() };
}

/** Write a file to the vault */
export async function writeVaultFile(
  relativePath: string,
  content: string
): Promise<void> {
  const fullPath = resolveSafeVaultPath(relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, "utf-8");
}

/** Delete a file from the vault */
export async function deleteVaultFile(relativePath: string): Promise<void> {
  const fullPath = resolveSafeVaultPath(relativePath);
  await fs.unlink(fullPath);
}

/** Create a folder in the vault */
export async function createVaultFolder(relativePath: string): Promise<void> {
  const fullPath = resolveSafeVaultPath(relativePath);
  await fs.mkdir(fullPath, { recursive: true });
}

/** Rename or move a file or folder in the vault */
export async function renameVaultPath(
  oldRelativePath: string,
  newRelativePath: string
): Promise<void> {
  const oldPath = resolveSafeVaultPath(oldRelativePath);
  const newPath = resolveSafeVaultPath(newRelativePath);
  await fs.mkdir(path.dirname(newPath), { recursive: true });
  await fs.rename(oldPath, newPath);
}

/** Delete a folder and its contents recursively from the vault */
export async function deleteVaultFolder(relativePath: string): Promise<void> {
  const fullPath = resolveSafeVaultPath(relativePath);
  await fs.rm(fullPath, { recursive: true, force: true });
}

/** Count total markdown notes in the vault */
export async function countVaultNotes(dirPath?: string): Promise<number> {
  const basePath = dirPath || getVaultPath();
  let count = 0;

  try {
    const entries = await fs.readdir(/*turbopackIgnore: true*/ basePath, {
      withFileTypes: true,
    });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(basePath, entry.name);
      if (entry.isDirectory()) {
        count += await countVaultNotes(fullPath);
      } else if (entry.name.endsWith(".md")) {
        count++;
      }
    }
  } catch {
    // Directory doesn't exist yet
  }

  return count;
}

/** Batch delete multiple files and folders safely from the vault */
export async function deleteVaultBatch(
  items: Array<{ path: string; isFolder: boolean }>
): Promise<{ deletedCount: number; errors: string[] }> {
  let deletedCount = 0;
  const errors: string[] = [];

  // Deduplicate items by path
  const uniqueItems = items.filter(
    (item, index, self) => index === self.findIndex((t) => t.path === item.path)
  );

  for (const item of uniqueItems) {
    try {
      const fullPath = resolveSafeVaultPath(item.path);
      // Check if target still exists (e.g. if parent directory was deleted earlier)
      try {
        await fs.access(fullPath);
      } catch {
        deletedCount++;
        continue;
      }

      if (item.isFolder) {
        await fs.rm(fullPath, { recursive: true, force: true });
      } else {
        await fs.unlink(fullPath);
      }
      deletedCount++;
    } catch (err: any) {
      console.error(`Failed to delete vault item ${item.path}:`, err);
      errors.push(`${item.path}: ${err.message || "Failed to delete"}`);
    }
  }

  return { deletedCount, errors };
}
