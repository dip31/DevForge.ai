import type { AiCoachContext } from "@contracts/ai";
import { db } from "./database";
import type { SessionAccessSuccess } from "./sessionAccess";

// Builds the context the AI Coach is allowed to see. For persisted assessment
// sessions this is loaded from the database so it cannot be spoofed by the
// client; the client-provided context is only used as a fallback when there is
// no server-side workspace (for example the offline demo session), and is
// labelled as unverified wherever it reaches the model.

export type CoachContextSource = "server" | "client" | "none";

export type ResolvedCoachContext = {
  context: AiCoachContext;
  filesSource: CoachContextSource;
  /** Client-supplied diagnostics. Never treated as a verified test run. */
  reportedDiagnostics: NonNullable<AiCoachContext["testResults"]>;
  aiPolicy: string | null;
  /** Non-null when the assessment policy forbids AI assistance. */
  policyBlocked: { message: string } | null;
};

// Phrases that explicitly disable AI assistance for an assessment. The stored
// policy is free text, so this is intentionally narrow: it only matches clear
// prohibitions and does not trip on softer limits such as "no full solutions".
const AI_DISABLED_PATTERNS: RegExp[] = [
  /\b(?:no|without)\s+(?:ai|a\.i\.|assistant|coach|llm)\b/i,
  /\b(?:no|without)\s+ai\s+(?:assistance|help|support|usage|use)\b/i,
  /\bai[\s-]*(?:is|are|must\s+be|should\s+be|will\s+be)?[\s-]*(?:disabled|disallowed|blocked|prohibited|forbidden|unavailable|off|free)\b/i,
  /\b(?:ai|assistant|coach|llm)\b[^.]{0,40}\b(?:is|are|has|have)\s+(?:disabled|disallowed|blocked|prohibited|forbidden|unavailable|off)\b/i,
  /\bai[\s-]*(?:assistance|help|support|usage|use)?[\s-]+(?:is|are|must\s+be|should\s+be|will\s+be)\s+(?:disabled|disallowed|blocked|prohibited|forbidden|unavailable|off)\b/i,
  /\b(?:disabled|disallowed|prohibited|forbidden)\b[^.]{0,40}\b(?:ai|assistant|coach|llm)\b/i,
  /\b(?:ai|assistant|coach|llm)\b[^.]{0,60}\bnot\s+(?:allowed|permitted|available|enabled)\b/i,
  /\b(?:ai|assistant|coach|llm)\b[^.]{0,40}\b(?:may|must|should)\s+not\s+be\s+used\b/i,
  /\bdo\s+not\s+use\s+(?:the\s+)?(?:ai|coach|assistant|llm)\b/i,
];

export function evaluateAiPolicy(policy: string | null | undefined): {
  allowed: boolean;
  reason?: string;
} {
  const text = (policy ?? "").trim();
  if (!text) return { allowed: true };
  for (const pattern of AI_DISABLED_PATTERNS) {
    if (pattern.test(text)) {
      return {
        allowed: false,
        reason: "AI assistance is disabled for this assessment by its policy.",
      };
    }
  }
  return { allowed: true };
}

function clamp(value: string | null | undefined, max: number): string | undefined {
  if (value == null) return undefined;
  return value.length > max ? value.slice(0, max) : value;
}

function mapVerifiedResults(
  results: Array<{
    id: string;
    testName: string;
    status: string;
    error: string | null;
    output: string | null;
    criterion: string | null;
  }>,
): NonNullable<AiCoachContext["testResults"]> {
  return results.slice(-50).map((result) => ({
    id: result.id,
    name: clamp(result.testName, 200) ?? result.id,
    status:
      result.status === "passed" ? "passed" : result.status === "failed" ? "failed" : "pending",
    diagnostic: clamp(result.error ?? result.output, 2000) ?? "No diagnostic output recorded.",
    criterion: clamp(result.criterion, 200),
  }));
}

/**
 * Resolve the coach context. `access` is the authorized session, or null for a
 * non-persisted demo session (where no server-side workspace exists).
 */
export async function resolveCoachContext(
  access: SessionAccessSuccess | null,
  clientContext: AiCoachContext = {},
): Promise<ResolvedCoachContext> {
  const reportedDiagnostics = clientContext.testResults ?? [];

  if (!access) {
    return {
      context: { ...clientContext },
      filesSource: (clientContext.files?.length ?? 0) > 0 ? "client" : "none",
      reportedDiagnostics,
      aiPolicy: null,
      policyBlocked: null,
    };
  }

  const sessionId = access.session.id;
  const versionId = access.session.assessmentVersionId;

  const [version, files, results] = await Promise.all([
    db.query.assessmentVersions.findFirst({
      where: (v, { eq }) => eq(v.id, versionId),
    }),
    db.query.sessionFiles.findMany({
      where: (f, { eq, and }) => and(eq(f.sessionId, sessionId), eq(f.isDeleted, false)),
    }),
    db.query.testResults.findMany({
      where: (t, { eq, and }) => and(eq(t.sessionId, sessionId), eq(t.isHidden, false)),
    }),
  ]);

  const serverFiles = (files ?? []).map((file) => ({
    path: file.path,
    content: file.content,
  }));
  const hasServerFiles = serverFiles.length > 0;
  const effectiveFiles = hasServerFiles ? serverFiles : (clientContext.files ?? []);

  const currentFileCandidate = clientContext.currentFile ?? access.session.currentFile ?? undefined;
  const currentFile =
    currentFileCandidate && effectiveFiles.some((file) => file.path === currentFileCandidate)
      ? currentFileCandidate
      : effectiveFiles[0]?.path;

  const verified = mapVerifiedResults((results ?? []).filter((result) => !result.isHidden));
  const aiPolicy = version?.aiPolicy ?? null;
  const evaluation = evaluateAiPolicy(aiPolicy);

  return {
    context: {
      currentFile,
      files: effectiveFiles.slice(0, 100),
      instructions: version?.instructions ?? clientContext.instructions ?? null,
      requirements: clientContext.requirements,
      testResults: verified.length > 0 ? verified : undefined,
    },
    filesSource: hasServerFiles ? "server" : effectiveFiles.length > 0 ? "client" : "none",
    reportedDiagnostics,
    aiPolicy,
    policyBlocked: evaluation.allowed ? null : { message: evaluation.reason! },
  };
}
