/**
 * Drizzle ORM relation definitions.
 * These enable the relational query API (db.query.X.findMany({ with: { Y: true } })).
 * Import this file alongside the schema tables when initialising Drizzle.
 */

import { relations } from "drizzle-orm";

import {
  users,
  organizations,
  organizationMemberships,
  userSessions,
  candidateProfiles,
} from "./auth";

import {
  assessments,
  assessmentVersions,
  rubricVersions,
  assessmentFiles,
  assessmentTestConfigs,
} from "./assessment";

import { candidateAssignments, assessmentSessions, sessionStateEvents } from "./assignments";

import {
  workspaceRevisions,
  sessionFiles,
  executionRuns,
  testResults,
  executionArtifacts,
} from "./workspace";

import { evidenceRecords, activityEvents, codeRevisionLinks } from "./evidence";

import {
  evaluations,
  evaluationCriteria,
  findingEvidenceLinks,
  reviewEvents,
  candidateFeedback,
} from "./evaluation";

import { reviewQueue, reviewerNotes, reviewerDecisions } from "./reports";

import { practiceSessions, practiceTasks, practiceAllowances, usageLedger } from "./practice";

import { aiUsageRecords, aiInteractions, aiProviderConfigs } from "./ai";

import { notificationJobs } from "./notifications";

import { auditEvents } from "./audit";

// â”€â”€ users â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const usersRelations = relations(users, ({ many, one }) => ({
  sessions: many(userSessions),

  memberships: many(organizationMemberships),

  candidateProfile: one(candidateProfiles, {
    fields: [users.id],
    references: [candidateProfiles.userId],
  }),

  assignments: many(candidateAssignments, {
    relationName: "candidateAssignments",
  }),

  assessmentSessions: many(assessmentSessions),
}));

// â”€â”€ organizations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(organizationMemberships),

  assessments: many(assessments),
}));

// â”€â”€ organizationMemberships â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const organizationMembershipsRelations = relations(organizationMemberships, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMemberships.organizationId],
    references: [organizations.id],
  }),

  user: one(users, {
    fields: [organizationMemberships.userId],
    references: [users.id],
  }),
}));

// â”€â”€ userSessions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, { fields: [userSessions.userId], references: [users.id] }),
}));

// â”€â”€ candidateProfiles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const candidateProfilesRelations = relations(candidateProfiles, ({ one }) => ({
  user: one(users, {
    fields: [candidateProfiles.userId],
    references: [users.id],
  }),
}));

// â”€â”€ assessments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const assessmentsRelations = relations(assessments, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [assessments.organizationId],
    references: [organizations.id],
  }),

  versions: many(assessmentVersions),

  assignments: many(candidateAssignments),
}));

export const assessmentVersionsRelations = relations(assessmentVersions, ({ one, many }) => ({
  assessment: one(assessments, {
    fields: [assessmentVersions.assessmentId],
    references: [assessments.id],
  }),

  files: many(assessmentFiles),

  testConfig: one(assessmentTestConfigs, {
    fields: [assessmentVersions.id],
    references: [assessmentTestConfigs.assessmentVersionId],
  }),

  rubricVersions: many(rubricVersions),
}));

export const rubricVersionsRelations = relations(rubricVersions, ({ one }) => ({
  assessmentVersion: one(assessmentVersions, {
    fields: [rubricVersions.assessmentVersionId],
    references: [assessmentVersions.id],
  }),
}));

export const assessmentFilesRelations = relations(assessmentFiles, ({ one }) => ({
  assessmentVersion: one(assessmentVersions, {
    fields: [assessmentFiles.assessmentVersionId],
    references: [assessmentVersions.id],
  }),
}));

export const assessmentTestConfigsRelations = relations(assessmentTestConfigs, ({ one }) => ({
  assessmentVersion: one(assessmentVersions, {
    fields: [assessmentTestConfigs.assessmentVersionId],
    references: [assessmentVersions.id],
  }),
}));

// â”€â”€ candidateAssignments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const candidateAssignmentsRelations = relations(candidateAssignments, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [candidateAssignments.organizationId],
    references: [organizations.id],
  }),

  assessment: one(assessments, {
    fields: [candidateAssignments.assessmentId],
    references: [assessments.id],
  }),

  assessmentVersion: one(assessmentVersions, {
    fields: [candidateAssignments.assessmentVersionId],
    references: [assessmentVersions.id],
  }),

  candidate: one(users, {
    fields: [candidateAssignments.candidateId],
    references: [users.id],
    relationName: "candidateAssignments",
  }),

  assignedByUser: one(users, {
    fields: [candidateAssignments.assignedBy],
    references: [users.id],
  }),

  session: one(assessmentSessions, {
    fields: [candidateAssignments.id],
    references: [assessmentSessions.assignmentId],
  }),
}));

export const assessmentSessionsRelations = relations(assessmentSessions, ({ one, many }) => ({
  assignment: one(candidateAssignments, {
    fields: [assessmentSessions.assignmentId],
    references: [candidateAssignments.id],
  }),

  candidate: one(users, {
    fields: [assessmentSessions.candidateId],
    references: [users.id],
  }),

  assessmentVersion: one(assessmentVersions, {
    fields: [assessmentSessions.assessmentVersionId],
    references: [assessmentVersions.id],
  }),

  stateEvents: many(sessionStateEvents),

  revisions: many(workspaceRevisions),

  files: many(sessionFiles),

  executionRuns: many(executionRuns),

  evidenceRecords: many(evidenceRecords),

  activityEvents: many(activityEvents),
}));

export const sessionStateEventsRelations = relations(sessionStateEvents, ({ one }) => ({
  session: one(assessmentSessions, {
    fields: [sessionStateEvents.sessionId],
    references: [assessmentSessions.id],
  }),
}));

// â”€â”€ workspace â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const workspaceRevisionsRelations = relations(workspaceRevisions, ({ one }) => ({
  session: one(assessmentSessions, {
    fields: [workspaceRevisions.sessionId],
    references: [assessmentSessions.id],
  }),
}));

export const sessionFilesRelations = relations(sessionFiles, ({ one }) => ({
  session: one(assessmentSessions, {
    fields: [sessionFiles.sessionId],
    references: [assessmentSessions.id],
  }),
}));

export const executionRunsRelations = relations(executionRuns, ({ one, many }) => ({
  session: one(assessmentSessions, {
    fields: [executionRuns.sessionId],
    references: [assessmentSessions.id],
  }),

  revision: one(workspaceRevisions, {
    fields: [executionRuns.revisionId],
    references: [workspaceRevisions.id],
  }),

  testResults: many(testResults),

  artifacts: many(executionArtifacts),
}));

export const testResultsRelations = relations(testResults, ({ one }) => ({
  session: one(assessmentSessions, {
    fields: [testResults.sessionId],
    references: [assessmentSessions.id],
  }),

  executionRun: one(executionRuns, {
    fields: [testResults.executionRunId],
    references: [executionRuns.id],
  }),
}));

export const executionArtifactsRelations = relations(executionArtifacts, ({ one }) => ({
  executionRun: one(executionRuns, {
    fields: [executionArtifacts.executionRunId],
    references: [executionRuns.id],
  }),
}));

// â”€â”€ evidence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const evidenceRecordsRelations = relations(evidenceRecords, ({ one, many }) => ({
  session: one(assessmentSessions, {
    fields: [evidenceRecords.sessionId],
    references: [assessmentSessions.id],
  }),

  findingLinks: many(findingEvidenceLinks),
}));

export const activityEventsRelations = relations(activityEvents, ({ one }) => ({
  session: one(assessmentSessions, {
    fields: [activityEvents.sessionId],
    references: [assessmentSessions.id],
  }),
}));

export const codeRevisionLinksRelations = relations(codeRevisionLinks, ({ one }) => ({
  session: one(assessmentSessions, {
    fields: [codeRevisionLinks.sessionId],
    references: [assessmentSessions.id],
  }),

  revision: one(workspaceRevisions, {
    fields: [codeRevisionLinks.revisionId],
    references: [workspaceRevisions.id],
  }),

  evidence: one(evidenceRecords, {
    fields: [codeRevisionLinks.evidenceId],
    references: [evidenceRecords.id],
  }),
}));

// â”€â”€ evaluation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const evaluationsRelations = relations(evaluations, ({ one, many }) => ({
  session: one(assessmentSessions, {
    fields: [evaluations.sessionId],
    references: [assessmentSessions.id],
  }),

  criteria: many(evaluationCriteria),

  reviewEvents: many(reviewEvents),

  feedback: one(candidateFeedback, {
    fields: [evaluations.id],
    references: [candidateFeedback.evaluationId],
  }),

  queueEntry: one(reviewQueue, {
    fields: [evaluations.id],
    references: [reviewQueue.evaluationId],
  }),
}));

export const evaluationCriteriaRelations = relations(evaluationCriteria, ({ one, many }) => ({
  evaluation: one(evaluations, {
    fields: [evaluationCriteria.evaluationId],
    references: [evaluations.id],
  }),

  findingLinks: many(findingEvidenceLinks),
}));

export const findingEvidenceLinksRelations = relations(findingEvidenceLinks, ({ one }) => ({
  criterion: one(evaluationCriteria, {
    fields: [findingEvidenceLinks.criterionId],
    references: [evaluationCriteria.id],
  }),

  evidence: one(evidenceRecords, {
    fields: [findingEvidenceLinks.evidenceId],
    references: [evidenceRecords.id],
  }),
}));

export const reviewEventsRelations = relations(reviewEvents, ({ one }) => ({
  evaluation: one(evaluations, {
    fields: [reviewEvents.evaluationId],
    references: [evaluations.id],
  }),

  criterion: one(evaluationCriteria, {
    fields: [reviewEvents.criterionId],
    references: [evaluationCriteria.id],
  }),
}));

export const candidateFeedbackRelations = relations(candidateFeedback, ({ one }) => ({
  evaluation: one(evaluations, {
    fields: [candidateFeedback.evaluationId],
    references: [evaluations.id],
  }),
}));

// â”€â”€ reports â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const reviewQueueRelations = relations(reviewQueue, ({ one, many }) => ({
  evaluation: one(evaluations, {
    fields: [reviewQueue.evaluationId],
    references: [evaluations.id],
  }),

  notes: many(reviewerNotes),

  decision: one(reviewerDecisions, {
    fields: [reviewQueue.id],
    references: [reviewerDecisions.evaluationId],
  }),
}));

export const reviewerNotesRelations = relations(reviewerNotes, ({ one }) => ({
  evaluation: one(evaluations, {
    fields: [reviewerNotes.evaluationId],
    references: [evaluations.id],
  }),

  reviewer: one(users, {
    fields: [reviewerNotes.reviewerId],
    references: [users.id],
  }),
}));

export const reviewerDecisionsRelations = relations(reviewerDecisions, ({ one }) => ({
  evaluation: one(evaluations, {
    fields: [reviewerDecisions.evaluationId],
    references: [evaluations.id],
  }),

  reviewer: one(users, {
    fields: [reviewerDecisions.reviewerId],
    references: [users.id],
  }),
}));

// â”€â”€ practice â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const practiceSessionsRelations = relations(practiceSessions, ({ one }) => ({
  candidate: one(users, {
    fields: [practiceSessions.candidateId],
    references: [users.id],
  }),
}));

export const practiceAllowancesRelations = relations(practiceAllowances, ({ one }) => ({
  candidate: one(users, {
    fields: [practiceAllowances.candidateId],
    references: [users.id],
  }),
}));

export const usageLedgerRelations = relations(usageLedger, ({ one }) => ({
  candidate: one(users, {
    fields: [usageLedger.candidateId],
    references: [users.id],
  }),
}));

// â”€â”€ AI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const aiUsageRecordsRelations = relations(aiUsageRecords, ({ one }) => ({
  organization: one(organizations, {
    fields: [aiUsageRecords.organizationId],
    references: [organizations.id],
  }),

  session: one(assessmentSessions, {
    fields: [aiUsageRecords.sessionId],
    references: [assessmentSessions.id],
  }),
}));

export const aiInteractionsRelations = relations(aiInteractions, ({ one }) => ({
  session: one(assessmentSessions, {
    fields: [aiInteractions.sessionId],
    references: [assessmentSessions.id],
  }),
}));

export const aiProviderConfigsRelations = relations(aiProviderConfigs, ({ one }) => ({
  organization: one(organizations, {
    fields: [aiProviderConfigs.organizationId],
    references: [organizations.id],
  }),
}));

// â”€â”€ notifications â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const notificationJobsRelations = relations(notificationJobs, ({ one }) => ({
  organization: one(organizations, {
    fields: [notificationJobs.organizationId],
    references: [organizations.id],
  }),

  user: one(users, {
    fields: [notificationJobs.userId],
    references: [users.id],
  }),
}));

// â”€â”€ audit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const auditEventsRelations = relations(auditEvents, ({ one }) => ({
  organization: one(organizations, {
    fields: [auditEvents.organizationId],
    references: [organizations.id],
  }),

  user: one(users, { fields: [auditEvents.userId], references: [users.id] }),
}));
