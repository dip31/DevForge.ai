import { describe, it, expect } from "vitest";
import { planReconciliation } from "./workspaceBridge";
import type { WorkspaceFileRecord } from "../workspaceService";

describe("WorkspaceBridge", () => {
  describe("planReconciliation", () => {
    it("should detect new files", () => {
      const baseline = new Map<string, string>();
      const working = new Map([["src/new.ts", "export const x = 1;"]]);
      const current = new Map<string, WorkspaceFileRecord>();

      const plan = planReconciliation(baseline, working, current);

      expect(plan).toHaveLength(1);
      expect(plan[0].action).toBe("create");
      expect(plan[0].path).toBe("src/new.ts");
      expect(plan[0].content).toBe("export const x = 1;");
      expect(plan[0].conflict).toBeUndefined();
    });

    it("should detect file edits", () => {
      const baseline = new Map([["src/file.ts", "const x = 1;"]]);
      const working = new Map([["src/file.ts", "const x = 2;"]]);
      const current = new Map([
        [
          "src/file.ts",
          {
            id: "1",
            path: "src/file.ts",
            language: "typescript",
            content: "const x = 1;",
            isReadOnly: false,
          },
        ],
      ]);

      const plan = planReconciliation(baseline, working, current);

      expect(plan).toHaveLength(1);
      expect(plan[0].action).toBe("edit");
      expect(plan[0].path).toBe("src/file.ts");
      expect(plan[0].content).toBe("const x = 2;");
      expect(plan[0].previous).toBe("const x = 1;");
      expect(plan[0].conflict).toBeUndefined();
    });

    it("should detect stale-file conflicts", () => {
      const baseline = new Map([["src/file.ts", "const x = 1;"]]);
      const working = new Map([["src/file.ts", "const x = 2;"]]);
      const current = new Map([
        [
          "src/file.ts",
          {
            id: "1",
            path: "src/file.ts",
            language: "typescript",
            content: "const x = 3;", // Changed by someone else
            isReadOnly: false,
          },
        ],
      ]);

      const plan = planReconciliation(baseline, working, current);

      expect(plan).toHaveLength(1);
      expect(plan[0].action).toBe("edit");
      expect(plan[0].conflict).toBe("File changed since the agent started.");
    });

    it("should detect deletions", () => {
      const baseline = new Map([["src/old.ts", "const x = 1;"]]);
      const working = new Map<string, string>();
      const current = new Map([
        [
          "src/old.ts",
          {
            id: "1",
            path: "src/old.ts",
            language: "typescript",
            content: "const x = 1;",
            isReadOnly: false,
          },
        ],
      ]);

      const plan = planReconciliation(baseline, working, current);

      expect(plan).toHaveLength(1);
      expect(plan[0].action).toBe("delete");
      expect(plan[0].path).toBe("src/old.ts");
      expect(plan[0].previous).toBe("const x = 1;");
      expect(plan[0].content).toBeNull();
    });

    it("should skip deletions when file is already gone", () => {
      const baseline = new Map([["src/old.ts", "const x = 1;"]]);
      const working = new Map<string, string>();
      const current = new Map<string, WorkspaceFileRecord>();

      const plan = planReconciliation(baseline, working, current);

      expect(plan).toHaveLength(0);
    });

    it("should reject read-only file edits", () => {
      const baseline = new Map([["src/readonly.ts", "const x = 1;"]]);
      const working = new Map([["src/readonly.ts", "const x = 2;"]]);
      const current = new Map([
        [
          "src/readonly.ts",
          {
            id: "1",
            path: "src/readonly.ts",
            language: "typescript",
            content: "const x = 1;",
            isReadOnly: true,
          },
        ],
      ]);

      const plan = planReconciliation(baseline, working, current);

      expect(plan).toHaveLength(1);
      expect(plan[0].conflict).toBe("File is read-only.");
    });

    it("should reject read-only file deletions", () => {
      const baseline = new Map([["src/readonly.ts", "const x = 1;"]]);
      const working = new Map<string, string>();
      const current = new Map([
        [
          "src/readonly.ts",
          {
            id: "1",
            path: "src/readonly.ts",
            language: "typescript",
            content: "const x = 1;",
            isReadOnly: true,
          },
        ],
      ]);

      const plan = planReconciliation(baseline, working, current);

      expect(plan).toHaveLength(1);
      expect(plan[0].action).toBe("delete");
      expect(plan[0].conflict).toBe("File is read-only.");
    });

    it("should reject creates that would overwrite existing files", () => {
      const baseline = new Map<string, string>();
      const working = new Map([["src/existing.ts", "const x = 1;"]]);
      const current = new Map([
        [
          "src/existing.ts",
          {
            id: "1",
            path: "src/existing.ts",
            language: "typescript",
            content: "const x = 0;",
            isReadOnly: false,
          },
        ],
      ]);

      const plan = planReconciliation(baseline, working, current);

      expect(plan).toHaveLength(1);
      expect(plan[0].action).toBe("create");
      expect(plan[0].conflict).toBe("File already exists in the workspace.");
    });

    it("should reject oversized files", () => {
      const baseline = new Map<string, string>();
      const hugeContent = "x".repeat(150_000);
      const working = new Map([["src/huge.ts", hugeContent]]);
      const current = new Map<string, WorkspaceFileRecord>();

      const plan = planReconciliation(baseline, working, current);

      expect(plan).toHaveLength(1);
      expect(plan[0].conflict).toContain("exceeds the maximum size");
    });

    it("should reject invalid paths", () => {
      const baseline = new Map<string, string>();
      const working = new Map([
        ["../escape.ts", "bad"],
        ["/absolute.ts", "bad"],
      ]);
      const current = new Map<string, WorkspaceFileRecord>();

      const plan = planReconciliation(baseline, working, current);

      expect(plan.length).toBeGreaterThan(0);
      expect(plan.every((p) => p.conflict != null)).toBe(true);
    });

    it("should skip unchanged files", () => {
      const baseline = new Map([["src/unchanged.ts", "const x = 1;"]]);
      const working = new Map([["src/unchanged.ts", "const x = 1;"]]);
      const current = new Map([
        [
          "src/unchanged.ts",
          {
            id: "1",
            path: "src/unchanged.ts",
            language: "typescript",
            content: "const x = 1;",
            isReadOnly: false,
          },
        ],
      ]);

      const plan = planReconciliation(baseline, working, current);

      expect(plan).toHaveLength(0);
    });
  });
});
