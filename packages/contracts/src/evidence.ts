import { z } from "zod";
import {
  uuidSchema,
  paginationSchema,
  paginatedResponseSchema,
  isoDateSchema,
  positiveIntSchema,
} from "./common";

export const evidenceTypeSchema = z.enum([
  "submitted_snapshot",
  "earlier_snapshot",
  "test_result",
  "application_run",
  "ai_coach_prompt",
  "ai_coach_response",
  "file_event",
  "assessment_event",
  "terminal_command",
]);

export const evidenceIntegritySchema = z.enum(["available", "partial", "unavailable", "mismatch"]);

export const evidenceProvenanceSchema = z.enum(["candidate_action", "system_generated", "unknown"]);

export const evidenceRecordSchema = z.object({
  id: uuidSchema,
  candidateId: uuidSchema,
  organizationId: uuidSchema,
  assignmentId: uuidSchema,
  assessmentId: uuidSchema,
  sessionId: uuidSchema,
  type: evidenceTypeSchema,
  timestamp: isoDateSchema,
  title: z.string().min(1).max(255),
  summary: z.string().min(1).max(2000),
  file: z.string().max(500).nullable().optional(),
  revisionId: uuidSchema.nullable().optional(),
  sourceEventId: z.string().max(255).nullable().optional(),
  resultId: z.string().max(255).nullable().optional(),
  contentRef: z.string().min(1).max(255),
  provenance: z.enum(["candidate_action", "system_generated", "unknown"]),
  integrity: z.enum(["available", "partial", "unavailable", "mismatch"]).default("available"),
  testStatus: z.enum(["passed", "failed", "pending"]).nullable().optional(),
  metadata: z.record(z.unknown()).default({}),
  createdAt: isoDateSchema,
});

export const activityEventSchema = z.object({
  id: uuidSchema,
  sessionId: uuidSchema,
  type: z.string().min(1).max(50),
  timestamp: isoDateSchema,
  file: z.string().max(500).nullable().optional(),
  revisionId: uuidSchema.nullable().optional(),
  resultId: uuidSchema.nullable().optional(),
  terminalId: z.string().max(255).nullable().optional(),
  detail: z.string().min(1).max(2000),
  provenance: z.enum(["candidate_action", "system_generated", "unknown"]),
  metadata: z.record(z.unknown()).default({}),
  createdAt: isoDateSchema,
});

export const codeRevisionLinkSchema = z.object({
  id: uuidSchema,
  sessionId: uuidSchema,
  revisionId: uuidSchema,
  evidenceId: uuidSchema,
  linkType: z.string().min(1).max(50),
  createdAt: isoDateSchema,
});

export type EvidenceRecord = z.infer<typeof evidenceRecordSchema>;
export type ActivityEvent = z.infer<typeof activityEventSchema>;
export type CodeRevisionLink = z.infer<typeof codeRevisionLinkSchema>;
