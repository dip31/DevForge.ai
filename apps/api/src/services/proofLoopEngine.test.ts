import { describe, it, expect } from "vitest";
import {
  rankStatus,
  betterStatus,
  gapTypeFor,
  isGap,
  detectSkillGaps,
  openGaps,
  validateChallengeTemplate,
  selectChallengeTemplate,
  parseRunnerConfig,
  aggregateVerification,
  type ApprovedTemplate,
} from "./proofLoopEngine";
import { APPROVED_CHALLENGE_TEMPLATES, getTemplateSeed } from "./challengeTemplates";
import type { SkillStatus } from "@contracts/proofloop";
import type { TestExecutionResult } from "./testRunner";

const testResult = (
  id: string,
  status: TestExecutionResult["status"],
  visibility: "public" | "private" = "private",
): TestExecutionResult => ({
  id,
  name: id,
  suite: "verification",
  criterion: "edge-case-handling",
  visibility,
  status,
  durationMs: 1,
  message: status,
});

describe("status ranking", () => {
  it("ranks demonstrated above all weaker statuses", () => {
    expect(rankStatus("demonstrated")).toBeGreaterThan(rankStatus("partially_demonstrated"));
    expect(rankStatus("partially_demonstrated")).toBeGreaterThan(rankStatus("inconclusive"));
    expect(rankStatus("inconclusive")).toBeGreaterThan(rankStatus("not_assessed"));
    expect(rankStatus("not_assessed")).toBeGreaterThan(
      rankStatus("not_demonstrated_in_available_evidence"),
    );
  });

  it("picks the stronger of two statuses", () => {
    expect(betterStatus("not_assessed", "demonstrated")).toBe("demonstrated");
    expect(betterStatus("partially_demonstrated", "inconclusive")).toBe("partially_demonstrated");
    expect(betterStatus("demonstrated", "demonstrated")).toBe("demonstrated");
  });

  it("treats anything short of demonstrated as a gap", () => {
    expect(isGap("demonstrated")).toBe(false);
    expect(isGap("partially_demonstrated")).toBe(true);
    expect(isGap("inconclusive")).toBe(true);
    expect(isGap("not_assessed")).toBe(true);
    expect(isGap("not_demonstrated_in_available_evidence")).toBe(true);
  });

  it("maps statuses to gap types", () => {
    expect(gapTypeFor("demonstrated")).toBe("demonstrated");
    expect(gapTypeFor("partially_demonstrated")).toBe("partially_demonstrated");
    expect(gapTypeFor("inconclusive")).toBe("inconclusive");
    expect(gapTypeFor("not_assessed")).toBe("not_assessed");
    expect(gapTypeFor("not_demonstrated_in_available_evidence")).toBe("not_demonstrated");
  });
});

describe("detectSkillGaps", () => {
  it("carries evidence ids and criterion identity onto each gap", () => {
    const gaps = detectSkillGaps([
      {
        criterionId: "edge-case-handling",
        name: "Edge Case Handling",
        status: "not_demonstrated_in_available_evidence",
        evidenceIds: ["ev-1", "ev-2"],
        explanation: "All linked checks failed.",
      },
    ]);

    expect(gaps[0]).toMatchObject({
      criterionId: "edge-case-handling",
      skillKey: "edge-case-handling",
      status: "not_demonstrated_in_available_evidence",
      gapType: "not_demonstrated",
      reason: "All linked checks failed.",
      evidenceIds: ["ev-1", "ev-2"],
    });
  });

  it("provides a default reason when none is supplied", () => {
    const gaps = detectSkillGaps([
      { criterionId: "c", name: "C", status: "not_assessed", evidenceIds: [] },
    ]);
    expect(gaps[0].reason).toContain("not exercised");
  });

  it("filters demonstrated criteria out of open gaps", () => {
    const gaps = detectSkillGaps([
      { criterionId: "a", name: "A", status: "demonstrated", evidenceIds: [] },
      { criterionId: "b", name: "B", status: "inconclusive", evidenceIds: [] },
    ]);
    expect(openGaps(gaps).map((gap) => gap.criterionId)).toEqual(["b"]);
  });
});

describe("validateChallengeTemplate", () => {
  const base = getTemplateSeed("binary-search-duplicate-handling")!;
  const gap = { criterionId: base.targetCriterionId, skillKey: base.skillKey };

  it("accepts an active template whose target matches the gap", () => {
    const result = validateChallengeTemplate({ ...base, isActive: true }, gap);
    expect(result.ok).toBe(true);
  });

  it("rejects inactive templates", () => {
    const result = validateChallengeTemplate({ ...base, isActive: false }, gap);
    expect(result.ok).toBe(false);
  });

  it("rejects templates targeting the wrong criterion", () => {
    const result = validateChallengeTemplate({ ...base, isActive: true }, {
      criterionId: "search-correctness",
      skillKey: "search-correctness",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects templates with no private tests", () => {
    const result = validateChallengeTemplate({ ...base, isActive: true, privateTests: [] }, gap);
    expect(result.ok).toBe(false);
  });

  it("rejects malformed templates", () => {
    expect(validateChallengeTemplate(null, gap).ok).toBe(false);
    expect(validateChallengeTemplate({ foo: "bar" }, gap).ok).toBe(false);
  });
});

describe("selectChallengeTemplate", () => {
  it("selects the registry template for the binary-search edge-case gap", () => {
    const templates: ApprovedTemplate[] = APPROVED_CHALLENGE_TEMPLATES.map((template) => ({
      ...template,
      id: template.key,
      isActive: true,
    }));
    const gap = detectSkillGaps([
      {
        criterionId: "edge-case-handling",
        name: "Edge Case Handling",
        status: "not_demonstrated_in_available_evidence",
        evidenceIds: [],
      },
    ])[0];

    const selected = selectChallengeTemplate(gap, templates);
    expect(selected?.key).toBe("binary-search-duplicate-handling");
  });

  it("returns null when no approved template matches the gap", () => {
    const templates: ApprovedTemplate[] = APPROVED_CHALLENGE_TEMPLATES.map((template) => ({
      ...template,
      id: template.key,
      isActive: true,
    }));
    const gap = detectSkillGaps([
      { criterionId: "code-clarity", name: "Code Clarity", status: "not_assessed", evidenceIds: [] },
    ])[0];
    expect(selectChallengeTemplate(gap, templates)).toBeNull();
  });
});

describe("parseRunnerConfig", () => {
  it("parses a valid runner config", () => {
    const parsed = parseRunnerConfig({
      runner: "javascript-function",
      entryFile: "src/search.js",
      exportName: "binarySearch",
      timeoutMs: 1000,
      tests: [
        {
          id: "t1",
          name: "check",
          criterion: "search-correctness",
          visibility: "public",
          args: [[1], 1],
          expected: 0,
        },
      ],
    });
    expect(parsed?.exportName).toBe("binarySearch");
    expect(parsed?.tests).toHaveLength(1);
  });

  it("returns null for an invalid config", () => {
    expect(parseRunnerConfig({ runner: "python" })).toBeNull();
    expect(parseRunnerConfig(null)).toBeNull();
  });
});

describe("aggregateVerification", () => {
  it("raises a failed criterion when every follow-up check passes", () => {
    const aggregation = aggregateVerification("not_demonstrated_in_available_evidence", [
      testResult("a", "passed"),
      testResult("b", "passed"),
    ]);
    expect(aggregation.resultStatus).toBe("demonstrated");
    expect(aggregation.originalStatus).toBe("not_demonstrated_in_available_evidence");
    expect(aggregation.passedTests).toBe(2);
    expect(aggregation.combinedExplanation).toContain("Effective outcome: demonstrated");
  });

  it("never lowers an already-demonstrated status", () => {
    const aggregation = aggregateVerification("demonstrated", [testResult("a", "failed")]);
    expect(aggregation.resultStatus).toBe("demonstrated");
  });

  it("reports partial credit when only some follow-up checks pass", () => {
    const aggregation = aggregateVerification("not_assessed", [
      testResult("a", "passed"),
      testResult("b", "failed"),
    ]);
    expect(aggregation.resultStatus).toBe("partially_demonstrated");
  });

  it("is inconclusive when no follow-up checks ran", () => {
    const aggregation = aggregateVerification("not_assessed", []);
    expect(aggregation.resultStatus).toBe("inconclusive");
    expect(aggregation.combinedExplanation).toContain("0/0");
  });

  it("keeps the original status when the follow-up is weaker", () => {
    const aggregation = aggregateVerification("partially_demonstrated", [
      testResult("a", "failed"),
    ]);
    expect(aggregation.resultStatus).toBe("partially_demonstrated");
  });
});
