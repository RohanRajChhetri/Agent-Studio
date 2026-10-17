import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { getVaultPath, countVaultNotes } from "@/lib/vault";

export interface BackupSnapshot {
  id: string;
  fileName: string;
  downloadUrl: string;
  sizeBytes: number;
  createdAt: string;
  stats: {
    agents: number;
    tasks: number;
    routines: number;
    notes: number;
  };
}

/** Directory where backup archives are persisted */
export function getBackupDirectory(): string {
  return path.join(process.cwd(), "public", "backups");
}

/** Recursively read directory and add files to zip */
async function addDirectoryToZip(dir: string, zipFolder: JSZip, rootDir: string): Promise<number> {
  let count = 0;
  if (!fsSync.existsSync(dir)) return count;

  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const subFolder = zipFolder.folder(entry.name);
      if (subFolder) {
        count += await addDirectoryToZip(fullPath, subFolder, rootDir);
      }
    } else if (entry.isFile()) {
      try {
        const content = await fs.readFile(fullPath);
        zipFolder.file(entry.name, content);
        count++;
      } catch {
        // Skip locked or unreadable files
      }
    }
  }
  return count;
}

/**
 * Creates a complete snapshot of SQLite database, Obsidian vault notes, and configuration.
 */
export async function createSystemSnapshot(): Promise<BackupSnapshot> {
  const backupDir = getBackupDirectory();
  await fs.mkdir(backupDir, { recursive: true });

  const zip = new JSZip();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `agent-studio-backup-${timestamp}.zip`;
  const backupPath = path.join(backupDir, fileName);

  // 1. Fetch system statistics
  const [agents, tasks, routines, notes] = await Promise.all([
    prisma.agent.count().catch(() => 0),
    prisma.task.count().catch(() => 0),
    prisma.routine.count().catch(() => 0),
    countVaultNotes().catch(() => 0),
  ]);

  // 2. Safe SQLite Database Backup
  try {
    // Flush WAL log buffer to main database file
    await prisma.$executeRawUnsafe("PRAGMA wal_checkpoint(PASSIVE);").catch(() => {});

    const dbPath = path.join(process.cwd(), "prisma", "agent-studio.db");
    if (fsSync.existsSync(dbPath)) {
      const dbBuffer = await fs.readFile(dbPath);
      zip.file("database/agent-studio.db", dbBuffer);
    }
  } catch (err) {
    console.warn("[Backup Engine] Database backup warning:", err);
  }

  // 3. Backup Obsidian Vault Notes
  try {
    const vaultPath = getVaultPath();
    const vaultZip = zip.folder("vault");
    if (vaultZip && fsSync.existsSync(vaultPath)) {
      await addDirectoryToZip(vaultPath, vaultZip, vaultPath);
    }
  } catch (err) {
    console.warn("[Backup Engine] Vault backup warning:", err);
  }

  // 4. Attach metadata manifest
  const manifest = {
    version: "1.0.0",
    platform: "Agent Studio OS",
    createdAt: new Date().toISOString(),
    stats: { agents, tasks, routines, notes },
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  // 5. Generate zip archive buffer and write to disk
  const content = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  await fs.writeFile(backupPath, content);
  const stats = await fs.stat(backupPath);

  return {
    id: `snap-${Date.now()}`,
    fileName,
    downloadUrl: `/backups/${fileName}`,
    sizeBytes: stats.size,
    createdAt: manifest.createdAt,
    stats: manifest.stats,
  };
}

/**
 * Lists all existing snapshot archives sorted by creation time descending.
 */
export async function listSystemSnapshots(): Promise<BackupSnapshot[]> {
  const backupDir = getBackupDirectory();
  try {
    await fs.mkdir(backupDir, { recursive: true });
    const entries = await fs.readdir(backupDir, { withFileTypes: true });
    const snapshots: BackupSnapshot[] = [];

    for (const ent of entries) {
      if (ent.isFile() && ent.name.endsWith(".zip") && ent.name.startsWith("agent-studio-backup-")) {
        const filePath = path.join(backupDir, ent.name);
        try {
          const stats = await fs.stat(filePath);
          snapshots.push({
            id: ent.name.replace(".zip", ""),
            fileName: ent.name,
            downloadUrl: `/backups/${encodeURIComponent(ent.name)}`,
            sizeBytes: stats.size,
            createdAt: stats.mtime.toISOString(),
            stats: { agents: 0, tasks: 0, routines: 0, notes: 0 },
          });
        } catch {
          // Skip if removed concurrently
        }
      }
    }

    snapshots.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return snapshots;
  } catch (err) {
    console.warn("[Backup Engine] Error listing snapshots:", err);
    return [];
  }
}

/**
 * Safely deletes a snapshot archive within the backup directory.
 */
export async function deleteSystemSnapshot(fileName: string): Promise<boolean> {
  const cleanName = path.basename(fileName);
  if (!cleanName.endsWith(".zip") || !cleanName.startsWith("agent-studio-backup-")) {
    throw new Error("Invalid snapshot filename");
  }

  const targetPath = path.join(getBackupDirectory(), cleanName);
  try {
    if (fsSync.existsSync(targetPath)) {
      await fs.unlink(targetPath);
      return true;
    }
    return false;
  } catch (err) {
    console.error("[Backup Engine] Failed to delete snapshot:", err);
    return false;
  }
}
