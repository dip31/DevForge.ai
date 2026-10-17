import type { SkillStatus } from "@contracts/proofloop";
import type { TestExecutionResult } from "./testRunner";

export type RubricCriterion = {
  id: string;
  name: string;
  description: string;
  category?: string;
  weight: number;
  points?: number;
};

export type CriterionFinding = {
  criterionId: string;
  name: string;
  description: string;
  rubric: string;
  weight: number;
  status: SkillStatus;
  supportedScore: number | null;
  sufficiency: "sufficient" | "partial" | "insufficient" | "invalid";
  missingEvidence: string[];
  explanation: string;
  candidateVisible: boolean;
  testResultIds: string[];
};

export type EvaluationBuild = {
  criteria: CriterionFinding[];
  evidenceCoverage: number;
  aggregateScore: number | null;
  evaluationStatus: "awaiting_evaluation" | "ready_for_review" | "inconclusive" | "needs_attention";
  limitations: string[];
};

const isPublic = (result: TestExecutionResult) => result.visibility === "public";

/**
 * Deterministically map test results onto rubric criteria. A test belongs to a
 * criterion when its `criterion` label equals the criterion id. Criteria with
 * no linked tests are reported as not assessed rather than assumed to pass.
 */
export function buildCriterionFindings(
  rubricCriteria: RubricCriterion[],
  testResults: TestExecutionResult[],
): EvaluationBuild {
  const findings: CriterionFinding[] = rubricCriteria.map((criterion) => {
    const linked = testResults.filter((result) => result.criterion === criterion.id);
    const passed = linked.filter((result) => result.status === "passed").length;
    const failed = linked.filter((result) => result.status !== "passed").length;

    let status: SkillStatus;
    let sufficiency: CriterionFinding["sufficiency"];
    let supportedScore: number | null = null;
    let explanation: string;
    const missingEvidence: string[] = [];

    if (linked.length === 0) {
      status = "not_assessed";
      sufficiency = "insufficient";
      explanation =
        "No deterministic check maps to this criterion, so it cannot be concluded from available evidence.";
      missingEvidence.push("A deterministic check that exercises this criterion.");
    } else if (failed === 0) {
      status = "demonstrated";
      sufficiency = "sufficient";
      supportedScore = 100;
      explanation = `All ${linked.length} linked check(s) passed against the submitted revision.`;
    } else if (passed > 0) {
      status = "partially_demonstrated";
      sufficiency = "partial";
      supportedScore = Math.round((passed / linked.length) * 100);
      explanation = `${passed} of ${linked.length} linked check(s) passed; ${failed} failed.`;
      missingEvidence.push("A passing result for every linked check.");
    } else {
      status = "not_demonstrated_in_available_evidence";
      sufficiency = "insufficient";
      supportedScore = 0;
      explanation = `All ${linked.length} linked check(s) failed against the submitted revision.`;
      missingEvidence.push("A passing result for every linked check.");
    }

    return {
      criterionId: criterion.id,
      name: criterion.name,
      description: criterion.description,
      rubric: criterion.description || criterion.name,
      weight: criterion.weight,
      status,
      supportedScore,
      sufficiency,
      missingEvidence,
      explanation,
      candidateVisible: true,
      testResultIds: linked.map((result) => result.id),
    };
  });

  const assessed = findings.filter((finding) => finding.testResultIds.length > 0);
  const evidenceCoverage = findings.length
    ? Math.round((assessed.length / findings.length) * 100)
    : 0;

  const totalWeight = findings.reduce((sum, finding) => sum + finding.weight, 0);
  const weighted = findings.reduce(
    (sum, finding) => sum + (finding.supportedScore ?? 0) * finding.weight,
    0,
  );
  const aggregateScore = totalWeight > 0 ? Math.round(weighted / totalWeight) : null;

  const limitations: string[] = [];
  const notAssessed = findings.filter((finding) => finding.status === "not_assessed");
  if (notAssessed.length > 0) {
    limitations.push(
      `${notAssessed.length} criterion(s) have no deterministic check and remain unevaluated.`,
    );
  }
  const now = testResults.filter((result) => result.visibility === "private");
  if (now.length === 0) {
    limitations.push("No hidden verification checks were executed for this submission.");
  }

  let evaluationStatus: EvaluationBuild["evaluationStatus"] = "ready_for_review";
  if (assessed.length === 0) evaluationStatus = "inconclusive";

  return { criteria: findings, evidenceCoverage, aggregateScore, evaluationStatus, limitations };
}

export type CriterionDbStatus =
  | "demonstrated"
  | "partially_demonstrated"
  | "not_demonstrated_in_available_evidence"
  | "inconclusive"
  | "invalid_assessment_evidence";

export function toCriterionDbStatus(status: SkillStatus): CriterionDbStatus {
  if (status === "not_assessed") return "inconclusive";
  return status;
}
