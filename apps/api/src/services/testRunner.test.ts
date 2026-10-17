import { describe, it, expect } from "vitest";
import { runJavaScriptFunctionTests, redactResultsForCandidate } from "./testRunner";
import type { RunnerTest } from "@contracts/proofloop";

const config = { entryFile: "src/search.js", exportName: "binarySearch", timeoutMs: 1000 };

const lowerBoundSource = `
export function binarySearch(sorted, target) {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (sorted[mid] < target) low = mid + 1;
    else high = mid;
  }
  return low;
}
`;

const naiveSource = `
export function binarySearch(sorted, target) {
  let low = 0;
  let high = sorted.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (sorted[mid] === target) return mid;
    if (sorted[mid] < target) low = mid + 1;
    else high = mid - 1;
  }
  return -1;
}
`;

const publicTests: RunnerTest[] = [
  {
    id: "basic-found",
    name: "finds a middle value",
    suite: "public",
    criterion: "search-correctness",
    visibility: "public",
    args: [[1, 3, 5, 7, 9], 5],
    expected: 2,
  },
];

const privateTests: RunnerTest[] = [
  {
    id: "dup-first-index",
    name: "first duplicate index",
    suite: "verification",
    criterion: "edge-case-handling",
    visibility: "private",
    args: [[1, 1, 1, 2, 3], 1],
    expected: 0,
  },
  {
    id: "absent-insertion",
    name: "insertion index",
    suite: "verification",
    criterion: "edge-case-handling",
    visibility: "private",
    args: [[1, 1, 3, 3], 2],
    expected: 2,
  },
];

describe("runJavaScriptFunctionTests", () => {
  it("passes public correctness tests for a correct lower-bound implementation", () => {
    const outcome = runJavaScriptFunctionTests(lowerBoundSource, config, publicTests);
    expect(outcome.ok).toBe(true);
    expect(outcome.results[0].status).toBe("passed");
  });

  it("fails hidden duplicate/absent checks for a naive but public-correct implementation", () => {
    const outcome = runJavaScriptFunctionTests(naiveSource, config, privateTests);
    expect(outcome.ok).toBe(true);
    expect(outcome.results.every((result) => result.status === "failed")).toBe(true);
  });

  it("passes hidden checks for the lower-bound implementation", () => {
    const outcome = runJavaScriptFunctionTests(lowerBoundSource, config, privateTests);
    expect(outcome.results.every((result) => result.status === "passed")).toBe(true);
  });

  it("rejects submissions containing disallowed constructs", () => {
    const source = `export function binarySearch() { return require("fs"); }`;
    const outcome = runJavaScriptFunctionTests(source, config, publicTests);
    expect(outcome.ok).toBe(false);
    expect(outcome.results[0].status).toBe("error");
  });

  it("reports a missing export as an error", () => {
    const source = `export function other() { return 1; }`;
    const outcome = runJavaScriptFunctionTests(source, config, publicTests);
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toContain("binarySearch");
  });

  it("reports an infinite loop as a timeout error", () => {
    const source = `export function binarySearch() { while (true) {} }`;
    const outcome = runJavaScriptFunctionTests(source, config, publicTests);
    expect(outcome.ok).toBe(true);
    expect(outcome.results[0].status).toBe("error");
    expect(outcome.results[0].message).toContain("timed out");
  });
});

describe("redactResultsForCandidate", () => {
  it("hides private test identity and details but keeps pass/fail", () => {
    const outcome = runJavaScriptFunctionTests(naiveSource, config, privateTests);
    const redacted = redactResultsForCandidate(outcome.results);

    expect(redacted).toHaveLength(2);
    for (const result of redacted) {
      expect(result.hidden).toBe(true);
      expect(result.id).toMatch(/^hidden-\d+$/);
      expect(result.name).toMatch(/^Hidden verification check \d+$/);
      expect(result.message).toBe("A hidden edge-case check did not pass.");
    }
  });

  it("preserves public test identity and messages", () => {
    const outcome = runJavaScriptFunctionTests(lowerBoundSource, config, publicTests);
    const redacted = redactResultsForCandidate(outcome.results);
    expect(redacted[0].hidden).toBe(false);
    expect(redacted[0].id).toBe("basic-found");
    expect(redacted[0].name).toBe("finds a middle value");
  });
});
