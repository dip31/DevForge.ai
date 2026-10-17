import { FastifyInstance, FastifyReply } from "fastify";
import { authorizeSessionAccess, type SessionAccessFailure } from "../services/sessionAccess";
import { startAnalysisRequestSchema } from "@contracts/analysis";
import {
  analyzeCodebase,
  getAnalysisById,
  getLatestAnalysisForSession,
  getAllAnalysesForSession,
} from "../services/codebaseAnalysisService";

function fail(reply: FastifyReply, access: SessionAccessFailure) {
  return reply
    .status(access.status)
    .send({ success: false, error: { code: access.code, message: access.message } });
}

export async function analysisRoutes(fastify: FastifyInstance) {
  // POST /sessions/:sessionId/analyze - Start a new analysis run
  fastify.post("/sessions/:sessionId/analyze", async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };
    const body = startAnalysisRequestSchema.parse(request.body ?? {});

    // Authorize access
    const access = await authorizeSessionAccess(sessionId, user.id, "read");
    if (!access.ok) return fail(reply, access);

    try {
      const result = await analyzeCodebase({
        sessionId,
        revisionId: body.revisionId,
        includeAIReview: body.includeAIReview,
      });

      return reply.status(201).send({ success: true, data: result });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: {
          code: "ANALYSIS_FAILED",
          message: error instanceof Error ? error.message : "Analysis failed",
        },
      });
    }
  });

  // GET /sessions/:sessionId/analyses - Get all analyses for a session
  fastify.get("/sessions/:sessionId/analyses", async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };

    const access = await authorizeSessionAccess(sessionId, user.id, "read");
    if (!access.ok) return fail(reply, access);

    const analyses = await getAllAnalysesForSession(sessionId);
    return reply.send({ success: true, data: analyses });
  });

  // GET /sessions/:sessionId/analysis/latest - Get latest analysis for a session
  fastify.get("/sessions/:sessionId/analysis/latest", async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };

    const access = await authorizeSessionAccess(sessionId, user.id, "read");
    if (!access.ok) return fail(reply, access);

    const analysis = await getLatestAnalysisForSession(sessionId);
    if (!analysis) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "No analysis found for this session" },
      });
    }

    return reply.send({ success: true, data: analysis });
  });

  // GET /analysis/:analysisId - Get specific analysis by ID
  fastify.get("/analysis/:analysisId", async (request, reply) => {
    const user = (request as any).user;
    const { analysisId } = request.params as { analysisId: string };

    const analysis = await getAnalysisById(analysisId);
    if (!analysis) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Analysis not found" },
      });
    }

    // Authorize via session access
    const access = await authorizeSessionAccess(analysis.sessionId, user.id, "read");
    if (!access.ok) return fail(reply, access);

    return reply.send({ success: true, data: analysis });
  });
}
