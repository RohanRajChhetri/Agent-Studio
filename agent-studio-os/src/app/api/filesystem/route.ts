import { NextResponse } from "next/server";
import {
  createProjectFile,
  createProjectFolder,
  readProjectFile,
  listProjectDirectory,
  resolveSafeProjectPath,
  listWorkspaceProjects,
  createWorkspaceProject,
  writeBatchProjectFiles,
  renameProjectEntry,
  deleteProjectEntry,
  duplicateProjectEntry,
  exportProjectZip,
} from "@/lib/project-filesystem";
import { getAuthUserId } from "@/lib/user-auth";

export async function GET(request: Request) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const targetPath = searchParams.get("path") || "";
    const action = searchParams.get("action") || "list"; // "projects" | "list" | "read" | "tree" | "zip"

    // 1. List user workspace project folders
    if (action === "projects") {
      const projects = await listWorkspaceProjects();
      return NextResponse.json({ projects });
    }

    // 2. Read specific file
    if (action === "read") {
      if (!targetPath) {
        return NextResponse.json({ error: "File path is required" }, { status: 400 });
      }
      const fileData = await readProjectFile(targetPath);
      return NextResponse.json(fileData);
    }

    // 3. Export project workspace as a downloadable ZIP
    if (action === "zip" || action === "export_zip") {
      if (!targetPath) {
        return NextResponse.json({ error: "Target path is required for zip export" }, { status: 400 });
      }
      const { buffer, filename } = await exportProjectZip(targetPath);
      return new Response(buffer as any, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-cache",
        },
      });
    }

    // 4. Recursive directory tree
    if (action === "tree") {
      const tree = await listProjectDirectory(targetPath, true, 4);
      return NextResponse.json({ tree });
    }

    // Default: list single directory
    const entries = await listProjectDirectory(targetPath, false);
    return NextResponse.json({ entries });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to access filesystem" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, path: targetPath, content = "", name, projectPath, files, oldPath, newPath, template } = body;

    // 1. Create a new user workspace project folder
    if (action === "create_project") {
      const projectName = name || targetPath;
      if (!projectName) {
        return NextResponse.json({ error: "Project name is required" }, { status: 400 });
      }
      const res = await createWorkspaceProject(projectName, template || "webapp");
      return NextResponse.json(res);
    }

    // 2. Batch create/write multiple files in a project
    if (action === "batch_create" || action === "write_files") {
      const proj = projectPath || targetPath || "agent-workspace/default-project";
      if (!Array.isArray(files) || files.length === 0) {
        return NextResponse.json({ error: "Files array is required" }, { status: 400 });
      }
      const res = await writeBatchProjectFiles(proj, files);
      return NextResponse.json(res);
    }

    // 3. Rename file or folder
    if (action === "rename") {
      const source = oldPath || targetPath;
      const destination = newPath;
      if (!source || !destination) {
        return NextResponse.json({ error: "oldPath and newPath are required for rename" }, { status: 400 });
      }
      const res = await renameProjectEntry(source, destination);
      return NextResponse.json(res);
    }

    // 4. Duplicate file or folder
    if (action === "duplicate") {
      const itemToDuplicate = targetPath || oldPath;
      if (!itemToDuplicate) {
        return NextResponse.json({ error: "Target path is required for duplicate" }, { status: 400 });
      }
      const res = await duplicateProjectEntry(itemToDuplicate);
      return NextResponse.json(res);
    }

    // 5. Delete file or folder via POST action
    if (action === "delete") {
      const pathToDelete = targetPath || oldPath;
      if (!pathToDelete) {
        return NextResponse.json({ error: "Target path is required for delete" }, { status: 400 });
      }
      const res = await deleteProjectEntry(pathToDelete);
      return NextResponse.json(res);
    }

    if (!targetPath) {
      return NextResponse.json({ error: "Target path is required" }, { status: 400 });
    }

    // 5. Create folder
    if (action === "create_folder" || action === "mkdir") {
      const res = await createProjectFolder(targetPath);
      return NextResponse.json(res);
    }

    // 6. Create single file
    if (action === "create_file" || action === "write_file") {
      const res = await createProjectFile(targetPath, content, { overwrite: true });
      return NextResponse.json(res);
    }

    return NextResponse.json({ error: `Unknown action: "${action}"` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Filesystem operation failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const targetPath = searchParams.get("path");

    if (!targetPath) {
      return NextResponse.json({ error: "Target path is required" }, { status: 400 });
    }

    const res = await deleteProjectEntry(targetPath);
    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to delete file or folder" },
      { status: 500 }
    );
  }
}

