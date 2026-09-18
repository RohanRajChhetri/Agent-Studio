import { NextResponse } from "next/server";
import {
  listVaultFiles,
  readVaultFile,
  writeVaultFile,
  deleteVaultFile,
  createVaultFolder,
  renameVaultPath,
  deleteVaultFolder,
  ensureVaultExists,
  getVaultPath,
  countVaultNotes,
  getGraphStats,
  generateGalaxyData,
  openVaultInObsidian,
  seedSampleNotes,
} from "@/lib/vault";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const filePath = searchParams.get("path");

    await ensureVaultExists();

    if (action === "read" && filePath) {
      const { content, modifiedAt } = await readVaultFile(filePath);
      return NextResponse.json({ content, modifiedAt });
    }

    if (action === "galaxy") {
      const galaxyData = await generateGalaxyData();
      return NextResponse.json(galaxyData);
    }

    if (action === "stats") {
      const noteCount = await countVaultNotes();
      const graphStats = await getGraphStats();
      const vaultPath = getVaultPath();
      return NextResponse.json({ noteCount, graphStats, vaultPath });
    }

    // Default: list all files
    const files = await listVaultFiles();
    return NextResponse.json(files);
  } catch (error) {
    console.error("Vault error:", error);
    return NextResponse.json(
      { error: "Failed to access vault" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, path: filePath, content, oldPath, newPath } = body;

    // Open vault or specific note file in local desktop Obsidian
    if (action === "open_obsidian" || action === "open") {
      const target = filePath || body.file || body.target;
      const res = await openVaultInObsidian(target, {
        title: body.title,
        content: body.content,
        agentName: body.agentName,
      });
      return NextResponse.json(res);
    }

    // Seed sample notes
    if (action === "seed") {
      await seedSampleNotes();
      const files = await listVaultFiles();
      return NextResponse.json({ success: true, files });
    }

    // Create new folder
    if (action === "create_folder") {
      if (!filePath) {
        return NextResponse.json({ error: "Folder path is required" }, { status: 400 });
      }
      await createVaultFolder(filePath);
      return NextResponse.json({ success: true });
    }

    // Rename file or folder
    if (action === "rename") {
      if (!oldPath || !newPath) {
        return NextResponse.json({ error: "oldPath and newPath are required" }, { status: 400 });
      }
      await renameVaultPath(oldPath, newPath);
      return NextResponse.json({ success: true });
    }

    if (!filePath || content === undefined) {
      return NextResponse.json(
        { error: "Path and content are required" },
        { status: 400 }
      );
    }

    await writeVaultFile(filePath, content);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Vault POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to perform vault action" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get("path");
    const isFolder = searchParams.get("isFolder") === "true";

    if (!filePath) {
      return NextResponse.json(
        { error: "Path is required" },
        { status: 400 }
      );
    }

    if (isFolder) {
      await deleteVaultFolder(filePath);
    } else {
      await deleteVaultFile(filePath);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Vault DELETE error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete item" },
      { status: 500 }
    );
  }
}
