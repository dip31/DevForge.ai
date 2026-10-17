import { describe, it, expect } from "vitest";
import {
  validateWorkspacePath,
  computeDiff,
  languageFromPath,
  buildListing,
  contentHash,
  type WorkspaceFileRecord,
} from "./workspaceService";

describe("validateWorkspacePath", () => {
  it("accepts a normal relative path and normalizes it", () => {
    const result = validateWorkspacePath("src/components/App.tsx");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.path).toBe("src/components/App.tsx");
  });

  it("collapses duplicate slashes and backslashes", () => {
    const result = validateWorkspacePath("src\\\\utils//helper.js");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.path).toBe("src/utils/helper.js");
  });

  it("rejects parent-directory traversal", () => {
    expect(validateWorkspacePath("../secrets.txt").ok).toBe(false);
    expect(validateWorkspacePath("src/../../etc/passwd").ok).toBe(false);
  });

  it("rejects absolute and drive paths", () => {
    expect(validateWorkspacePath("/etc/passwd").ok).toBe(false);
    expect(validateWorkspacePath("C:\\Windows\\System32").ok).toBe(false);
  });

  it("rejects reserved segments", () => {
    expect(validateWorkspacePath(".git/config").ok).toBe(false);
    expect(validateWorkspacePath("node_modules/x.js").ok).toBe(false);
    expect(validateWorkspacePath(".env").ok).toBe(false);
  });

  it("rejects empty and over-long paths", () => {
    expect(validateWorkspacePath("").ok).toBe(false);
    expect(validateWorkspacePath("   ").ok).toBe(false);
    expect(validateWorkspacePath("a".repeat(600)).ok).toBe(false);
  });

  it("rejects illegal control characters", () => {
    expect(validateWorkspacePath("src/fo\u0000o.js").ok).toBe(false);
  });
});

describe("computeDiff", () => {
  it("counts added and removed lines for an edit", () => {
    const diff = computeDiff("a\nb\nc", "a\nx\nc\nd");
    expect(diff.added).toBe(2); // x and d
    expect(diff.removed).toBe(1); // b
  });

  it("treats a create as all additions", () => {
    const diff = computeDiff(null, "line1\nline2");
    expect(diff.added).toBe(2);
    expect(diff.removed).toBe(0);
  });

  it("treats a delete as all removals", () => {
    const diff = computeDiff("line1\nline2", null);
    expect(diff.added).toBe(0);
    expect(diff.removed).toBe(2);
  });
});

describe("languageFromPath", () => {
  it("maps common extensions", () => {
    expect(languageFromPath("a/b.ts")).toBe("typescript");
    expect(languageFromPath("a/b.jsx")).toBe("jsx");
    expect(languageFromPath("a/b.json")).toBe("json");
    expect(languageFromPath("a/noext")).toBe("text");
  });
});

describe("buildListing", () => {
  it("synthesizes parent folders and directory markers", () => {
    const files: WorkspaceFileRecord[] = [
      { id: "1", path: "src/utils/deep/helper.js", language: "javascript", content: "x", isReadOnly: false },
      { id: "2", path: "assets/.gitkeep", language: "text", content: "", isReadOnly: false },
    ];
    const listing = buildListing(files);
    const paths = listing.map((e) => `${e.type}:${e.path}`);
    expect(paths).toContain("directory:src");
    expect(paths).toContain("directory:src/utils");
    expect(paths).toContain("directory:src/utils/deep");
    expect(paths).toContain("file:src/utils/deep/helper.js");
    expect(paths).toContain("directory:assets");
  });
});

describe("contentHash", () => {
  it("is deterministic and content-sensitive", () => {
    expect(contentHash("abc")).toBe(contentHash("abc"));
    expect(contentHash("abc")).not.toBe(contentHash("abd"));
  });
});
