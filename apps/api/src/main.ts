import Fastify from "fastify";
import { getConfig } from "@config";
import { authRoutes } from "./routes/auth";
import { organizationRoutes } from "./routes/organizations";
import { membershipRoutes } from "./routes/memberships";
import { sessionRoutes } from "./routes/sessions";
import { healthRoutes } from "./routes/health";
import { profileRoutes } from "./routes/profile";
import { assessmentRoutes } from "./routes/assessments";
import { assignmentRoutes } from "./routes/assignments";
import { versionResourceRoutes } from "./routes/versionResources";
import { rubricRoutes } from "./routes/rubrics";
import { assessmentFileRoutes } from "./routes/assessmentFiles";
import { workspaceRoutes } from "./routes/workspace";
import { sessionEvidenceRoutes, evidenceRoutes } from "./routes/evidence";
import { evaluationRoutes } from "./routes/evaluations";
import { reviewQueueRoutes } from "./routes/reviewQueue";
import { practiceRoutes } from "./routes/practice";
import { aiCoachRoutes } from "./routes/aiCoach";
import { submissionRoutes } from "./routes/submissions";
import { proofLoopRoutes } from "./routes/proofLoop";
import { errorHandler } from "./middleware/errorHandler";
import { authMiddleware } from "./middleware/auth";

const config = getConfig();

export async function buildApp() {
  const app = Fastify({
    logger: config.LOG_PRETTY
      ? {
          transport: {
            target: "pino-pretty",
            options: { colorize: true },
          },
        }
      : { level: config.LOG_LEVEL },
  });

  // Register plugins
  await app.register(import("@fastify/helmet"));
  await app.register(import("@fastify/cors"), {
    origin: config.CORS_ORIGIN,
    credentials: config.CORS_CREDENTIALS,
  });
  await app.register(import("@fastify/sensible"));
  await app.register(import("@fastify/rate-limit"), {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
  });

  // Global error handler
  app.setErrorHandler(errorHandler);

  // Health routes (no auth required)
  await app.register(healthRoutes, { prefix: "/api/v1" });

  // Auth routes (no auth required for login/register)
  await app.register(authRoutes, { prefix: "/api/v1/auth" });

  // Profile routes (bootstrap POST uses token-only auth; GET/PATCH are protected)
  await app.register(profileRoutes, { prefix: "/api/v1/auth" });

  // Protected routes (require authentication)
  await app.register(async function (fastify) {
    fastify.addHook("preHandler", authMiddleware);
    await fastify.register(organizationRoutes, {
      prefix: "/api/v1/organizations",
    });
    await fastify.register(membershipRoutes, {
      prefix: "/api/v1/organizations",
    });
    await fastify.register(sessionRoutes, { prefix: "/api/v1/auth/sessions" });
    await fastify.register(assessmentRoutes, { prefix: "/api/v1/assessments" });
    await fastify.register(versionResourceRoutes, {
      prefix: "/api/v1/assessments/versions",
    });
    await fastify.register(rubricRoutes, { prefix: "/api/v1/rubrics" });
    await fastify.register(assessmentFileRoutes, {
      prefix: "/api/v1/assessment-files",
    });
    await fastify.register(assignmentRoutes, { prefix: "/api/v1/assignments" });
    await fastify.register(workspaceRoutes, { prefix: "/api/v1/sessions" });
    await fastify.register(sessionEvidenceRoutes, { prefix: "/api/v1/sessions" });
    await fastify.register(evidenceRoutes, { prefix: "/api/v1/evidence" });
    await fastify.register(evaluationRoutes, { prefix: "/api/v1/evaluations" });
    await fastify.register(reviewQueueRoutes, { prefix: "/api/v1/review-queue" });
    await fastify.register(practiceRoutes, { prefix: "/api/v1/practice" });
    await fastify.register(aiCoachRoutes, { prefix: "/api/v1/sessions" });
    await fastify.register(submissionRoutes, { prefix: "/api/v1/sessions" });
    await fastify.register(proofLoopRoutes, { prefix: "/api/v1/proofloop" });
  });

  return app;
}

async function start() {
  const app = await buildApp();
  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    console.log(`Server running at http://${config.HOST}:${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
