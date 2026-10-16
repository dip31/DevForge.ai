import { describe, it, expect } from "vitest";
import { generateCoachResponse, COACH_MODEL, COACH_PROVIDER } from "./coachEngine";

const context = {
  currentFile: "src/taskUtils.js",
  files: [
    {
      path: "src/taskUtils.js",
      content: "export function addTask(tasks, title) {\n  return [...tasks];\n}\n",
    },
  ],
  testResults: [
    {
      id: "add",
      name: "Adding a task",
      status: "passed" as const,
      diagnostic: "ok",
      criterion: "Add a task",
    },
    {
      id: "filter",
      name: "Filtering tasks by status",
      status: "failed" as const,
      diagnostic: "Support both active and completed filtering in filterTasks.",
      criterion: "Filter tasks by status",
    },
  ],
};

describe("generateCoachResponse", () => {
  it("exposes a local deterministic provider identity", () => {
    expect(COACH_PROVIDER).toBe("local");
    expect(COACH_MODEL).toBe("deterministic-v1");
  });

  it("hints at the first failed supported check", () => {
    const result = generateCoachResponse("hint", "", context);
    expect(result.content).toContain("Filtering tasks by status");
    expect(result.content).toContain("Support both active and completed filtering");
    expect(result.explanation).toMatch(/latest deterministic test result/i);
  });

  it("hints generically when nothing has failed", () => {
    const result = generateCoachResponse("hint", "", {});
    expect(result.content).toMatch(/connecting one acceptance criterion/i);
    expect(result.suggestion).toBeUndefined();
  });

  it("explains the active file using its path and line count", () => {
    const result = generateCoachResponse("explain", "", context);
    expect(result.content).toContain("src/taskUtils.js");
    expect(result.content).toContain("4 lines");
  });

  it("reports the latest failure for debug and suggests a filter fix", () => {
    const result = generateCoachResponse("debug", "", context);
    expect(result.content).toContain("Filtering tasks by status");
    expect(result.suggestion?.file).toBe("src/taskUtils.js");
    expect(result.suggestion?.label).toBe("Insert filter implementation");
    expect(result.suggestion?.content).toContain("export function filterTasks");
  });

  it("asks for a test run when debugging with no failures", () => {
    const result = generateCoachResponse("debug", "", {});
    expect(result.content).toMatch(/Run Tests first/i);
    expect(result.suggestion).toBeUndefined();
  });

  it("responds to a free-text filter question with a suggestion", () => {
    const result = generateCoachResponse("prompt", "How do I fix the filter?", context);
    expect(result.content).toMatch(/pure transformation/i);
    expect(result.suggestion?.content).toContain("filterTasks");
  });

  it("responds to an empty-state question", () => {
    const result = generateCoachResponse("prompt", "What about the empty state?", context);
    expect(result.content).toMatch(/empty task list/i);
  });

  it("falls back to guidance for unrecognized prompts", () => {
    const result = generateCoachResponse("prompt", "hello there", context);
    expect(result.content).toMatch(/one acceptance criterion at a time/i);
  });
});
