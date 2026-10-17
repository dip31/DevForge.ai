import { randomBytes } from "node:crypto";
import path from "node:path";

// Short-lived, in-memory registry that lets the browser preview a candidate's
// web project. The client posts its current workspace, we stash it under an
// unguessable token, and a path-scoped route serves the files over HTTP. Serving
// real files (with correct content types) is what makes ES modules, relative
// imports, CSS and assets resolve the same way they do in a real browser.

export type PreviewFile = { path: string; content: string };

export type PreviewSession = {
  sessionId: string;
  entry: string;
  files: Map<string, string>;
  createdAt: number;
  expiresAt: number;
};

export class PreviewError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PreviewError";
    this.code = code;
  }
}

const TTL_MS = 15 * 60 * 1000;
const MAX_SESSIONS = 200;
const MAX_FILES = 500;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;

const ENTRY_CANDIDATES = [
  "index.html",
  "public/index.html",
  "src/index.html",
  "app.html",
  "public/app.html",
];

const sessions = new Map<string, PreviewSession>();

/** Normalize a workspace-relative path; returns null for unsafe/empty paths. */
export function normalizePreviewPath(input: string): string | null {
  const raw = input.replace(/\\/g, "/").replace(/^\/+/, "").trim();
  if (!raw || raw.includes("\0")) return null;
  const segments: string[] = [];
  for (const segment of raw.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") return null;
    segments.push(segment);
  }
  const normalized = segments.join("/");
  if (!normalized) return null;
  // Reject any residual traversal after normalization.
  if (path.posix.normalize(normalized).startsWith("..")) return null;
  return normalized;
}

function isHtml(pathname: string): boolean {
  return /\.html?$/i.test(pathname);
}

function resolveEntry(
  requested: string | undefined,
  files: Map<string, string>,
): string | null {
  if (requested) {
    const normalized = normalizePreviewPath(requested);
    if (normalized && isHtml(normalized) && files.has(normalized)) return normalized;
  }
  const htmlFiles = [...files.keys()].filter(isHtml);
  if (htmlFiles.length === 0) return null;
  const byLower = new Map(htmlFiles.map((file) => [file.toLowerCase(), file]));
  for (const candidate of ENTRY_CANDIDATES) {
    const match = byLower.get(candidate);
    if (match) return match;
  }
  htmlFiles.sort((a, b) => {
    const depth = a.split("/").length - b.split("/").length;
    if (depth !== 0) return depth;
    return a.localeCompare(b);
  });
  return htmlFiles[0];
}

function sweep(now: number): void {
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
}

export function createPreviewSession(input: {
  sessionId: string;
  files: PreviewFile[];
  entry?: string;
}): { token: string; entry: string } {
  const now = Date.now();
  sweep(now);

  // Evict the oldest sessions if we are at capacity.
  if (sessions.size >= MAX_SESSIONS) {
    const ordered = [...sessions.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt);
    for (let i = 0; i < ordered.length - MAX_SESSIONS + 1; i += 1) {
      sessions.delete(ordered[i][0]);
    }
  }

  const files = new Map<string, string>();
  let totalBytes = 0;
  for (const file of input.files.slice(0, MAX_FILES)) {
    const normalized = normalizePreviewPath(file.path);
    if (!normalized) continue;
    totalBytes += file.content.length;
    if (totalBytes > MAX_TOTAL_BYTES) break;
    files.set(normalized, file.content);
  }

  const entry = resolveEntry(input.entry, files);
  if (!entry) {
    throw new PreviewError(
      "NO_HTML_ENTRY",
      "Add an HTML file (for example index.html) to preview your project.",
    );
  }

  const token = randomBytes(24).toString("hex");
  sessions.set(token, {
    sessionId: input.sessionId,
    entry,
    files,
    createdAt: now,
    expiresAt: now + TTL_MS,
  });

  return { token, entry };
}

export function getPreviewSession(token: string): PreviewSession | null {
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

const CONTENT_TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  cjs: "text/javascript; charset=utf-8",
  jsx: "text/javascript; charset=utf-8",
  ts: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json; charset=utf-8",
  map: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  txt: "text/plain; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  wasm: "application/wasm",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
};

export function previewContentType(pathname: string): string {
  const ext = pathname.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

/**
 * Rewrite root-absolute references (e.g. `<script src="/src/main.js">`, the
 * convention used by many tooling scaffolds) into paths relative to the served
 * HTML so they resolve under the token-scoped preview route. References that do
 * not correspond to a workspace file are left untouched.
 */
export function rewriteAbsoluteReferences(
  html: string,
  htmlPath: string,
  files: Map<string, string>,
): string {
  const htmlDir = htmlPath.includes("/")
    ? htmlPath.slice(0, htmlPath.lastIndexOf("/"))
    : "";

  return html.replace(
    /\b(href|src|poster|action|data)\s*=\s*(["'])\/([^"']*)\2/gi,
    (match, attr: string, quote: string, target: string) => {
      const normalized = normalizePreviewPath(target);
      if (!normalized || !files.has(normalized)) return match;
      let relative = path.posix.relative(htmlDir || ".", normalized);
      if (!relative) return match;
      if (!relative.startsWith(".")) relative = `./${relative}`;
      return `${attr}=${quote}${relative}${quote}`;
    },
  );
}
