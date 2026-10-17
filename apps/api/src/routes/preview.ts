import { FastifyInstance } from "fastify";
import { getConfig } from "@config";
import {
  getPreviewSession,
  normalizePreviewPath,
  previewContentType,
  rewriteAbsoluteReferences,
} from "../services/previewService";

// Serves a stashed preview workspace over HTTP. Registered WITHOUT auth: access
// is gated by the unguessable, short-lived token embedded in the path, and the
// files are the candidate's own. The iframe that consumes this is sandboxed, so
// browsing here directly exposes nothing more than the candidate already has.
export async function previewRoutes(fastify: FastifyInstance) {
  const config = getConfig();

  // The global helmet CSP is meant for the JSON API. A preview document is
  // untrusted candidate content that must be: (1) framable by the candidate app
  // and (2) able to run the project's own inline scripts. The iframe `sandbox`
  // attribute is the real security boundary, so we relax CSP for this scope only.
  const previewCsp = [
    "default-src 'self' data: blob: https:",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:",
    "style-src 'self' 'unsafe-inline' https:",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "connect-src 'self' data: blob: https:",
    "media-src 'self' data: blob: https:",
    "object-src 'none'",
    "base-uri 'self'",
    `frame-ancestors 'self' ${config.CORS_ORIGIN}`,
  ].join("; ");

  fastify.addHook("onSend", async (_request, reply, payload) => {
    reply.header("Content-Security-Policy", previewCsp);
    reply.removeHeader("cross-origin-opener-policy");
    return payload;
  });

  fastify.get("/:token", async (request, reply) => {
    const { token } = request.params as { token: string };
    const session = getPreviewSession(token);
    if (!session) {
      return reply
        .status(404)
        .type("text/plain; charset=utf-8")
        .send("This preview link has expired. Reopen the preview to continue.");
    }
    return reply.redirect(`/api/v1/preview/${token}/${session.entry}`, 302);
  });

  fastify.get("/:token/*", async (request, reply) => {
    const { token } = request.params as { token: string };
    const wildcard = (request.params as Record<string, string>)["*"] ?? "";
    const session = getPreviewSession(token);
    if (!session) {
      return reply
        .status(404)
        .type("text/plain; charset=utf-8")
        .send("This preview link has expired. Reopen the preview to continue.");
    }

    const normalized = normalizePreviewPath(wildcard) ?? session.entry;
    const content = session.files.get(normalized);
    if (content === undefined) {
      return reply
        .status(404)
        .type("text/plain; charset=utf-8")
        .send(`Not found: ${normalized}`);
    }

    reply.header("Content-Type", previewContentType(normalized));
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Cache-Control", "no-store");
    reply.header("Cross-Origin-Resource-Policy", "cross-origin");

    if (/\.html?$/i.test(normalized)) {
      return reply.send(rewriteAbsoluteReferences(content, normalized, session.files));
    }
    return reply.send(content);
  });
}
