import { describe, expect, it } from "vitest";

import type { WorkspaceFile } from "../data";

import { bundleHtmlDocument, findHtmlEntry, listHtmlFiles } from "./preview";

const file = (path: string, content: string): WorkspaceFile => ({
  path,
  language: "text",
  content,
});

describe("findHtmlEntry", () => {
  it("returns null when there are no HTML files", () => {
    expect(findHtmlEntry([file("src/app.js", "")])).toBeNull();
  });

  it("prefers a root index.html", () => {
    const entry = findHtmlEntry([
      file("public/index.html", "<html></html>"),
      file("index.html", "<html></html>"),
    ]);
    expect(entry).toBe("index.html");
  });

  it("falls back to the shallowest HTML file", () => {
    const entry = findHtmlEntry([
      file("pages/deep/about.html", ""),
      file("app.html", ""),
    ]);
    expect(entry).toBe("app.html");
  });
});

describe("listHtmlFiles", () => {
  it("only returns html files", () => {
    const files = [file("index.html", ""), file("style.css", ""), file("page.htm", "")];
    expect(listHtmlFiles(files).map((item) => item.path)).toEqual(["index.html", "page.htm"]);
  });
});

describe("bundleHtmlDocument", () => {
  it("inlines linked stylesheets from the workspace", () => {
    const files = [
      file("index.html", '<html><head><link rel="stylesheet" href="style.css" /></head></html>'),
      file("style.css", "body { color: red; }"),
    ];
    const html = bundleHtmlDocument(files, "index.html");
    expect(html).toContain("<style data-devforge=\"style.css\">");
    expect(html).toContain("body { color: red; }");
    expect(html).not.toContain("<link");
  });

  it("inlines local scripts and preserves the type attribute", () => {
    const files = [
      file("index.html", '<script type="module" src="./app.js"></script>'),
      file("app.js", "console.log('hi');"),
    ];
    const html = bundleHtmlDocument(files, "index.html");
    expect(html).toContain('<script data-devforge="app.js" type="module">');
    expect(html).toContain("console.log('hi');");
  });

  it("resolves relative script paths from a nested entry", () => {
    const files = [
      file("pages/index.html", '<script src="../scripts/main.js"></script>'),
      file("scripts/main.js", "run();"),
    ];
    const html = bundleHtmlDocument(files, "pages/index.html");
    expect(html).toContain("run();");
  });

  it("leaves external references untouched", () => {
    const files = [
      file("index.html", '<script src="https://cdn.example.com/x.js"></script>'),
    ];
    const html = bundleHtmlDocument(files, "index.html");
    expect(html).toContain('src="https://cdn.example.com/x.js"');
  });

  it("leaves unknown local references untouched", () => {
    const files = [file("index.html", '<script src="missing.js"></script>')];
    const html = bundleHtmlDocument(files, "index.html");
    expect(html).toContain('<script src="missing.js">');
  });

  it("returns an empty string for an unknown entry", () => {
    expect(bundleHtmlDocument([file("index.html", "")], "nope.html")).toBe("");
  });
});
