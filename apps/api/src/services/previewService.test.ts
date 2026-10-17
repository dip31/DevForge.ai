import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createPreviewSession,
  getPreviewSession,
  normalizePreviewPath,
  PreviewError,
  previewContentType,
  rewriteAbsoluteReferences,
} from "./previewService";

afterEach(() => {
  vi.useRealTimers();
});

describe("normalizePreviewPath", () => {
  it("strips leading slashes and backslashes", () => {
    expect(normalizePreviewPath("/src/main.js")).toBe("src/main.js");
    expect(normalizePreviewPath("\\src\\main.js")).toBe("src/main.js");
    expect(normalizePreviewPath("src/./main.js")).toBe("src/main.js");
  });

  it("rejects traversal and empty paths", () => {
    expect(normalizePreviewPath("../secret")).toBeNull();
    expect(normalizePreviewPath("a/../../b")).toBeNull();
    expect(normalizePreviewPath("")).toBeNull();
    expect(normalizePreviewPath("   ")).toBeNull();
    expect(normalizePreviewPath("/")).toBeNull();
  });
});

describe("createPreviewSession", () => {
  it("defaults to index.html when it exists", () => {
    const { token, entry } = createPreviewSession({
      sessionId: "demo",
      files: [
        { path: "main.js", content: "" },
        { path: "index.html", content: "<h1>hi</h1>" },
      ],
    });
    expect(entry).toBe("index.html");
    const session = getPreviewSession(token);
    expect(session?.files.get("index.html")).toBe("<h1>hi</h1>");
  });

  it("honors an explicit entry and normalizes stored paths", () => {
    const { token, entry } = createPreviewSession({
      sessionId: "demo",
      entry: "pages/app.html",
      files: [
        { path: "/pages/app.html", content: "<p>app</p>" },
        { path: "./index.html", content: "<p>home</p>" },
      ],
    });
    expect(entry).toBe("pages/app.html");
    const session = getPreviewSession(token);
    expect(session?.files.has("pages/app.html")).toBe(true);
    expect(session?.files.has("index.html")).toBe(true);
  });

  it("throws NO_HTML_ENTRY when there is no html file", () => {
    expect(() =>
      createPreviewSession({ sessionId: "demo", files: [{ path: "a.js", content: "" }] }),
    ).toThrowError(PreviewError);
  });

  it("drops unsafe paths instead of storing them", () => {
    const { token } = createPreviewSession({
      sessionId: "demo",
      files: [
        { path: "index.html", content: "<h1>ok</h1>" },
        { path: "../escape.txt", content: "nope" },
      ],
    });
    const session = getPreviewSession(token);
    expect(session?.files.has("escape.txt")).toBe(false);
    expect([...(session?.files.keys() ?? [])]).toEqual(["index.html"]);
  });
});

describe("getPreviewSession", () => {
  it("returns null for unknown tokens", () => {
    expect(getPreviewSession("does-not-exist")).toBeNull();
  });

  it("expires sessions after the TTL", () => {
    vi.useFakeTimers();
    const { token } = createPreviewSession({
      sessionId: "demo",
      files: [{ path: "index.html", content: "<h1>hi</h1>" }],
    });
    expect(getPreviewSession(token)).not.toBeNull();
    vi.advanceTimersByTime(16 * 60 * 1000);
    expect(getPreviewSession(token)).toBeNull();
  });
});

describe("previewContentType", () => {
  it("maps common web extensions", () => {
    expect(previewContentType("index.html")).toContain("text/html");
    expect(previewContentType("main.mjs")).toContain("text/javascript");
    expect(previewContentType("style.css")).toContain("text/css");
    expect(previewContentType("mod.json")).toContain("application/json");
    expect(previewContentType("logo.svg")).toContain("image/svg+xml");
  });

  it("falls back to octet-stream for unknown extensions", () => {
    expect(previewContentType("archive.bin")).toBe("application/octet-stream");
    expect(previewContentType("LICENSE")).toBe("application/octet-stream");
  });
});

describe("rewriteAbsoluteReferences", () => {
  it("rewrites root-absolute references that exist in the workspace", () => {
    const files = new Map([
      ["index.html", ""],
      ["src/main.js", ""],
      ["style.css", ""],
    ]);
    const html = '<script src="/src/main.js"></script><link href="/style.css">';
    const result = rewriteAbsoluteReferences(html, "index.html", files);
    expect(result).toContain('src="./src/main.js"');
    expect(result).toContain('href="./style.css"');
  });

  it("computes relative paths from a nested entry document", () => {
    const files = new Map([
      ["pages/app.html", ""],
      ["style.css", ""],
      ["pages/local.js", ""],
    ]);
    const html = '<link href="/style.css"><script src="/pages/local.js"></script>';
    const result = rewriteAbsoluteReferences(html, "pages/app.html", files);
    expect(result).toContain('href="../style.css"');
    expect(result).toContain('src="./local.js"');
  });

  it("leaves references that are not workspace files untouched", () => {
    const html = '<img src="/missing.png"><script src="/src/x.js"></script>';
    const result = rewriteAbsoluteReferences(html, "index.html", new Map([["index.html", ""]]));
    expect(result).toBe(html);
  });
});
