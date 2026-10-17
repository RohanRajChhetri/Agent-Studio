import { describe, it, expect } from "vitest";
import { getBackupDirectory, listSystemSnapshots } from "../backup-engine";

describe("Backup Engine", () => {
  it("resolves the backup directory inside public/backups", () => {
    const dir = getBackupDirectory();
    expect(dir).toBeDefined();
    expect(dir.includes("backups")).toBe(true);
  });

  it("lists snapshots as an array", async () => {
    const snapshots = await listSystemSnapshots();
    expect(Array.isArray(snapshots)).toBe(true);
  });
});
