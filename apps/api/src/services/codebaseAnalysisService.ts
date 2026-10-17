import { randomUUID } from "node:crypto";
import { db } from "./database";
import { workspaceRevisions, testResults, executionRuns, assessmentSessions, analysisRuns } from "@database/schema";
import { eq, and } from "drizzle-orm";
import type {
  AnalysisResult,
  AnalysisFinding,
  FindingCategory,
  FindingSeverity,
  VerificationStatus,
} from "@contracts/analysis";
import { callGroq } from "./groqProvider";

const ANALYSIS_VERSION = "1.0.0";

type AnalysisOptions = {
  sessionId: string;
  revisionId?: string;
  includeAIReview?: boolean;
};

type DeterministicCheckResult = {
  findings: AnalysisFinding[];
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  limitations: string[];
};

type RequirementCheckResult = {
  findings: AnalysisFinding[];
  covered: number;
  total: number;
  limitations: string[];
};

type AIReviewResult = {
  findings: AnalysisFinding[];
  qualityScore: number | null;
  limitations: string[];
  provider: string | null;
  model: string | null;
};

/**
 * Analyze a submitted coding assessment using deterministic checks and optional AI review.
 * 
 * This service:
 * 1. Loads the actual submission revision and files
 * 2. Runs deterministic checks (test results, file presence)
 * 3. Maps requirements to implementation
 * 4. Optionally runs AI-assisted code review
 * 5. Returns structured findings with evidence links
 */
export async function analyzeCodebase(options: AnalysisOptions): Promise<AnalysisResult> {
  const { sessionId, revisionId: providedRevisionId, includeAIReview = true } = options;

  const startedAt = new Date();
  const analysisId = randomUUID();

  // 1. Load session and determine revision
  const session = await db.query.assessmentSessions.findFirst({
    where: eq(assessmentSessions.id, sessionId),
  });

  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  // 2. Determine which revision to analyze (provided or latest)
  let revisionId = providedRevisionId;
  if (!revisionId) {
    const revisions = await db.query.workspaceRevisions.findMany({
      where: eq(workspaceRevisions.sessionId, sessionId),
      orderBy: (r, { desc }) => [desc(r.createdAt)],
      limit: 1,
    });
    if (revisions.length === 0) {
      throw new Error(`No revisions found for session ${sessionId}`);
    }
    revisionId = revisions[0].id;
  }

  const revision = await db.query.workspaceRevisions.findFirst({
    where: eq(workspaceRevisions.id, revisionId),
  });

  if (!revision) {
    throw new Error(`Revision ${revisionId} not found`);
  }

  const files = Array.isArray(revision.files) ? revision.files : [];
  const filesAnalyzed = files.length;

  // 3. Run deterministic checks
  const deterministicResult = await runDeterministicChecks(sessionId, revisionId);

  // 4. Check requirement coverage
  const requirementResult = await checkRequirements(sessionId, files);

  // 5. Optionally run AI code review
  let aiReviewResult: AIReviewResult = {
    findings: [],
    qualityScore: null,
    limitations: [],
    provider: null,
    model: null,
  };

  if (includeAIReview) {
    try {
      aiReviewResult = await runAICodeReview(sessionId, revisionId, files);
    } catch (error) {
      aiReviewResult.limitations.push(
        `AI code review unavailable: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  } else {
    aiReviewResult.limitations.push("AI code review was not requested");
  }

  // 6. Combine all findings
  const allFindings = [
    ...deterministicResult.findings,
    ...requirementResult.findings,
    ...aiReviewResult.findings,
  ];

  // 7. Build and persist result
  const result: AnalysisResult = {
    id: analysisId,
    sessionId,
    assignmentId: session.assignmentId,
    assessmentId: session.assessmentVersionId, // Using version ID as assessment reference
    revisionId,
    status: "completed",
    filesAnalyzed,
    testsRun: deterministicResult.testsRun,
    testsPassed: deterministicResult.testsPassed,
    testsFailed: deterministicResult.testsFailed,
    requirementsCovered: requirementResult.covered,
    requirementsTotal: requirementResult.total,
    codeQualityScore: aiReviewResult.qualityScore,
    findings: allFindings,
    limitations: [
      ...deterministicResult.limitations,
      ...requirementResult.limitations,
      ...aiReviewResult.limitations,
    ],
    provider: aiReviewResult.provider,
    providerModel: aiReviewResult.model,
    analysisVersion: ANALYSIS_VERSION,
    createdAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    metadata: {
      filesCount: filesAnalyzed,
      deterministicChecks: deterministicResult.findings.length,
      requirementChecks: requirementResult.findings.length,
      aiFindings: aiReviewResult.findings.length,
    },
  };

  // Persist to database
  await db.insert(analysisRuns).values({
    id: analysisId,
    sessionId,
    assignmentId: session.assignmentId,
    assessmentId: session.assessmentVersionId,
    revisionId,
    status: "completed",
    filesAnalyzed,
    testsRun: deterministicResult.testsRun,
    testsPassed: deterministicResult.testsPassed,
    testsFailed: deterministicResult.testsFailed,
    requirementsCovered: requirementResult.covered,
    requirementsTotal: requirementResult.total,
    codeQualityScore: aiReviewResult.qualityScore,
    findings: allFindings,
    limitations: result.limitations,
    provider: aiReviewResult.provider,
    providerModel: aiReviewResult.model,
    analysisVersion: ANALYSIS_VERSION,
    metadata: result.metadata,
    completedAt: new Date(),
  });

  return result;
}

/**
 * Run deterministic checks: test results, build status, type checks
 */
async function runDeterministicChecks(
  sessionId: string,
  revisionId: string,
): Promise<DeterministicCheckResult> {
  const findings: AnalysisFinding[] = [];
  const limitations: string[] = [];

  // Load test results for this revision
  const tests = await db.query.testResults.findMany({
    where: and(
      eq(testResults.sessionId, sessionId),
      eq(testResults.revisionId, revisionId),
    ),
  });

  const testsRun = tests.length;
  const testsPassed = tests.filter((t) => t.status === "passed").length;
  const testsFailed = tests.filter((t) => t.status === "failed").length;

  // Create findings for failed tests
  for (const test of tests) {
    if (test.status === "failed") {
      findings.push({
        id: `test-failure-${test.id}`,
        category: "test",
        severity: "error",
        title: `Test failed: ${test.testName}`,
        message: test.error || `Test "${test.testName}" failed`,
        file: null,
        line: null,
        evidenceIds: [], // Would link to test result evidence
        verificationStatus: "verified",
        metadata: {
          testId: test.id,
          testSuite: test.testSuite,
          durationMs: test.durationMs,
          criterion: test.criterion,
        },
      });
    }
  }

  // Load execution runs (build/lint/type-check results)
  const executions = await db.query.executionRuns.findMany({
    where: and(
      eq(executionRuns.sessionId, sessionId),
      eq(executionRuns.revisionId, revisionId),
    ),
  });

  for (const exec of executions) {
    if (exec.status === "failed") {
      const category: FindingCategory =
        exec.type === "build" ? "build" : exec.type === "lint" ? "code_quality" : "test";

      findings.push({
        id: `exec-failure-${exec.id}`,
        category,
        severity: "error",
        title: `${exec.type} failed`,
        message: exec.error || `Execution of type "${exec.type}" failed`,
        file: null,
        line: null,
        evidenceIds: [],
        verificationStatus: "verified",
        metadata: {
          executionId: exec.id,
          type: exec.type,
          exitCode: exec.exitCode,
          durationMs: exec.durationMs,
        },
      });
    }
  }

  if (testsRun === 0) {
    limitations.push("No test results found for this revision");
  }

  if (executions.length === 0) {
    limitations.push("No build or type-check results available");
  }

  return {
    findings,
    testsRun,
    testsPassed,
    testsFailed,
    limitations,
  };
}

/**
 * Check requirement coverage by analyzing files against task instructions
 */
async function checkRequirements(
  sessionId: string,
  files: any[],
): Promise<RequirementCheckResult> {
  const findings: AnalysisFinding[] = [];
  const limitations: string[] = [];

  // Load session to get assessment version
  const session = await db.query.assessmentSessions.findFirst({
    where: eq(assessmentSessions.id, sessionId),
    with: { assessmentVersion: true },
  });

  if (!session?.assessmentVersion) {
    limitations.push("Assessment version not found, cannot check requirements");
    return { findings, covered: 0, total: 0, limitations };
  }

  const instructions = session.assessmentVersion.instructions || "";
  
  // Extract requirements from instructions (simple heuristic)
  const requirementLines = instructions
    .split("\n")
    .filter((line) => 
      line.trim().startsWith("-") || 
      line.trim().startsWith("*") ||
      line.trim().match(/^\d+\./)
    );

  const total = requirementLines.length;
  let covered = 0;

  // Check if files exist for requirements
  for (let i = 0; i < requirementLines.length; i++) {
    const req = requirementLines[i].trim();
    
    // Simple heuristic: if requirement mentions a file and file exists, mark as covered
    const fileMatches = files.filter((f: any) => {
      const filePath = typeof f === "object" ? f.path : "";
      return req.toLowerCase().includes(filePath.toLowerCase());
    });

    if (fileMatches.length > 0) {
      covered++;
    } else {
      findings.push({
        id: `requirement-${i}`,
        category: "requirement",
        severity: "warning",
        title: "Requirement may be incomplete",
        message: req,
        file: null,
        line: null,
        evidenceIds: [],
        verificationStatus: "unverified",
        metadata: { requirementIndex: i },
      });
    }
  }

  if (total === 0) {
    limitations.push("No structured requirements found in assessment instructions");
  }

  return { findings, covered, total, limitations };
}

/**
 * Run AI-assisted code review using Groq
 */
async function runAICodeReview(
  sessionId: string,
  revisionId: string,
  files: any[],
): Promise<AIReviewResult> {
  const findings: AnalysisFinding[] = [];
  const limitations: string[] = [];

  // Load session context
  const session = await db.query.assessmentSessions.findFirst({
    where: eq(assessmentSessions.id, sessionId),
    with: { assessmentVersion: true },
  });

  if (!session?.assessmentVersion) {
    limitations.push("Assessment context not available for AI review");
    return {
      findings,
      qualityScore: null,
      limitations,
      provider: null,
      model: null,
    };
  }

  // Select relevant files for review (limit to avoid token limits)
  const reviewableFiles = files
    .filter((f: any) => {
      const path = typeof f === "object" ? f.path : "";
      return path.match(/\.(js|ts|jsx|tsx|py|java|go|rs)$/i);
    })
    .slice(0, 5); // Limit to 5 files

  if (reviewableFiles.length === 0) {
    limitations.push("No source code files found for AI review");
    return {
      findings,
      qualityScore: null,
      limitations,
      provider: null,
      model: null,
    };
  }

  // Build prompt for AI review
  const filesContent = reviewableFiles
    .map((f: any) => `File: ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
    .join("\n\n");

  const prompt = `You are a code reviewer analyzing a candidate's submission for a coding assessment.

Assessment: ${session.assessmentVersion.title}
Instructions: ${session.assessmentVersion.instructions || "N/A"}

Code submitted:
${filesContent}

Analyze the code and provide a structured review in JSON format:
{
  "qualityScore": <0-100>,
  "findings": [
    {
      "category": "code_quality|security|performance",
      "severity": "info|warning|error",
      "title": "Brief title",
      "message": "Detailed explanation",
      "file": "path/to/file.ts",
      "line": null
    }
  ]
}

Focus on:
1. Code quality and readability
2. Error handling
3. Edge cases
4. Security issues
5. Performance concerns

Return ONLY valid JSON, no markdown or explanations.`;

  try {
    const response = await callGroq({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const content = response.message.content.trim();
    
    // Parse JSON response
    let reviewData: any;
    try {
      // Try to extract JSON if wrapped in markdown
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      reviewData = JSON.parse(jsonStr);
    } catch {
      reviewData = JSON.parse(content);
    }

    // Validate and convert AI findings
    if (Array.isArray(reviewData.findings)) {
      for (let i = 0; i < reviewData.findings.length; i++) {
        const finding = reviewData.findings[i];
        findings.push({
          id: `ai-review-${i}`,
          category: (finding.category as FindingCategory) || "code_quality",
          severity: (finding.severity as FindingSeverity) || "info",
          title: String(finding.title || "Code review finding"),
          message: String(finding.message || ""),
          file: finding.file || null,
          line: finding.line || null,
          evidenceIds: [],
          verificationStatus: "unverified" as VerificationStatus, // AI findings are interpretations
          metadata: { source: "ai_review", provider: "groq" },
        });
      }
    }

    const qualityScore = typeof reviewData.qualityScore === "number" 
      ? Math.max(0, Math.min(100, reviewData.qualityScore))
      : null;

    return {
      findings,
      qualityScore,
      limitations,
      provider: "groq",
      model: response.model,
    };
  } catch (error) {
    limitations.push(`AI review failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    return {
      findings,
      qualityScore: null,
      limitations,
      provider: null,
      model: null,
    };
  }
}


/**
 * Get analysis result by ID
 */
export async function getAnalysisById(analysisId: string): Promise<AnalysisResult | null> {
  const analysis = await db.query.analysisRuns.findFirst({
    where: eq(analysisRuns.id, analysisId),
  });

  if (!analysis) {
    return null;
  }

  return {
    id: analysis.id,
    sessionId: analysis.sessionId,
    assignmentId: analysis.assignmentId,
    assessmentId: analysis.assessmentId,
    revisionId: analysis.revisionId,
    status: analysis.status as any,
    filesAnalyzed: analysis.filesAnalyzed,
    testsRun: analysis.testsRun,
    testsPassed: analysis.testsPassed,
    testsFailed: analysis.testsFailed,
    requirementsCovered: analysis.requirementsCovered,
    requirementsTotal: analysis.requirementsTotal,
    codeQualityScore: analysis.codeQualityScore,
    findings: Array.isArray(analysis.findings) ? analysis.findings : [],
    limitations: Array.isArray(analysis.limitations) ? analysis.limitations : [],
    provider: analysis.provider,
    providerModel: analysis.providerModel,
    analysisVersion: analysis.analysisVersion,
    createdAt: analysis.createdAt.toISOString(),
    completedAt: analysis.completedAt?.toISOString() || null,
    metadata: typeof analysis.metadata === "object" ? analysis.metadata : {},
  };
}

/**
 * Get latest analysis for a session
 */
export async function getLatestAnalysisForSession(sessionId: string): Promise<AnalysisResult | null> {
  const analyses = await db.query.analysisRuns.findMany({
    where: eq(analysisRuns.sessionId, sessionId),
    orderBy: (a, { desc }) => [desc(a.createdAt)],
    limit: 1,
  });

  if (analyses.length === 0) {
    return null;
  }

  return getAnalysisById(analyses[0].id);
}

/**
 * Get all analyses for a session
 */
export async function getAllAnalysesForSession(sessionId: string): Promise<AnalysisResult[]> {
  const analyses = await db.query.analysisRuns.findMany({
    where: eq(analysisRuns.sessionId, sessionId),
    orderBy: (a, { desc }) => [desc(a.createdAt)],
  });

  return Promise.all(analyses.map((a) => getAnalysisById(a.id))).then((results) =>
    results.filter((r): r is AnalysisResult => r !== null),
  );
}
