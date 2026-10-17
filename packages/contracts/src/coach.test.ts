import { describe, it, expect } from "vitest";
import {
  classifyCoachIntent,
  generateCoachResponse,
  promptResponse,
  type CoachIntent,
} from "./coach";

const withFailure = {
  currentFile: "src/taskUtils.js",
  files: [
    {
      path: "src/taskUtils.js",
      content: "export function addTask(tasks, title) {\n  return [...tasks];\n}\n",
    },
  ],
  requirements: ["Add a task", "Filter tasks by status"],
  testResults: [
    {
      id: "filter",
      name: "Filtering tasks by status",
      status: "failed" as const,
      diagnostic: "Support both active and completed filtering in filterTasks.",
      criterion: "Filter tasks by status",
    },
  ],
};

const expectIntent = (prompt: string, intent: CoachIntent) => {
  expect(classifyCoachIntent(prompt).intent).toBe(intent);
};

describe("classifyCoachIntent", () => {
  it("classifies greetings of varying length and casing", () => {
    for (const text of ["hi", "hiii", "Hello", "hey", "good morning", "Hey there!"]) {
      expectIntent(text, "greeting");
    }
  });

  it("classifies theme and workspace requests", () => {
    for (const text of [
      "make the entire theme dark",
      "switch to dark mode",
      "change the editor theme",
      "please set a light theme",
    ]) {
      expectIntent(text, "theme");
    }
  });

  it("classifies code explanation requests", () => {
    for (const text of [
      "explain this code",
      "What does this function do?",
      "walk me through the active file",
    ]) {
      expectIntent(text, "explain");
    }
  });

  it("classifies hints, debugging, and test-failure requests", () => {
    expectIntent("give me a hint", "hint");
    expectIntent("help me get started", "hint");
    expectIntent("help me debug this error", "debug");
    expectIntent("why is this failing?", "debug");
    expectIntent("which tests are failing?", "test-failure");
    expectIntent("what acceptance criteria remain?", "test-failure");
  });

  it("is case-insensitive and tolerates punctuation/whitespace", () => {
    expectIntent("MAKE THE ENTIRE THEME DARK", "theme");
    expectIntent("  Explain   THIS code!!  ", "explain");
    expectIntent("HINT?", "hint");
  });

  it("prioritizes specific intents over the greeting fallback", () => {
    expectIntent("hi, please explain this function", "explain");
    expectIntent("hey can you give me a hint", "hint");
    expectIntent("hello, why is my test failing?", "debug");
  });

  it("returns a low-confidence unknown intent for unrelated messages", () => {
    const match = classifyCoachIntent("what is the capital of France?");
    expect(match.intent).toBe("unknown");
    expect(match.confidence).toBe("low");
  });
});

describe("promptResponse fallback quality", () => {
  it("answers a greeting with a greeting, not debugging instructions", () => {
    const result = promptResponse("hiii", withFailure);
    expect(result.content).toMatch(/hi!/i);
    expect(result.content).not.toMatch(/acceptance criterion at a time/i);
  });

  it("never sends a theme request to the generic debugging fallback", () => {
    const result = promptResponse("make the entire theme dark", withFailure);
    expect(result.content).toMatch(/can't change the theme/i);
    expect(result.content).not.toMatch(/Break the request into one acceptance criterion/i);
  });

  it("explains code using the active file when available", () => {
    const result = promptResponse("explain this code", withFailure);
    expect(result.content).toContain("src/taskUtils.js");
  });

  it("asks which file to explain when no code context is available", () => {
    const result = promptResponse("explain this code", {});
    expect(result.content).toMatch(/which file or function/i);
  });

  it("uses diagnostic context for debugging requests", () => {
    const result = promptResponse("help me debug this error", withFailure);
    expect(result.content).toContain("Filtering tasks by status");
  });

  it("does not invent test results for test-failure requests", () => {
    const result = promptResponse("which tests are failing?", {});
    expect(result.content).not.toContain("Filtering tasks by status");
    expect(result.content).toMatch(/don't have any stored test result/i);
  });

  it("responds honestly with a limitation for unsupported requests", () => {
    const result = promptResponse("write me a haiku about clouds", withFailure);
    expect(result.content).toMatch(/rule-based preview/i);
    expect(result.content).not.toMatch(/Break the request into one acceptance criterion/i);
  });

  it("answers capability questions without pretending to be an LLM", () => {
    const result = promptResponse("what can you do?", withFailure);
    expect(result.content).toMatch(/rule-based preview/i);
  });
});

describe("generateCoachResponse actions", () => {
  it("keeps Hint, Explain Code, and Debug Error actions working", () => {
    expect(generateCoachResponse("hint", "", withFailure).content).toContain(
      "Filtering tasks by status",
    );
    expect(generateCoachResponse("explain", "", withFailure).content).toContain("src/taskUtils.js");
    expect(generateCoachResponse("debug", "", withFailure).suggestion?.file).toBe(
      "src/taskUtils.js",
    );
  });

  it("uses real acceptance criteria for hints when no failure is stored", () => {
    const result = generateCoachResponse("hint", "", {
      requirements: ["Add a task", "Filter tasks by status"],
    });
    expect(result.content).toContain("Add a task");
  });
});
