import { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  request.log.error(error);

  // Zod validation errors
  if (error instanceof ZodError) {
    return reply.status(400).send({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
        details: error.flatten().fieldErrors,
      },
    });
  }

  // Fastify validation errors
  if (error.validation) {
    return reply.status(400).send({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
        details: error.validation,
      },
    });
  }

  // JWT errors
  if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
    return reply.status(401).send({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      },
    });
  }

  // Custom application errors
  if (error.statusCode) {
    return reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code || "ERROR",
        message: error.message,
      },
    });
  }

  // Unknown errors
  return reply.status(500).send({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    },
  });
}
