import { db } from "./database";
import { assessmentSessions, candidateAssignments } from "@database/schema";

export type SessionAccessLevel = "read" | "write";

export type SessionAccessSuccess = {
  ok: true;
  session: typeof assessmentSessions.$inferSelect;
  assignment: typeof candidateAssignments.$inferSelect;
  isOwner: boolean;
};

export type SessionAccessFailure = {
  ok: false;
  status: 403 | 404;
  code: string;
  message: string;
};

export type SessionAccessResult = SessionAccessSuccess | SessionAccessFailure;

export async function authorizeSessionAccess(
  sessionId: string,
  userId: string,
  level: SessionAccessLevel,
): Promise<SessionAccessResult> {
  const session = await db.query.assessmentSessions.findFirst({
    where: (s, { eq }) => eq(s.id, sessionId),
  });
  if (!session) {
    return { ok: false, status: 404, code: "NOT_FOUND", message: "Session not found" };
  }

  const assignment = await db.query.candidateAssignments.findFirst({
    where: (a, { eq }) => eq(a.id, session.assignmentId),
  });
  if (!assignment) {
    return { ok: false, status: 404, code: "NOT_FOUND", message: "Assignment not found" };
  }

  if (assignment.candidateId === userId) {
    if (level === "write" && (session.status === "submitted" || session.status === "expired")) {
      return {
        ok: false,
        status: 403,
        code: "SESSION_LOCKED",
        message: `Session is ${session.status} and cannot be modified`,
      };
    }
    return { ok: true, session, assignment, isOwner: true };
  }

  const membership = await db.query.organizationMemberships.findFirst({
    where: (m, { eq, and }) =>
      and(eq(m.organizationId, assignment.organizationId), eq(m.userId, userId)),
  });

  if (level === "write") {
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return {
        ok: false,
        status: 403,
        code: "FORBIDDEN",
        message: "Insufficient permissions",
      };
    }
  } else if (!membership) {
    return { ok: false, status: 403, code: "FORBIDDEN", message: "Access denied" };
  }

  return { ok: true, session, assignment, isOwner: false };
}
