import { createHash } from "node:crypto";
import { db } from "./database";
import { sessionFiles } from "@database/schema";
import { eq, and } from "drizzle-orm";

// The candidate's authorized workspace is a set of DB-backed files scoped to an
// assessment session (the `session_files` table). There is no real filesystem
// here, but every path is still validated exactly as if it were, so a future
// disk-backed store cannot weaken the security model. This module is the single
// place that reads and writes session files for the AI agent.

export const MAX_PATH_LENGTH = 500;
export const MAX_LANGUAGE_LENGTH = 50;
export const MAX_FILE_BYTES = 100_000;
export const MAX_PATH_SEGMENTS = 20;

// Directory "creation" in a flat file store only establishes an implicit folder
// by recording a marker. This records the folder so listings and the UI can show
// it, and so a later file creation inside it is understood as existing.
export const DIRECTORY_MARKER_SUFFIX = "/.gitkeep";

const RESERVED_SEGMENTS = new Set([".git", "node_modules", ".env", ".env.local"]);

export type PathValidation =
  | { ok: true; path: string; segments: string[] }
  | { ok: false; error: string };

/**
 * Validate and normalize a workspace-relative path. Rejects absolute paths,
 * parent-directory traversal, reserved segments, and over-long paths. This is
 * the single gate every tool path must pass.
 */
export function validateWorkspacePath(rawPath: unknown): PathValidation {
  if (typeof rawPath !== "string") return { ok: false, error: "Path must be a string." };
  const trimmed = rawPath.trim().replace(/\\/g, "/").replace(/\/+/g, "/");
  if (!trimmed) return { ok: false, error: "Path must not be empty." };
  if (trimmed.length > MAX_PATH_LENGTH) {
    return { ok: false, error: `Path exceeds ${MAX_PATH_LENGTH} characters.` };
  }
  if (trimmed.startsWith("/")) return { ok: false, error: "Absolute paths are not allowed." };
  if (/^[a-zA-Z]:/.test(trimmed)) {
    return { ok: false, error: "Absolute (drive) paths are not allowed." };
  }
  const trailingSlash = trimmed.endsWith("/");
  const parts = trimmed.split("/").filter((part) => part.length > 0);
  if (parts.length === 0) return { ok: false, error: "Path must reference a file or folder." };
  if (parts.length > MAX_PATH_SEGMENTS) {
    return { ok: false, error: `Path has too many segments (max ${MAX_PATH_SEGMENTS}).` };
  }
  for (const part of parts) {
    if (part === "." || part === "..") {
      return { ok: false, error: "Relative '.' and '..' segments are not allowed." };
    }
    if (RESERVED_SEGMENTS.has(part.toLowerCase())) {
      return { ok: false, error: `"${part}" is a reserved path segment.` };
    }
    // Reject control characters and characters that are unsafe in file names.
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u001f<>:"|?*]/.test(part)) {
      return { ok: false, error: `Path segment contains illegal characters.` };
    }
  }
  const normalized = parts.join("/") + (trailingSlash ? "/" : "");
  return { ok: true, path: normalized.replace(/\/$/, "") || normalized, segments: parts };
}

export function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function languageFromPath(path: string): string {
  const ext = path.includes(".") ? path.split(".").pop()!.toLowerCase() : "";
  const map: Record<string, string> = {
    js: "javascript",
    jsx: "jsx",
    ts: "typescript",
    tsx: "tsx",
    json: "json",
    md: "markdown",
    css: "css",
    html: "html",
    py: "python",
    sql: "sql",
    txt: "text",
  };
  return map[ext] ?? "text";
}

export type WorkspaceFileRecord = {
  id: string;
  path: string;
  language: string;
  content: string;
  isReadOnly: boolean;
};

export type WorkspaceListingEntry = {
  path: string;
  type: "file" | "directory";
  language?: string;
  sizeBytes?: number;
};

/** All non-deleted files for a session, ordered by path. */
export async function listSessionFiles(sessionId: string): Promise<WorkspaceFileRecord[]> {
  const rows = await db.query.sessionFiles.findMany({
    where: (f, { eq, and }) => and(eq(f.sessionId, sessionId), eq(f.isDeleted, false)),
    orderBy: (f, { asc }) => [asc(f.path)],
  });
  return (rows ?? []).map((row) => ({
    id: row.id,
    path: row.path,
    language: row.language,
    content: row.content,
    isReadOnly: row.isReadOnly,
  }));
}

/** Build a directory-aware listing, synthesizing folders from file paths. */
export function buildListing(files: WorkspaceFileRecord[]): WorkspaceListingEntry[] {
  const entries = new Map<string, WorkspaceListingEntry>();
  for (const file of files) {
    if (file.path.endsWith(DIRECTORY_MARKER_SUFFIX)) {
      const dir = file.path.slice(0, -DIRECTORY_MARKER_SUFFIX.length);
      if (dir && !entries.has(dir)) {
        entries.set(dir, { path: dir, type: "directory" });
      }
      continue;
    }
    entries.set(file.path, {
      path: file.path,
      type: "file",
      language: file.language,
      sizeBytes: Buffer.byteLength(file.content, "utf8"),
    });
    // Register each parent folder so the tree is complete.
    const segments = file.path.split("/");
    segments.pop();
    let prefix = "";
    for (const segment of segments) {
      prefix = prefix ? `${prefix}/${segment}` : segment;
      if (!entries.has(prefix)) entries.set(prefix, { path: prefix, type: "directory" });
    }
  }
  return [...entries.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export async function readSessionFile(
  sessionId: string,
  path: string,
): Promise<WorkspaceFileRecord | null> {
  const row = await db.query.sessionFiles.findFirst({
    where: (f, { eq, and }) =>
      and(eq(f.sessionId, sessionId), eq(f.path, path), eq(f.isDeleted, false)),
  });
  if (!row) return null;
  return {
    id: row.id,
    path: row.path,
    language: row.language,
    content: row.content,
    isReadOnly: row.isReadOnly,
  };
}

/** Insert or update a file. Returns the persisted record. */
export async function writeSessionFile(
  sessionId: string,
  path: string,
  content: string,
  options: { isReadOnly?: boolean } = {},
): Promise<WorkspaceFileRecord> {
  const language = languageFromPath(path);
  const existing = await db.query.sessionFiles.findFirst({
    where: (f, { eq, and }) => and(eq(f.sessionId, sessionId), eq(f.path, path)),
  });

  if (existing) {
    const [updated] = await db
      .update(sessionFiles)
      .set({
        language,
        content,
        isReadOnly: options.isReadOnly ?? existing.isReadOnly,
        isDeleted: false,
        updatedAt: new Date(),
      })
      .where(eq(sessionFiles.id, existing.id))
      .returning();
    return {
      id: updated.id,
      path: updated.path,
      language: updated.language,
      content: updated.content,
      isReadOnly: updated.isReadOnly,
    };
  }

  const [inserted] = await db
    .insert(sessionFiles)
    .values({
      sessionId,
      path,
      language,
      content,
      isReadOnly: options.isReadOnly ?? false,
    })
    .returning();
  return {
    id: inserted.id,
    path: inserted.path,
    language: inserted.language,
    content: inserted.content,
    isReadOnly: inserted.isReadOnly,
  };
}

export async function deleteSessionFile(sessionId: string, path: string): Promise<boolean> {
  const existing = await db.query.sessionFiles.findFirst({
    where: (f, { eq, and }) => and(eq(f.sessionId, sessionId), eq(f.path, path)),
  });
  if (!existing) return false;
  await db
    .update(sessionFiles)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(eq(sessionFiles.id, existing.id));
  return true;
}

/** Simple search over file paths and contents. */
export async function searchSessionFiles(
  sessionId: string,
  query: string,
  options: { maxResults?: number } = {},
): Promise<Array<{ path: string; preview: string }>> {
  const files = await listSessionFiles(sessionId);
  const needle = query.toLowerCase();
  const maxResults = options.maxResults ?? 50;
  const results: Array<{ path: string; preview: string }> = [];
  for (const file of files) {
    if (results.length >= maxResults) break;
    const pathHit = file.path.toLowerCase().includes(needle);
    const contentIndex = file.content.toLowerCase().indexOf(needle);
    if (!pathHit && contentIndex === -1) continue;
    let preview = "";
    if (contentIndex >= 0) {
      const start = Math.max(0, contentIndex - 60);
      const end = Math.min(file.content.length, contentIndex + query.length + 60);
      preview = file.content.slice(start, end).replace(/\s+/g, " ").trim();
    }
    results.push({ path: file.path, preview });
  }
  return results;
}

export type LineDiff = { added: number; removed: number; unified: string };

/**
 * A workspace the agent's tools can act on. Persisted sessions use the database
 * store; local demo sessions (with no server row) use an in-memory snapshot the
 * client supplies. Either way the model only ever sees and mutates the workspace
 * it is authorized for, and every path is validated the same way.
 */
export interface WorkspaceStore {
  list(): Promise<WorkspaceFileRecord[]>;
  read(path: string): Promise<WorkspaceFileRecord | null>;
  write(
    path: string,
    content: string,
    opts?: { isReadOnly?: boolean },
  ): Promise<WorkspaceFileRecord>;
  remove(path: string): Promise<boolean>;
  search(
    query: string,
    opts?: { maxResults?: number },
  ): Promise<Array<{ path: string; preview: string }>>;
}

/** In-memory workspace used for local demo sessions (no server persistence). */
export class MemoryWorkspaceStore implements WorkspaceStore {
  private files = new Map<string, WorkspaceFileRecord>();
  private counter = 0;

  constructor(seed: Array<{ path: string; content: string }> = []) {
    for (const file of seed) {
      this.files.set(file.path, {
        id: `mem-${file.path}`,
        path: file.path,
        language: languageFromPath(file.path),
        content: file.content,
        isReadOnly: false,
      });
    }
  }

  async list(): Promise<WorkspaceFileRecord[]> {
    return [...this.files.values()].sort((a, b) => a.path.localeCompare(b.path));
  }

  async read(path: string): Promise<WorkspaceFileRecord | null> {
    return this.files.get(path) ?? null;
  }

  async write(
    path: string,
    content: string,
    opts: { isReadOnly?: boolean } = {},
  ): Promise<WorkspaceFileRecord> {
    const existing = this.files.get(path);
    const record: WorkspaceFileRecord = {
      id: existing?.id ?? `mem-${++this.counter}`,
      path,
      language: languageFromPath(path),
      content,
      isReadOnly: opts.isReadOnly ?? existing?.isReadOnly ?? false,
    };
    this.files.set(path, record);
    return record;
  }

  async remove(path: string): Promise<boolean> {
    return this.files.delete(path);
  }

  async search(
    query: string,
    opts: { maxResults?: number } = {},
  ): Promise<Array<{ path: string; preview: string }>> {
    const needle = query.toLowerCase();
    const max = opts.maxResults ?? 50;
    const results: Array<{ path: string; preview: string }> = [];
    for (const file of await this.list()) {
      if (results.length >= max) break;
      if (file.path.toLowerCase().includes(needle) || file.content.toLowerCase().includes(needle)) {
        results.push({ path: file.path, preview: "" });
      }
    }
    return results;
  }

  /** Final file contents after the run (for the client to apply locally). */
  snapshot(): Array<{ path: string; content: string }> {
    return [...this.files.values()].map((f) => ({ path: f.path, content: f.content }));
  }
}

/** Database-backed workspace for a persisted assessment session. */
export function createDbWorkspaceStore(sessionId: string): WorkspaceStore {
  return {
    list: () => listSessionFiles(sessionId),
    read: (path: string) => readSessionFile(sessionId, path),
    write: (path: string, content: string, opts) => writeSessionFile(sessionId, path, content, opts),
    remove: (path: string) => deleteSessionFile(sessionId, path),
    search: (query: string, opts) => searchSessionFiles(sessionId, query, opts),
  };
}

/** Minimal line-based unified diff. Pure and deterministic. */
export function computeDiff(previous: string | null, next: string | null): LineDiff {
  const toLines = (value: string | null): string[] =>
    value == null || value === "" ? [] : value.split("\n");
  const before = toLines(previous);
  const after = toLines(next);
  const beforeSet = new Map<string, number>();
  for (const line of before) beforeSet.set(line, (beforeSet.get(line) ?? 0) + 1);
  const afterSet = new Map<string, number>();
  for (const line of after) afterSet.set(line, (afterSet.get(line) ?? 0) + 1);

  let added = 0;
  let removed = 0;
  const unified: string[] = [];
  for (const [line, count] of afterSet) {
    const beforeCount = beforeSet.get(line) ?? 0;
    if (count > beforeCount) {
      added += count - beforeCount;
      for (let i = 0; i < count - beforeCount; i++) unified.push(`+${line}`);
    }
  }
  for (const [line, count] of beforeSet) {
    const afterCount = afterSet.get(line) ?? 0;
    if (count > afterCount) {
      removed += count - afterCount;
      for (let i = 0; i < count - afterCount; i++) unified.push(`-${line}`);
    }
  }
  return { added, removed, unified: unified.join("\n") };
}

export { eq, and };
