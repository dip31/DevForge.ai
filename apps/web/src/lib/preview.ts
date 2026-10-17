import type { WorkspaceFile } from "../data";

export const PREVIEW_ENTRY_CANDIDATES = [
  "index.html",
  "public/index.html",
  "src/index.html",
  "app.html",
  "public/app.html",
];

function normalizePath(path: string): string {
  const segments: string[] = [];
  for (const segment of path.replace(/\\/g, "/").split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return segments.join("/");
}

export function isHtmlFile(path: string): boolean {
  return /\.html?$/i.test(path);
}

export function listHtmlFiles(files: WorkspaceFile[]): WorkspaceFile[] {
  return files.filter((file) => isHtmlFile(file.path));
}

export function findHtmlEntry(files: WorkspaceFile[]): string | null {
  const htmlFiles = listHtmlFiles(files);
  if (!htmlFiles.length) return null;
  const byPath = new Map(htmlFiles.map((file) => [normalizePath(file.path).toLowerCase(), file.path]));
  for (const candidate of PREVIEW_ENTRY_CANDIDATES) {
    const match = byPath.get(candidate);
    if (match) return match;
  }
  const sorted = [...htmlFiles].sort((a, b) => {
    const depth = normalizePath(a.path).split("/").length - normalizePath(b.path).split("/").length;
    if (depth !== 0) return depth;
    return a.path.localeCompare(b.path);
  });
  return sorted[0].path;
}

function isExternalReference(reference: string): boolean {
  const value = reference.trim();
  return (
    !value ||
    value.startsWith("#") ||
    value.startsWith("data:") ||
    value.startsWith("blob:") ||
    value.startsWith("mailto:") ||
    value.startsWith("tel:") ||
    value.startsWith("javascript:") ||
    value.startsWith("//") ||
    /^[a-z][a-z0-9+.-]*:/i.test(value)
  );
}

function resolveReference(fromPath: string, reference: string): string | null {
  if (isExternalReference(reference)) return null;
  const clean = reference.split("?")[0].split("#")[0].trim();
  if (!clean) return null;
  const normalizedFrom = normalizePath(fromPath);
  const base = normalizedFrom.includes("/")
    ? normalizedFrom.slice(0, normalizedFrom.lastIndexOf("/") + 1)
    : "";
  const absolute = clean.startsWith("/") ? clean.slice(1) : base + clean;
  return normalizePath(absolute);
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

export function bundleHtmlDocument(files: WorkspaceFile[], entryPath: string): string {
  const entry = files.find((file) => file.path === entryPath);
  if (!entry) return "";
  const contents = new Map(files.map((file) => [normalizePath(file.path), file.content]));
  let html = entry.content;

  html = html.replace(/<link\b[^>]*\/?>/gi, (tag) => {
    if (!/rel\s*=\s*["']?[^"'>]*stylesheet/i.test(tag)) return tag;
    const hrefMatch = tag.match(/href\s*=\s*["']([^"']+)["']/i);
    if (!hrefMatch) return tag;
    const resolved = resolveReference(entryPath, hrefMatch[1]);
    if (!resolved) return tag;
    const css = contents.get(resolved);
    if (css === undefined) return tag;
    return `<style data-devforge="${escapeAttribute(resolved)}">\n${css}\n</style>`;
  });

  html = html.replace(/<script\b([^>]*?)>\s*<\/script>/gi, (tag, attrs: string) => {
    const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (!srcMatch) return tag;
    const resolved = resolveReference(entryPath, srcMatch[1]);
    if (!resolved) return tag;
    const code = contents.get(resolved);
    if (code === undefined) return tag;
    const typeMatch = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i);
    const type = typeMatch ? ` type="${escapeAttribute(typeMatch[1])}"` : "";
    return `<script data-devforge="${escapeAttribute(resolved)}"${type}>\n${code}\n</script>`;
  });

  html = html.replace(/<script\b([^>]*?)\/>/gi, (tag, attrs: string) => {
    const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (!srcMatch) return tag;
    const resolved = resolveReference(entryPath, srcMatch[1]);
    if (!resolved) return tag;
    const code = contents.get(resolved);
    if (code === undefined) return tag;
    return `<script data-devforge="${escapeAttribute(resolved)}">\n${code}\n</script>`;
  });

  return html;
}

export function hasPreviewableProject(files: WorkspaceFile[]): boolean {
  return findHtmlEntry(files) !== null;
}
