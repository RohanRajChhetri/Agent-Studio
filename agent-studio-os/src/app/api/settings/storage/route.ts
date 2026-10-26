import { NextResponse } from "next/server";
import {
  getStorageConfig,
  updateStorageConfig,
  openFolderInExplorer,
  listRecentAIOutputs,
  getDefaultOutputDir,
  getDefaultVaultDir,
} from "@/lib/storage-config";
import { getAuthUserId, PRIMARY_LEGACY_USER_ID } from "@/lib/user-auth";
import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export async function GET() {
  try {
    const config = await getStorageConfig();
    const recentOutputs = await listRecentAIOutputs(20);

    return NextResponse.json({
      config,
      recentOutputs,
      defaults: {
        outputDir: getDefaultOutputDir(),
        vaultDir: getDefaultVaultDir(),
      },
    });
  } catch (error: any) {
    console.error("Storage settings GET error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load storage configuration" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getAuthUserId();
    const effectiveUserId = userId || PRIMARY_LEGACY_USER_ID;
    if (!effectiveUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action = "update", outputDir, vaultDir, codeDir, screenshotsDir, filesDir, targetPath } = body;

    // 1. Open directory in native File Explorer
    if (action === "open_folder" || action === "open") {
      const folderToOpen = targetPath || outputDir;
      const res = await openFolderInExplorer(folderToOpen);
      return NextResponse.json(res);
    }

    // 2. Validate arbitrary path
    if (action === "validate") {
      const pathToValidate = targetPath || outputDir;
      if (!pathToValidate) {
        return NextResponse.json({ valid: false, error: "Path cannot be empty" }, { status: 400 });
      }
      try {
        const resolved = path.resolve(pathToValidate);
        const exists = existsSync(resolved);
        return NextResponse.json({
          valid: true,
          path: resolved,
          exists,
          message: exists ? "Directory exists and is ready" : "Directory will be created upon saving",
        });
      } catch (err: any) {
        return NextResponse.json({ valid: false, error: err.message || "Invalid path syntax" }, { status: 400 });
      }
    }

    // 3. Reset to standard defaults
    if (action === "reset") {
      const defaultOut = getDefaultOutputDir();
      const defaultVault = getDefaultVaultDir();
      const updated = await updateStorageConfig({
        outputDir: defaultOut,
        vaultDir: defaultVault,
      });
      return NextResponse.json({ success: true, config: updated, message: "Storage paths reset to defaults" });
    }

    // 4. Update configuration
    if (outputDir && typeof outputDir === "string") {
      const resolvedOutput = path.resolve(outputDir);
      await fs.mkdir(resolvedOutput, { recursive: true });
    }

    if (vaultDir && typeof vaultDir === "string") {
      const resolvedVault = path.resolve(vaultDir);
      await fs.mkdir(resolvedVault, { recursive: true });
    }

    const updated = await updateStorageConfig({
      outputDir,
      vaultDir,
      codeDir,
      screenshotsDir,
      filesDir,
    });

    return NextResponse.json({
      success: true,
      config: updated,
      message: "Storage configuration updated successfully",
    });
  } catch (error: any) {
    console.error("Storage settings POST error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update storage settings" },
      { status: 500 }
    );
  }
}
