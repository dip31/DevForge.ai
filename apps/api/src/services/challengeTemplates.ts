import type { RunnerTest } from "@contracts/proofloop";

/**
 * Approved verification templates.
 *
 * A template is only offered to a candidate when it is present in the
 * `challenge_templates` table (seeded from this registry), is active, targets
 * the exact rubric criterion, and contains at least one private test. The
 * private tests here are never returned to candidates.
 */

export type ApprovedTemplateSeed = {
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
};

const binarySearchDuplicateHandlingTests: RunnerTest[] = [
  {
    id: "dup-first-index",
    name: "Returns the first index of a duplicated target",
    suite: "verification",
    criterion: "edge-case-handling",
    visibility: "private",
    args: [[1, 1, 1, 2, 3], 1],
    expected: 0,
  },
  {
    id: "dup-middle-index",
    name: "Returns the first index for duplicates in the middle",
    suite: "verification",
    criterion: "edge-case-handling",
    visibility: "private",
    args: [[1, 2, 2, 2, 3], 2],
    expected: 1,
  },
  {
    id: "dup-absent-insertion",
    name: "Returns the insertion index when duplicates are absent",
    suite: "verification",
    criterion: "edge-case-handling",
    visibility: "private",
    args: [[1, 1, 3, 3], 2],
    expected: 2,
  },
  {
    id: "empty-array",
    name: "Returns 0 for an empty array",
    suite: "verification",
    criterion: "edge-case-handling",
    visibility: "private",
    args: [[], 5],
    expected: 0,
  },
  {
    id: "single-element-present",
    name: "Finds the only element in a single-element array",
    suite: "verification",
    criterion: "edge-case-handling",
    visibility: "private",
    args: [[7], 7],
    expected: 0,
  },
  {
    id: "all-duplicates",
    name: "Handles an array of a single repeated value",
    suite: "verification",
    criterion: "edge-case-handling",
    visibility: "private",
    args: [[5, 5, 5], 5],
    expected: 0,
  },
];

export const APPROVED_CHALLENGE_TEMPLATES: ApprovedTemplateSeed[] = [
  {
    key: "binary-search-duplicate-handling",
    title: "Verification: duplicate and boundary handling in binary search",
    description:
      "A targeted follow-up that verifies binary search returns the first matching index for duplicated values and the correct insertion index when the target is absent.",
    skillKey: "edge-case-handling",
    targetCriterionId: "edge-case-handling",
    prompt:
      "Your binary search passed the basic cases but failed the duplicate-handling check. Update binarySearch so that it returns the first index of the target when duplicates exist, and the insertion index when the target is absent.",
    instructions:
      "Edit src/search.js only. Keep the same exported function name and signature. The private checks are not shown; passing them requires handling duplicate values and boundary indices correctly.",
    entryFile: "src/search.js",
    exportName: "binarySearch",
    privateTests: binarySearchDuplicateHandlingTests,
  },
];

export function getTemplateSeed(key: string): ApprovedTemplateSeed | undefined {
  return APPROVED_CHALLENGE_TEMPLATES.find((template) => template.key === key);
}
