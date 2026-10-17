import { db } from "./database";
import { assessments, assessmentVersions } from "@database/schema";

export type AccessLevel = "read" | "write";

export type AccessSuccess = {
  ok: true;
  version: typeof assessmentVersions.$inferSelect;
  assessment: typeof assessments.$inferSelect;
};

export type AccessFailure = {
  ok: false;
  status: 403 | 404;
  code: string;
  message: string;
};

export type AccessResult = AccessSuccess | AccessFailure;

export async function authorizeVersionAccess(
  versionId: string,
  userId: string,
  level: AccessLevel,
): Promise<AccessResult> {
  const version = await db.query.assessmentVersions.findFirst({
    where: (v, { eq }) => eq(v.id, versionId),
  });
  if (!version) {
    return {
      ok: false,
      status: 404,
      code: "NOT_FOUND",
      message: "Assessment version not found",
    };
  }

  const assessment = await db.query.assessments.findFirst({
    where: (a, { eq }) => eq(a.id, version.assessmentId),
  });
  if (!assessment) {
    return {
      ok: false,
      status: 404,
      code: "NOT_FOUND",
      message: "Assessment not found",
    };
  }

  const membership = await db.query.organizationMemberships.findFirst({
    where: (m, { eq, and }) =>
      and(eq(m.organizationId, assessment.organizationId), eq(m.userId, userId)),
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
  } else if (!membership && !assessment.isPublic) {
    return {
      ok: false,
      status: 403,
      code: "FORBIDDEN",
      message: "Access denied",
    };
  }

  return { ok: true, version, assessment };
}
