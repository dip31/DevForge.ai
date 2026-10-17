/**
 * Idempotent demo-data seed.
 *
 * Creates a demo organization with published/draft assessments (each with a
 * current version, rubric, starter files, and test config) plus global practice
 * tasks. Re-running is safe: every row is looked up before insert.
 *
 * Optionally links demo users to the org + an assignment when the following
 * env vars are set (the users must already have a user_profiles row, which is
 * created automatically on first login via POST /api/v1/auth/profile):
 *   DEMO_RECRUITER_EMAIL  -> owner membership
 *   DEMO_CANDIDATE_EMAIL  -> member membership + an assignment on the first
 *                            published assessment
 *
 * Run: npm run db:seed --workspace=apps/api
 */
import { and, eq } from "drizzle-orm";

import {
  organizations,
  organizationMemberships,
  userProfiles,
  assessments,
  assessmentVersions,
  rubricVersions,
  assessmentFiles,
  assessmentTestConfigs,
  practiceTasks,
  candidateAssignments,
  challengeTemplates,
} from "@database/schema";

import { db, closeDatabase } from "../services/database";
import { APPROVED_CHALLENGE_TEMPLATES } from "../services/challengeTemplates";

type RubricCriterion = {
  id: string;
  name: string;
  description: string;
  category: string;
  weight: number;
  points: number;
};

type FileSeed = {
  path: string;
  language: string;
  content: string;
  isReadOnly?: boolean;
  isHidden?: boolean;
  order?: number;
};

type AssessmentSeed = {
  title: string;
  description: string;
  role: string;
  skills: string;
  durationMinutes: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  status: "draft" | "published" | "archived";
  criteria: RubricCriterion[];
  files: FileSeed[];
  testCommand: string;
  hiddenTestFiles: string[];
  publicTestFiles: string[];
  testConfig?: Record<string, unknown>;
};

const ORG = {
  name: "NovaTech Solutions",
  slug: "nova-tech-solutions",
  description: "Demo organization for local development.",
  websiteUrl: "https://example.com",
  billingEmail: "billing@novatech.example",
};

const ASSESSMENTS: AssessmentSeed[] = [
  {
    title: "React Analytics Dashboard",
    description:
      "Build a responsive analytics dashboard in React with charts, filtering, and a data table backed by a mock API.",
    role: "Senior Frontend Engineer",
    skills: "React, TypeScript, Tailwind CSS, Data Visualization",
    durationMinutes: 90,
    difficulty: "intermediate",
    status: "published",
    criteria: [
      {
        id: "component-architecture",
        name: "Component Architecture",
        description: "Clean, reusable component decomposition with sensible state ownership.",
        category: "Code Quality",
        weight: 30,
        points: 30,
      },
      {
        id: "data-visualization",
        name: "Data Visualization",
        description: "Accurate, readable charts with correct axis and tooltip behaviour.",
        category: "Functionality",
        weight: 30,
        points: 30,
      },
      {
        id: "performance",
        name: "Performance",
        description: "Avoids unnecessary renders and handles large datasets smoothly.",
        category: "Performance",
        weight: 20,
        points: 20,
      },
      {
        id: "accessibility",
        name: "Accessibility",
        description: "Keyboard navigable with appropriate ARIA roles and labels.",
        category: "Quality",
        weight: 20,
        points: 20,
      },
    ],
    files: [
      {
        path: "src/App.tsx",
        language: "typescript",
        content: "export default function App() {\n  return <main>Analytics Dashboard</main>;\n}\n",
        order: 0,
      },
      {
        path: "src/components/Chart.tsx",
        language: "typescript",
        content: 'export function Chart() {\n  return <svg role="img" aria-label="chart" />;\n}\n',
        order: 1,
      },
      {
        path: "src/data/mock.ts",
        language: "typescript",
        content:
          "export const points = Array.from({ length: 30 }, (_, i) => ({ x: i, y: i * 3 }));\n",
        order: 2,
      },
      {
        path: "README.md",
        language: "markdown",
        content: "# React Analytics Dashboard\n\nImplement the dashboard described in the brief.\n",
        isReadOnly: true,
        order: 3,
      },
    ],
    testCommand: "npm test",
    hiddenTestFiles: ["src/__tests__/hidden.test.ts"],
    publicTestFiles: ["src/__tests__/app.test.tsx"],
  },
  {
    title: "REST API Design",
    description:
      "Design and implement a versioned REST API with authentication, pagination, and consistent error handling.",
    role: "Backend Engineer",
    skills: "Node.js, Fastify, REST, PostgreSQL",
    durationMinutes: 120,
    difficulty: "advanced",
    status: "published",
    criteria: [
      {
        id: "api-design",
        name: "API Design",
        description: "Resource modelling, status codes, and versioning are consistent.",
        category: "Design",
        weight: 35,
        points: 35,
      },
      {
        id: "error-handling",
        name: "Error Handling",
        description: "Meaningful, structured errors without leaking internals.",
        category: "Robustness",
        weight: 30,
        points: 30,
      },
      {
        id: "testing",
        name: "Testing",
        description: "Endpoints covered by integration tests including edge cases.",
        category: "Quality",
        weight: 35,
        points: 35,
      },
    ],
    files: [
      {
        path: "src/server.ts",
        language: "typescript",
        content: "import Fastify from 'fastify';\nexport const server = Fastify();\n",
        order: 0,
      },
      {
        path: "README.md",
        language: "markdown",
        content: "# REST API Design\n\nSee the brief in the task description.\n",
        isReadOnly: true,
        order: 1,
      },
    ],
    testCommand: "npm test",
    hiddenTestFiles: ["test/hidden.spec.ts"],
    publicTestFiles: ["test/server.spec.ts"],
  },
  {
    title: "Binary Search — Duplicate Handling",
    description:
      "Implement an order-independent binary search that returns the first index of a target and the correct insertion index when the target is absent. The assessment pairs public correctness checks with hidden duplicate/edge-case checks to drive a targeted verification challenge.",
    role: "Software Engineer",
    skills: "Algorithms, Arrays, JavaScript, Testing",
    durationMinutes: 30,
    difficulty: "intermediate",
    status: "published",
    criteria: [
      {
        id: "search-correctness",
        name: "Search Correctness",
        description: "Finds existing targets at their index and returns sane indices for boundary values.",
        category: "Functionality",
        weight: 50,
        points: 50,
      },
      {
        id: "edge-case-handling",
        name: "Edge Case Handling",
        description:
          "Handles duplicate values, empty arrays, single-element arrays, and the absent-target insertion index.",
        category: "Robustness",
        weight: 30,
        points: 30,
      },
      {
        id: "code-clarity",
        name: "Code Clarity",
        description: "Readable, well-structured implementation with clear variable names.",
        category: "Quality",
        weight: 20,
        points: 20,
      },
    ],
    files: [
      {
        path: "src/search.js",
        language: "javascript",
        content:
          "/**\n * Return the index of `target` in the ascending `sorted` array.\n * When `target` is absent, return the insertion index (lower bound).\n * When duplicates exist, return the first matching index.\n */\nexport function binarySearch(sorted, target) {\n  let low = 0;\n  let high = sorted.length - 1;\n  while (low <= high) {\n    const mid = Math.floor((low + high) / 2);\n    if (sorted[mid] === target) return mid;\n    if (sorted[mid] < target) low = mid + 1;\n    else high = mid - 1;\n  }\n  return -1;\n}\n",
        order: 0,
      },
      {
        path: "README.md",
        language: "markdown",
        content:
          "# Binary Search — Duplicate Handling\n\nImplement `binarySearch(sorted, target)` in `src/search.js`. Return the first matching index for duplicates and the insertion index when the target is absent.\n",
        isReadOnly: true,
        order: 1,
      },
    ],
    testCommand: "npm test",
    hiddenTestFiles: ["src/__tests__/search.hidden.test.js"],
    publicTestFiles: ["src/__tests__/search.test.js"],
    testConfig: {
      runner: "javascript-function",
      entryFile: "src/search.js",
      exportName: "binarySearch",
      timeoutMs: 2000,
      tests: [
        {
          id: "basic-found",
          name: "Finds a target in the middle of the array",
          suite: "public",
          criterion: "search-correctness",
          visibility: "public",
          args: [[1, 3, 5, 7, 9], 5],
          expected: 2,
        },
        {
          id: "found-first",
          name: "Finds the first element",
          suite: "public",
          criterion: "search-correctness",
          visibility: "public",
          args: [[2, 4, 6, 8], 2],
          expected: 0,
        },
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
          id: "absent-insertion",
          name: "Returns the insertion index when the target is absent",
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
          id: "single-element",
          name: "Handles a single-element array",
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
      ],
    },
  },
  {
    title: "Batch Data Pipeline",
    description:
      "Implement an ETL pipeline that ingests CSV files, normalises records, and writes aggregated output.",
    role: "Data Engineer",
    skills: "Python, ETL, SQL",
    durationMinutes: 60,
    difficulty: "intermediate",
    status: "draft",
    criteria: [
      {
        id: "correctness",
        name: "Correctness",
        description: "Aggregations match the specification for all edge cases.",
        category: "Functionality",
        weight: 50,
        points: 50,
      },
      {
        id: "code-clarity",
        name: "Code Clarity",
        description: "Readable, well-structured pipeline code.",
        category: "Quality",
        weight: 50,
        points: 50,
      },
    ],
    files: [
      {
        path: "pipeline.py",
        language: "python",
        content:
          "def run(input_path: str, output_path: str) -> None:\n    raise NotImplementedError\n",
        order: 0,
      },
    ],
    testCommand: "pytest",
    hiddenTestFiles: ["tests/test_hidden.py"],
    publicTestFiles: ["tests/test_pipeline.py"],
  },
];

const PRACTICE_TASKS = [
  {
    title: "Debounce Utility",
    description: "Implement a debounce function with cancel and flush support.",
    difficulty: "beginner",
    skills: ["JavaScript", "Functions"],
    durationMinutes: 20,
    starterFiles: [
      {
        path: "src/debounce.ts",
        language: "typescript",
        content: "export function debounce(fn: (...args: unknown[]) => void, wait: number) {}\n",
      },
    ],
    testPatterns: ["debounce", "cancel", "flush"],
    order: 0,
  },
  {
    title: "Array Deduplication",
    description: "Deduplicate an array of objects by a key while preserving order.",
    difficulty: "beginner",
    skills: ["JavaScript", "Arrays"],
    durationMinutes: 15,
    starterFiles: [
      {
        path: "src/dedupe.ts",
        language: "typescript",
        content: "export function dedupeBy<T>(items: T[], key: (item: T) => unknown): T[] {}\n",
      },
    ],
    testPatterns: ["dedupe", "order"],
    order: 1,
  },
  {
    title: "Async Rate Limiter",
    description: "Build a rate limiter that allows N concurrent async operations.",
    difficulty: "intermediate",
    skills: ["JavaScript", "Async"],
    durationMinutes: 35,
    starterFiles: [
      {
        path: "src/limiter.ts",
        language: "typescript",
        content: "export function createLimiter(concurrency: number) {}\n",
      },
    ],
    testPatterns: ["concurrency", "queue"],
    order: 2,
  },
  {
    title: "Binary Search",
    description: "Implement binary search returning the insertion index when absent.",
    difficulty: "beginner",
    skills: ["Algorithms", "Arrays"],
    durationMinutes: 15,
    starterFiles: [
      {
        path: "src/search.ts",
        language: "typescript",
        content: "export function binarySearch(sorted: number[], target: number): number {}\n",
      },
    ],
    testPatterns: ["search", "edge-cases"],
    order: 3,
  },
];

async function seedChallengeTemplates() {
  for (const template of APPROVED_CHALLENGE_TEMPLATES) {
    const existing = await db
      .select()
      .from(challengeTemplates)
      .where(eq(challengeTemplates.key, template.key))
      .limit(1);

    if (existing[0]) {
      await db
        .update(challengeTemplates)
        .set({
          title: template.title,
          description: template.description,
          skillKey: template.skillKey,
          targetCriterionId: template.targetCriterionId,
          prompt: template.prompt,
          instructions: template.instructions,
          entryFile: template.entryFile,
          exportName: template.exportName,
          privateTests: template.privateTests,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(challengeTemplates.id, existing[0].id));
      console.log(`  challenge template: ${template.key} (updated)`);
      continue;
    }

    await db.insert(challengeTemplates).values({
      key: template.key,
      title: template.title,
      description: template.description,
      skillKey: template.skillKey,
      targetCriterionId: template.targetCriterionId,
      prompt: template.prompt,
      instructions: template.instructions,
      entryFile: template.entryFile,
      exportName: template.exportName,
      privateTests: template.privateTests,
      isActive: true,
    });
    console.log(`  challenge template: ${template.key}`);
  }
}

async function seedOrganization() {
  const existing = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, ORG.slug))
    .limit(1);

  if (existing[0]) return existing[0];

  const [created] = await db.insert(organizations).values(ORG).returning();
  return created;
}

async function seedAssessment(organizationId: string, seed: AssessmentSeed) {
  const existing = await db
    .select()
    .from(assessments)
    .where(and(eq(assessments.organizationId, organizationId), eq(assessments.title, seed.title)))
    .limit(1);

  let assessment = existing[0];

  if (!assessment) {
    const [created] = await db
      .insert(assessments)
      .values({
        organizationId,
        title: seed.title,
        description: seed.description,
        role: seed.role,
        skills: seed.skills,
        durationMinutes: seed.durationMinutes,
        difficulty: seed.difficulty,
        status: seed.status,
        publishedAt: seed.status === "published" ? new Date() : null,
      })
      .returning();
    assessment = created;
  }

  const existingVersion = await db
    .select()
    .from(assessmentVersions)
    .where(
      and(eq(assessmentVersions.assessmentId, assessment.id), eq(assessmentVersions.version, 1)),
    )
    .limit(1);

  let version = existingVersion[0];

  if (!version) {
    const [created] = await db
      .insert(assessmentVersions)
      .values({
        assessmentId: assessment.id,
        version: 1,
        title: seed.title,
        description: seed.description,
        role: seed.role,
        skills: seed.skills,
        durationMinutes: seed.durationMinutes,
        difficulty: seed.difficulty,
        starterFiles: seed.files.map((file) => ({
          path: file.path,
          language: file.language,
          content: file.content,
          isReadOnly: file.isReadOnly ?? false,
          isHidden: file.isHidden ?? false,
          order: file.order ?? 0,
        })),
        testConfig: seed.testConfig ?? {},
        isCurrent: true,
        publishedAt: seed.status === "published" ? new Date() : null,
      })
      .returning();
    version = created;
  } else if (seed.testConfig && Object.keys((version.testConfig as object) ?? {}).length === 0) {
    // Backfill the executable test config for pre-existing seed versions.
    const [updated] = await db
      .update(assessmentVersions)
      .set({ testConfig: seed.testConfig })
      .where(eq(assessmentVersions.id, version.id))
      .returning();
    version = updated;
  }

  const existingRubric = await db
    .select()
    .from(rubricVersions)
    .where(and(eq(rubricVersions.assessmentVersionId, version.id), eq(rubricVersions.version, 1)))
    .limit(1);

  if (!existingRubric[0]) {
    await db.insert(rubricVersions).values({
      assessmentVersionId: version.id,
      version: 1,
      criteria: seed.criteria,
      totalPoints: seed.criteria.reduce((sum, c) => sum + c.points, 0),
      isCurrent: true,
    });
  }

  const existingFiles = await db
    .select()
    .from(assessmentFiles)
    .where(eq(assessmentFiles.assessmentVersionId, version.id))
    .limit(1);

  if (!existingFiles[0]) {
    await db.insert(assessmentFiles).values(
      seed.files.map((file, index) => ({
        assessmentVersionId: version.id,
        path: file.path,
        language: file.language,
        content: file.content,
        isReadOnly: file.isReadOnly ?? false,
        isHidden: file.isHidden ?? false,
        order: file.order ?? index,
      })),
    );
  }

  const existingTestConfig = await db
    .select()
    .from(assessmentTestConfigs)
    .where(eq(assessmentTestConfigs.assessmentVersionId, version.id))
    .limit(1);

  if (!existingTestConfig[0]) {
    await db.insert(assessmentTestConfigs).values({
      assessmentVersionId: version.id,
      testCommand: seed.testCommand,
      hiddenTestFiles: seed.hiddenTestFiles,
      publicTestFiles: seed.publicTestFiles,
    });
  }

  return assessment;
}

async function seedPracticeTask(seed: (typeof PRACTICE_TASKS)[number]) {
  const existing = await db
    .select()
    .from(practiceTasks)
    .where(eq(practiceTasks.title, seed.title))
    .limit(1);

  if (existing[0]) return existing[0];

  const [created] = await db.insert(practiceTasks).values(seed).returning();
  return created;
}

async function ensureMembership(
  organizationId: string,
  userId: string,
  role: "owner" | "admin" | "member" | "viewer",
) {
  const existing = await db
    .select()
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.organizationId, organizationId),
        eq(organizationMemberships.userId, userId),
      ),
    )
    .limit(1);

  if (existing[0]) return existing[0];

  const [created] = await db
    .insert(organizationMemberships)
    .values({ organizationId, userId, role, acceptedAt: new Date() })
    .returning();
  return created;
}

async function findProfileByEmail(email: string) {
  const rows = await db.select().from(userProfiles).where(eq(userProfiles.email, email)).limit(1);
  return rows[0];
}

async function linkDemoUsers(
  organizationId: string,
  publishedAssessments: Array<{ assessmentId: string; versionId: string }>,
) {
  const recruiterEmail = process.env.DEMO_RECRUITER_EMAIL;
  const candidateEmail = process.env.DEMO_CANDIDATE_EMAIL;

  if (recruiterEmail) {
    const recruiter = await findProfileByEmail(recruiterEmail);
    if (recruiter) {
      await ensureMembership(organizationId, recruiter.id, "owner");
      console.log(`  linked recruiter ${recruiterEmail} as owner`);
    } else {
      console.warn(
        `  ! recruiter ${recruiterEmail} not found — sign in once (creates the profile) then re-run`,
      );
    }
  }

  if (candidateEmail) {
    const candidate = await findProfileByEmail(candidateEmail);
    if (candidate) {
      await ensureMembership(organizationId, candidate.id, "member");
      const recruiter = recruiterEmail ? await findProfileByEmail(recruiterEmail) : undefined;
      const assignedBy = recruiter?.id ?? candidate.id;

      for (const published of publishedAssessments) {
        const existingAssignment = await db
          .select()
          .from(candidateAssignments)
          .where(
            and(
              eq(candidateAssignments.organizationId, organizationId),
              eq(candidateAssignments.candidateId, candidate.id),
              eq(candidateAssignments.assessmentId, published.assessmentId),
            ),
          )
          .limit(1);

        if (!existingAssignment[0]) {
          await db.insert(candidateAssignments).values({
            organizationId,
            assessmentId: published.assessmentId,
            assessmentVersionId: published.versionId,
            candidateId: candidate.id,
            assignedBy,
            status: "invited",
          });
          console.log(`  created assignment for ${candidateEmail} → ${published.assessmentId}`);
        }
      }
    } else {
      console.warn(
        `  ! candidate ${candidateEmail} not found — sign in once (creates the profile) then re-run`,
      );
    }
  }
}

async function main() {
  console.log("Seeding demo data…");

  const org = await seedOrganization();
  console.log(`  organization: ${org.name} (${org.slug})`);

  const publishedAssessments: Array<{ assessmentId: string; versionId: string }> = [];

  for (const seed of ASSESSMENTS) {
    const assessment = await seedAssessment(org.id, seed);
    console.log(`  assessment: ${assessment.title} [${assessment.status}]`);

    if (assessment.status === "published") {
      const versions = await db
        .select()
        .from(assessmentVersions)
        .where(eq(assessmentVersions.assessmentId, assessment.id))
        .limit(1);
      if (versions[0]) {
        publishedAssessments.push({
          assessmentId: assessment.id,
          versionId: versions[0].id,
        });
      }
    }
  }

  for (const task of PRACTICE_TASKS) {
    const created = await seedPracticeTask(task);
    console.log(`  practice task: ${created.title}`);
  }

  await seedChallengeTemplates();

  if (publishedAssessments.length > 0) {
    await linkDemoUsers(org.id, publishedAssessments);
  }

  const [assessmentCount, versionCount, rubricCount, fileCount, practiceCount] = await Promise.all([
    db.select().from(assessments),
    db.select().from(assessmentVersions),
    db.select().from(rubricVersions),
    db.select().from(assessmentFiles),
    db.select().from(practiceTasks),
  ]);

  console.log(
    `  totals: ${assessmentCount.length} assessments, ${versionCount.length} versions, ` +
      `${rubricCount.length} rubrics, ${fileCount.length} files, ${practiceCount.length} practice tasks`,
  );

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
