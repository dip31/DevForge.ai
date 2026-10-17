import { describe, it, expect } from "vitest";
import { buildCriterionFindings, toCriterionDbStatus, type RubricCriterion } from "./evaluationEngine";
import type { TestExecutionResult } from "./testRunner";
import type { SkillStatus } from "@contracts/proofloop";

const rubric: RubricCriterion[] = [
  { id: "search-correctness", name: "Search Correctness", description: "Finds targets.", weight: 50 },
  { id: "edge-case-handling", name: "Edge Case Handling", description: "Handles edges.", weight: 30 },
  { id: "code-clarity", name: "Code Clarity", description: "Readable code.", weight: 20 },
];

const result = (
  id: string,
  criterion: string,
  status: TestExecutionResult["status"],
  visibility: "public" | "private",
): TestExecutionResult => ({
  id,
  name: id,
  suite: visibility === "public" ? "public" : "verification",
  criterion,
  visibility,
  status,
  durationMs: 1,
  message: status,
});

describe("buildCriterionFindings", () => {
  it("marks a criterion demonstrated only when all linked checks pass", () => {
    const build = buildCriterionFindings(rubric, [
      result("p1", "search-correctness", "passed", "public"),
      result("p2", "search-correctness", "passed", "public"),
    ]);
    const finding = build.criteria.find((c) => c.criterionId === "search-correctness")!;
    expect(finding.status).toBe("demonstrated");
    expect(finding.supportedScore).toBe(100);
    expect(finding.sufficiency).toBe("sufficient");
  });

  it("marks a criterion as not assessed when no check maps to it", () => {
    const build = buildCriterionFindings(rubric, [
      result("p1", "search-correctness", "passed", "public"),
    ]);
    const clarity = build.criteria.find((c) => c.criterionId === "code-clarity")!;
    expect(clarity.status).toBe("not_assessed");
    expect(clarity.supportedScore).toBeNull();
    expect(clarity.missingEvidence.length).toBeGreaterThan(0);
    expect(build.limitations.join(" ")).toContain("no deterministic check");
  });

  it("gives partial credit when some linked checks fail", () => {
    const build = buildCriterionFindings(rubric, [
      result("v1", "edge-case-handling", "passed", "private"),
      result("v2", "edge-case-handling", "failed", "private"),
    ]);
    const finding = build.criteria.find((c) => c.criterionId === "edge-case-handling")!;
    expect(finding.status).toBe("partially_demonstrated");
    expect(finding.supportedScore).toBe(50);
    expect(finding.sufficiency).toBe("partial");
  });

  it("marks a criterion not demonstrated when every linked check fails", () => {
    const build = buildCriterionFindings(rubric, [
      result("v1", "edge-case-handling", "failed", "private"),
      result("v2", "edge-case-handling", "failed", "private"),
    ]);
    const finding = build.criteria.find((c) => c.criterionId === "edge-case-handling")!;
    expect(finding.status).toBe("not_demonstrated_in_available_evidence");
    expect(finding.supportedScore).toBe(0);
  });

  it("computes weighted aggregate score and evidence coverage", () => {
    const build = buildCriterionFindings(rubric, [
      result("p1", "search-correctness", "passed", "public"),
      result("v1", "edge-case-handling", "failed", "private"),
    ]);
    // search-correctness 100*50=5000; edge 0*30=0; clarity not assessed 0.
    // total weight 100 -> 5000/100 = 50
    expect(build.aggregateScore).toBe(50);
    // 2 of 3 criteria assessed -> 67%
    expect(build.evidenceCoverage).toBe(67);
  });

  it("notes when no hidden verification ran", () => {
    const build = buildCriterionFindings(rubric, [
      result("p1", "search-correctness", "passed", "public"),
    ]);
    expect(build.limitations.join(" ")).toContain("No hidden verification checks");
  });

  it("is inconclusive when nothing was assessed", () => {
    const build = buildCriterionFindings(rubric, []);
    expect(build.evaluationStatus).toBe("inconclusive");
    expect(build.aggregateScore).toBe(0);
  });
});

describe("toCriterionDbStatus", () => {
  it("maps not_assessed to inconclusive for the evaluation-criteria enum", () => {
    expect(toCriterionDbStatus("not_assessed")).toBe("inconclusive");
  });

  it("passes through statuses shared with the DB enum", () => {
    const shared: SkillStatus[] = [
      "demonstrated",
      "partially_demonstrated",
      "not_demonstrated_in_available_evidence",
      "inconclusive",
    ];
    for (const status of shared) {
      expect(toCriterionDbStatus(status)).toBe(status);
    }
  });
});
