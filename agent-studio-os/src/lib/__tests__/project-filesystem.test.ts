import { describe, it, expect, afterAll } from "vitest";
import {
  createProjectFile,
  createProjectFolder,
  readProjectFile,
  listProjectDirectory,
  resolveSafeProjectPath,
  renameProjectEntry,
  deleteProjectEntry,
} from "../project-filesystem";
import fs from "fs/promises";
import path from "path";

describe("Project Filesystem (Code Operations)", () => {
  const testDir = "agent-workspace/test-sandbox";
  const testFile = `${testDir}/sample.ts`;

  afterAll(async () => {
    try {
      const fullDir = path.resolve(process.cwd(), testDir);
      await fs.rm(fullDir, { recursive: true, force: true });
    } catch {}
  });

  it("safely resolves relative project paths and prevents traversal outside root", () => {
    const { safePath, relativePath } = resolveSafeProjectPath("src/lib/test.ts");
    expect(relativePath).toBe("src/lib/test.ts");
    expect(safePath.includes("src")).toBe(true);

    expect(() => {
      resolveSafeProjectPath("../../../sensitive-system-file.key");
    }).toThrow(/Security violation/);
  });

  it("creates project folders", async () => {
    const res = await createProjectFolder(testDir);
    expect(res.success).toBe(true);
    expect(res.path).toBe("agent-workspace/test-sandbox");
  });

  it("creates and writes files throughout the project", async () => {
    const codeContent = `export const answer = 42;\n`;
    const res = await createProjectFile(testFile, codeContent, { overwrite: true });

    expect(res.success).toBe(true);
    expect(res.path).toBe(testFile);
    expect(res.size).toBeGreaterThan(0);

    const readRes = await readProjectFile(testFile);
    expect(readRes.content).toBe(codeContent);
  });

  it("lists project directories accurately", async () => {
    const list = await listProjectDirectory(testDir, false);
    expect(list.some((item) => item.name === "sample.ts")).toBe(true);
  });

  it("manages workspace projects and batch file operations", async () => {
    const { listWorkspaceProjects, createWorkspaceProject, writeBatchProjectFiles } = await import(
      "../project-filesystem"
    );

    const created = await createWorkspaceProject("test-unit-project");
    expect(created.success).toBe(true);
    expect(created.name).toBe("test-unit-project");

    const projects = await listWorkspaceProjects();
    expect(projects.some((p) => p.name === "test-unit-project")).toBe(true);

    const batchRes = await writeBatchProjectFiles("agent-workspace/test-unit-project", [
      { path: "app.js", content: "console.log('hello');" },
      { path: "style.css", content: "body { color: red; }" },
    ]);
    expect(batchRes.success).toBe(true);
    expect(batchRes.createdFiles.length).toBe(2);

    // Cleanup
    const fullPath = path.resolve(process.cwd(), "agent-workspace/test-unit-project");
    await fs.rm(fullPath, { recursive: true, force: true }).catch(() => {});
  });

  it("renames and deletes files and folders safely", async () => {
    const origFile = `${testDir}/to-rename.ts`;
    const targetFile = `${testDir}/renamed.ts`;
    await createProjectFile(origFile, "export const x = 42;");

    const renameRes = await renameProjectEntry(origFile, targetFile);
    expect(renameRes.success).toBe(true);
    expect(renameRes.newPath).toBe(targetFile);

    const readRenamed = await readProjectFile(targetFile);
    expect(readRenamed.content).toBe("export const x = 42;");

    const deleteRes = await deleteProjectEntry(targetFile);
    expect(deleteRes.success).toBe(true);

    const list = await listProjectDirectory(testDir, false);
    expect(list.some((item) => item.name === "renamed.ts")).toBe(false);
  });

  it("renames and deletes workspace projects using dedicated helpers", async () => {
    const {
      createWorkspaceProject,
      renameWorkspaceProject,
      deleteWorkspaceProject,
      listWorkspaceProjects,
    } = await import("../project-filesystem");

    // 1. Create
    await createWorkspaceProject("test-rename-original");
    let projs = await listWorkspaceProjects();
    expect(projs.some((p) => p.name === "test-rename-original")).toBe(true);

    // 2. Rename
    const renameRes = await renameWorkspaceProject("test-rename-original", "test-rename-updated");
    expect(renameRes.success).toBe(true);
    expect(renameRes.newName).toBe("test-rename-updated");

    projs = await listWorkspaceProjects();
    expect(projs.some((p) => p.name === "test-rename-original")).toBe(false);
    expect(projs.some((p) => p.name === "test-rename-updated")).toBe(true);

    // 3. Delete
    const deleteRes = await deleteWorkspaceProject("test-rename-updated");
    expect(deleteRes.success).toBe(true);

    projs = await listWorkspaceProjects();
    expect(projs.some((p) => p.name === "test-rename-updated")).toBe(false);
  });
});

