import { FastifyInstance, FastifyReply } from "fastify";
import {
  authorizeSessionAccess,
  type SessionAccessFailure,
  type SessionAccessSuccess,
} from "../services/sessionAccess";
import {
  createPreviewRequestSchema,
  executeCodeRequestSchema,
  generateTestsRequestSchema,
  type ExecutionFile,
  type ExecutionResult,
  type TestCaseResult,
} from "@contracts/execution";
import { CoachProviderError, isGroqConfigured } from "../services/groqProvider";
import { ExecutionError, runWorkspaceCode } from "../services/executorService";
import { generateAndRunTests, TestGenerationError } from "../services/testGenerationService";
import { listSessionFiles } from "../services/workspaceService";
import { resolveCoachContext } from "../services/coachContext";
import { createPreviewSession, PreviewError } from "../services/previewService";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(reply: FastifyReply, access: SessionAccessFailure) {
  return reply
    .status(access.status)
    .send({ success: false, error: { code: access.code, message: access.message } });
}

function errorReply(
  reply: FastifyReply,
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
) {
  return reply.status(status).send({ success: false, error: { code, message, details } });
}

/**
 * Resolve the workspace files to execute. The editor's live content is the
 * source of truth for "run my code", so client-supplied files win; when the
 * client sends none we fall back to the persisted server workspace.
 */
async function resolveExecutionFiles(
  sessionId: string,
  isPersisted: boolean,
  clientFiles: ExecutionFile[],
): Promise<ExecutionFile[]> {
  if (clientFiles.length > 0) return clientFiles;
  if (isPersisted) {
    const files = await listSessionFiles(sessionId);
    return files.map((f) => ({ path: f.path, content: f.content }));
  }
  return [];
}

export async function executionRoutes(fastify: FastifyInstance) {
  // POST /:sessionId/execute — materialize the workspace and run one file for
  // real in the sandbox, capturing genuine stdout/stderr/exit code.
  fastify.post("/:sessionId/execute", async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };
    const body = executeCodeRequestSchema.parse(request.body ?? {});
    const isPersisted = UUID_PATTERN.test(sessionId);

    if (isPersisted) {
      const result = await authorizeSessionAccess(sessionId, user.id, "read");
      if (!result.ok) return fail(reply, result);
    }

    const files = await resolveExecutionFiles(sessionId, isPersisted, body.files);
    if (files.length === 0) {
      return errorReply(reply, 400, "EMPTY_WORKSPACE", "There are no files to execute.");
    }

    let result: ExecutionResult;
    try {
      result = await runWorkspaceCode({
        files,
        entry: body.entry,
        language: body.language,
        stdin: body.stdin,
        timeoutMs: body.timeoutMs,
      });
    } catch (error) {
      if (error instanceof ExecutionError) {
        return errorReply(reply, 400, error.code, error.message);
      }
      request.log.error(error);
      return errorReply(reply, 500, "EXECUTION_FAILED", "The execution service failed.");
    }

    return reply.send({ success: true, data: result });
  });

  // POST /:sessionId/ai-tests — the model writes a test harness for the real
  // code; the server executes it and returns the parsed per-case results.
  fastify.post("/:sessionId/ai-tests", async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };
    const body = generateTestsRequestSchema.parse(request.body ?? {});
    const isPersisted = UUID_PATTERN.test(sessionId);

    let access: SessionAccessSuccess | null = null;
    let instructions = body.instructions ?? null;
    let requirements = body.requirements ?? [];

    if (isPersisted) {
      const result = await authorizeSessionAccess(sessionId, user.id, "read");
      if (!result.ok) return fail(reply, result);
      access = result;

      const resolved = await resolveCoachContext(access, {});
      if (resolved.policyBlocked) {
        return errorReply(reply, 403, "AI_POLICY_BLOCKED", resolved.policyBlocked.message);
      }
      instructions = resolved.context.instructions ?? instructions;
      requirements = resolved.context.requirements ?? requirements;
    }

    if (!isGroqConfigured()) {
      return errorReply(
        reply,
        503,
        "AI_PROVIDER_UNAVAILABLE",
        "AI test generation is not configured on this server.",
      );
    }

    const files = await resolveExecutionFiles(sessionId, isPersisted, body.files);
    if (files.length === 0) {
      return errorReply(reply, 400, "EMPTY_WORKSPACE", "There are no files to test.");
    }

    let generated;
    try {
      generated = await generateAndRunTests({
        files,
        target: body.entry,
        instructions,
        requirements,
        timeoutMs: body.timeoutMs,
      });
    } catch (error) {
      if (error instanceof CoachProviderError) {
        return errorReply(reply, error.statusCode, error.code.toUpperCase(), error.message, {
          retryAfterSeconds: error.retryAfterSeconds ?? null,
          quotaType: error.quotaType ?? null,
        });
      }
      if (error instanceof TestGenerationError) {
        return errorReply(reply, 400, error.code, error.message);
      }
      if (error instanceof ExecutionError) {
        return errorReply(reply, 400, error.code, error.message);
      }
      request.log.error(error);
      return errorReply(reply, 502, "TEST_GENERATION_FAILED", "The test generation request failed.");
    }

    const cases: TestCaseResult[] = generated.cases;

    return reply.send({
      success: true,
      data: {
        testFiles: generated.testFiles,
        cases,
        summary: generated.summary,
        language: generated.language,
        entry: generated.entry,
        provider: "groq",
        model: generated.model,
        run: generated.run,
      },
    });
  });

  // POST /:sessionId/preview — stash the current workspace under a short-lived
  // token so the browser can render the real HTML/CSS/JS project over HTTP
  // (ES modules, relative imports and assets all resolve like a real browser).
  fastify.post("/:sessionId/preview", async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };
    const body = createPreviewRequestSchema.parse(request.body ?? {});
    const isPersisted = UUID_PATTERN.test(sessionId);

    if (isPersisted) {
      const result = await authorizeSessionAccess(sessionId, user.id, "read");
      if (!result.ok) return fail(reply, result);
    }

    const files = await resolveExecutionFiles(sessionId, isPersisted, body.files);

    let created: { token: string; entry: string };
    try {
      created = createPreviewSession({ sessionId, files, entry: body.entry });
    } catch (error) {
      if (error instanceof PreviewError) {
        return errorReply(reply, 400, error.code, error.message);
      }
      request.log.error(error);
      return errorReply(reply, 500, "PREVIEW_FAILED", "Could not create the preview.");
    }

    return reply.send({ success: true, data: created });
  });
}
