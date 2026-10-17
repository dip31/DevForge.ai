import {
  runnerTestConfigSchema,
  runnerTestSchema,
  type RunnerTest,
  type RunnerTestConfig,
  type SkillStatus,
} from "@contracts/proofloop";
import type { TestExecutionResult } from "./testRunner";

export type CriterionStatusInput = {
  criterionId: string;
  name: string;
  status: SkillStatus;
  evidenceIds: string[];
  explanation?: string;
};

export type SkillGap = {
  criterionId: string;
  skillKey: string;
  name: string;
  status: SkillStatus;
  reason: string;
  evidenceIds: string[];
  gapType: "demonstrated" | "partially_demonstrated" | "not_assessed" | "inconclusive" | "not_demonstrated";
};

const STATUS_RANK: Record<SkillStatus, number> = {
  demonstrated: 4,
  partially_demonstrated: 3,
  inconclusive: 2,
  not_assessed: 1,
  not_demonstrated_in_available_evidence: 0,
};

/** Higher rank = stronger evidence. Used for best-of aggregation. */
export function rankStatus(status: SkillStatus): number {
  return STATUS_RANK[status] ?? 0;
}

export function betterStatus(a: SkillStatus, b: SkillStatus): SkillStatus {
  return rankStatus(a) >= rankStatus(b) ? a : b;
}

export function gapTypeFor(status: SkillStatus): SkillGap["gapType"] {
  switch (status) {
    case "demonstrated":
      return "demonstrated";
    case "partially_demonstrated":
      return "partially_demonstrated";
    case "inconclusive":
      return "inconclusive";
    case "not_assessed":
      return "not_assessed";
    case "not_demonstrated_in_available_evidence":
    default:
      return "not_demonstrated";
  }
}

export function isGap(status: SkillStatus): boolean {
  return status !== "demonstrated";
}

/**
 * Detect skill gaps for an evaluation. Every criterion that is not fully
 * demonstrated is surfaced as a gap; this is the input to challenge selection.
 */
export function detectSkillGaps(criteria: CriterionStatusInput[]): SkillGap[] {
  return criteria.map((criterion) => ({
    criterionId: criterion.criterionId,
    skillKey: criterion.criterionId,
    name: criterion.name,
    status: criterion.status,
    reason: criterion.explanation ?? reasonForStatus(criterion.status),
    evidenceIds: criterion.evidenceIds ?? [],
    gapType: gapTypeFor(criterion.status),
  }));
}

function reasonForStatus(status: SkillStatus): string {
  switch (status) {
    case "demonstrated":
      return "All linked checks passed.";
    case "partially_demonstrated":
      return "Some linked checks passed while others failed.";
    case "inconclusive":
      return "No deterministic check produces a conclusion for this criterion.";
    case "not_assessed":
      return "This criterion was not exercised by any deterministic check.";
    case "not_demonstrated_in_available_evidence":
    default:
      return "Linked checks failed against the submitted revision.";
  }
}

export function openGaps(gaps: SkillGap[]): SkillGap[] {
  return gaps.filter((gap) => isGap(gap.status));
}

export type ApprovedTemplate = {
  id: string;
  key: string;
  title: string;
  description: string;
  skillKey: string;
  targetCriterionId: string;
  prompt: string;
  instructions: string;
  entryFile: string;
  exportName: string;
  privateTests: RunnerTest[];
  isActive: boolean;
};

export type TemplateValidation =
  | { ok: true; template: ApprovedTemplate }
  | { ok: false; reason: string };

/**
 * Validate an approved challenge template before it is presented to a
 * candidate: structural schema, an active flag, at least one private test, and
 * a target criterion that matches the requested gap.
 */
export function validateChallengeTemplate(
  template: unknown,
  gap: Pick<SkillGap, "criterionId" | "skillKey">,
): TemplateValidation {
  if (!template || typeof template !== "object") {
    return { ok: false, reason: "Template not found." };
  }
  const t = template as ApprovedTemplate;
  if (!t.isActive) return { ok: false, reason: `Template "${t.key}" is not active.` };

  const tests = zSafeTests(t.privateTests);
  if (!tests.ok) return { ok: false, reason: `Template "${t.key}" has invalid private tests.` };
  if (tests.tests.length === 0) {
    return { ok: false, reason: `Template "${t.key}" defines no private verification tests.` };
  }

  if (t.targetCriterionId !== gap.criterionId) {
    return {
      ok: false,
      reason: `Template "${t.key}" targets "${t.targetCriterionId}" but the gap is "${gap.criterionId}".`,
    };
  }

  return { ok: true, template: { ...t, privateTests: tests.tests } };
}

function zSafeTests(value: unknown): { ok: boolean; tests: RunnerTest[] } {
  const parsed = runnerTestSchema.array().safeParse(value ?? []);
  return { ok: parsed.success, tests: parsed.success ? parsed.data : [] };
}

export function parseRunnerConfig(value: unknown): RunnerTestConfig | null {
  const parsed = runnerTestConfigSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * Select an approved template for a gap. Templates are matched by target
 * criterion id; the first active, valid template wins. Returns null when no
 * approved verification exists for the gap.
 */
export function selectChallengeTemplate<T extends ApprovedTemplate>(
  gap: SkillGap,
  templates: T[],
): T | null {
  for (const template of templates) {
    const validation = validateChallengeTemplate(template, gap);
    if (validation.ok) return template;
  }
  return null;
}

export type VerificationAggregation = {
  resultStatus: SkillStatus;
  originalStatus: SkillStatus;
  passedTests: number;
  totalTests: number;
  combinedExplanation: string;
};

/**
 * Combine the original criterion outcome with follow-up verification evidence.
 * The original status is preserved; the effective status is the best of the
 * two so a passing follow-up can raise the outcome without erasing history.
 */
export function aggregateVerification(
  originalStatus: SkillStatus,
  followUpResults: TestExecutionResult[],
): VerificationAggregation {
  const total = followUpResults.length;
  const passed = followUpResults.filter((result) => result.status === "passed").length;

  let followUpStatus: SkillStatus;
  if (total === 0) followUpStatus = "inconclusive";
  else if (passed === total) followUpStatus = "demonstrated";
  else if (passed > 0) followUpStatus = "partially_demonstrated";
  else followUpStatus = "not_demonstrated_in_available_evidence";

  const resultStatus = betterStatus(originalStatus, followUpStatus);

  const combinedExplanation =
    `Original outcome: ${originalStatus}. ` +
    `Follow-up verification: ${passed}/${total} private checks passed (${followUpStatus}). ` +
    `Effective outcome: ${resultStatus}.`;

  return {
    resultStatus,
    originalStatus,
    passedTests: passed,
    totalTests: total,
    combinedExplanation,
  };
}
