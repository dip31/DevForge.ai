import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { AgentOperation } from "@contracts/agent";
import {
  MAX_FILE_BYTES,
  computeDiff,
  languageFromPath,
  validateWorkspacePath,
  type WorkspaceFileRecord,
  type WorkspaceStore,
} from "../workspaceService";
import { REPO_ROOT } from "./config";
import type { ReconcileResult, ReconcileStats } from "./types";

// The workspace bridge is the boundary between the OpenHands filesystem
// workspace (an isolated, per-run working directory) and DevForge's
// database-backed WorkspaceStore (the authoritative source of truth).
//
// OpenHands runs against a throwaway copy. After the run we diff that copy
// against the seeded baseline and reconcile only the real differences back into
// the store, enforcing the same path validation, read-only rules, and
// optimistic-concurrency (stale) checks the Groq agent uses. Deletions are
// always staged as pending and never applied here.

/** Minimal filesystem surface, injectable so reconciliation is testable. */
export interface FileSystem {
  /** Create a unique directory under `root` and return its absolute path. */
  makeTempDir(root: string, prefix: string): Promise<string>;
  ensureDir(absDir: string): Promise<void>;
  writeFile(absPath: string, content: string): Promise<void>;
  readFile(absPath: string): Promise<string>;
  /** Relative file paths (forward slashes) under `dir`, excluding symlinks. */
  listFiles(dir: string): Promise<string[]>;
  /** Relative directory paths (forward slashes) under `dir`, excluding symlinks. */
  listDirs(dir: string): Promise<string[]>;
  removeDir(dir: string): Promise<void>;
}

/** Real filesystem implementation used in production. */
export class NodeFileSystem implements FileSystem {
  async makeTempDir(root: string, prefix: string): Promise<string> {
    await fs.mkdir(root, { recursive: true });
    return fs.mkdtemp(path.join(root, prefix));
  }

  async ensureDir(absDir: string): Promise<void> {
    await fs.mkdir(absDir, { recursive: true });
  }

  async writeFile(absPath: string, content: string): Promise<void> {
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, content, "utf8");
  }

  async readFile(absPath: string): Promise<string> {
    return fs.readFile(absPath, "utf8");
  }

  async listFiles(dir: string): Promise<string[]> {
    const out: string[] = [];
    await walk(dir, "", (rel) => out.push(rel), () => {});
    return out;
  }

  async listDirs(dir: string): Promise<string[]> {
    const dirs: string[] = [];
    await walk(dir, "", () => {}, (rel) => dirs.push(rel));
    return dirs;
  }

  async removeDir(dir: string): Promise<void> {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

// Recursive walk that never follows symlinks (defense against escape) and never
// leaves the root directory.
async function walk(
  root: string,
  rel: string,
  onFile: (rel: string) => void,
  onDir: (rel: string) => void,
): Promise<void> {
  const abs = rel ? path.join(root, rel) : root;
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(abs, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      onDir(childRel);
      await walk(root, childRel, onFile, onDir);
    } else if (entry.isFile()) {
      onFile(childRel);
    }
  }
}

export type SeededWorkspace = {
  workingDir: string;
  baseline: Map<string, string>;
};

export type PlannedChange = {
  action: "create" | "edit" | "delete";
  path: string;
  /** New content for create/edit; null for delete. */
  content: string | null;
  /** Baseline content for edit/delete; null for create. */
  previous: string | null;
  /** When set, the change conflicts and must not be applied. */
  conflict?: string;
  readOnly?: boolean;
};

export type BridgeOptions = {
  rootDir: string;
  fs?: FileSystem;
};

/**
 * Compute the changes between the seeded baseline and the agent's final working
 * tree, marking any change that would clobber newer candidate edits. Pure and
 * deterministic so it can be unit tested without touching disk or a database.
 */
export function planReconciliation(
  baseline: Map<string, string>,
  working: Map<string, string>,
  current: Map<string, WorkspaceFileRecord>,
): PlannedChange[] {
  const plan: PlannedChange[] = [];
  const seen = new Set<string>();

  for (const [rawPath, content] of working) {
    seen.add(rawPath);
    const validated = validateWorkspacePath(rawPath);
    if (!validated.ok) {
      plan.push({ action: "create", path: rawPath, content: null, previous: null, conflict: validated.error });
      continue;
    }
    const p = validated.path;
    const inBaseline = baseline.has(p);
    const storeFile = current.get(p);

    if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) {
      plan.push({ action: "create", path: p, content, previous: null, conflict: "File exceeds the maximum size." });
      continue;
    }

    if (!inBaseline) {
      // New file. Never overwrite something the store already has.
      if (storeFile) {
        plan.push({ action: "create", path: p, content, previous: null, conflict: "File already exists in the workspace." });
      } else {
        plan.push({ action: "create", path: p, content, previous: null });
      }
      continue;
    }

    const previous = baseline.get(p)!;
    if (content === previous) continue; // unchanged

    // Edited file. Never overwrite a newer candidate edit.
    if (storeFile && storeFile.content !== previous) {
      plan.push({ action: "edit", path: p, content, previous, conflict: "File changed since the agent started." });
      continue;
    }
    if (storeFile?.isReadOnly) {
      plan.push({ action: "edit", path: p, content, previous, conflict: "File is read-only.", readOnly: true });
      continue;
    }
    plan.push({ action: "edit", path: p, content, previous });
  }

  for (const [p, previous] of baseline) {
    if (seen.has(p)) continue;
    const storeFile = current.get(p);
    // Already gone from the store — nothing to stage.
    if (!storeFile) continue;
    if (storeFile.isReadOnly) {
      plan.push({ action: "delete", path: p, content: null, previous, conflict: "File is read-only.", readOnly: true });
      continue;
    }
    plan.push({ action: "delete", path: p, content: null, previous });
  }

  return plan;
}

/** Build a DevForge AgentOperation for an applied or staged change. */
function buildOperation(change: PlannedChange, status: AgentOperation["status"]): AgentOperation {
  const isDelete = change.action === "delete";
  const applied = status === "applied" || status === "failed";
  const diff = computeDiff(change.previous, change.content);
  return {
    id: `op_${randomUUID()}`,
    kind: isDelete ? "delete_file" : change.action === "create" ? "create_file" : "edit_file",
    path: change.path,
    content: change.content,
    expectedPreviousContent: change.previous,
    language: languageFromPath(change.path),
    requiresApproval: isDelete,
    status,
    diff: { path: change.path, previous: change.previous, next: change.content },
    appliedAt: applied && status === "applied" ? new Date().toISOString() : null,
    error: status === "failed" ? (change.conflict ?? "Reconciliation failed.") : null,
  };
}

/**
 * Seed an isolated working directory from the authoritative store. Only files
 * the candidate already owns are copied, at their exact relative paths.
 */
export class WorkspaceBridge {
  private readonly fs: FileSystem;
  private readonly rootDir: string;

  constructor(options: BridgeOptions) {
    this.fs = options.fs ?? new NodeFileSystem();
    this.rootDir = options.rootDir;
  }

  static defaultRootDir(): string {
    return process.env.OPENHANDS_WORKSPACE_ROOT?.trim() || path.join(REPO_ROOT, ".openhands-workspaces");
  }

  async seed(store: WorkspaceStore): Promise<SeededWorkspace> {
    const workingDir = await this.fs.makeTempDir(this.rootDir, "oh-");
    const baseline = new Map<string, string>();
    const files = await store.list();
    for (const file of files) {
      const validated = validateWorkspacePath(file.path);
      if (!validated.ok) continue;
      if (Buffer.byteLength(file.content, "utf8") > MAX_FILE_BYTES) continue;
      baseline.set(validated.path, file.content);
      await this.fs.writeFile(path.join(workingDir, validated.path), file.content);
    }
    return { workingDir, baseline };
  }

  /** Read the working tree the agent left behind. */
  async readWorkingFiles(seeded: SeededWorkspace): Promise<Map<string, string>> {
    const working = new Map<string, string>();
    for (const rel of await this.fs.listFiles(seeded.workingDir)) {
      working.set(rel, await this.fs.readFile(path.join(seeded.workingDir, rel)));
    }
    return working;
  }

  /**
   * Reconcile the agent's working tree into the authoritative store. Creates
   * and edits are applied through the store; deletes are staged as pending
   * operations for explicit candidate approval. Conflicting changes are
   * reported as failed operations and never applied.
   */
  async reconcile(store: WorkspaceStore, seeded: SeededWorkspace): Promise<ReconcileResult> {
    const working = await this.readWorkingFiles(seeded);
    const current = new Map<string, WorkspaceFileRecord>();
    for (const file of await store.list()) current.set(file.path, file);

    const plan = planReconciliation(seeded.baseline, working, current);
    const operations: AgentOperation[] = [];
    const stats: ReconcileStats = { created: 0, modified: 0, deleted: 0, unchanged: 0, conflicts: 0 };

    for (const change of plan) {
      if (change.conflict) {
        stats.conflicts += 1;
        operations.push(buildOperation(change, "failed"));
        continue;
      }
      if (change.action === "delete") {
        // Staged only. The apply endpoint performs the real deletion.
        stats.deleted += 1;
        operations.push(buildOperation(change, "pending"));
        continue;
      }
      try {
        await store.write(change.path, change.content ?? "");
        operations.push(buildOperation(change, "applied"));
        if (change.action === "create") stats.created += 1;
        else stats.modified += 1;
      } catch (error) {
        stats.conflicts += 1;
        operations.push({
          ...buildOperation(change, "failed"),
          error: error instanceof Error ? error.message : "Write failed.",
        });
      }
    }

    // Count files that were seeded and never touched.
    const touched = new Set(plan.map((c) => c.path));
    for (const p of seeded.baseline.keys()) if (!touched.has(p)) stats.unchanged += 1;

    return { operations, stats };
  }

  async cleanup(seeded: SeededWorkspace, options: { keep?: boolean } = {}): Promise<void> {
    if (options.keep) return;
    await this.fs.removeDir(seeded.workingDir);
  }
}
