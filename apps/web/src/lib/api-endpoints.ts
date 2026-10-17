import {
  api,
  type ApiErrorResponse,
  type PaginationParams,
  type PaginatedResponse,
  isApiError,
  getErrorMessage,
} from "./api";
import type {
  Assessment,
  CreateAssessmentRequest,
  UpdateAssessmentRequest,
  AssessmentVersion,
  RubricVersion,
  AssessmentFile,
  AssessmentTestConfig,
} from "@contracts/assessment";
import type {
  CandidateAssignment,
  CreateAssignmentRequest,
  UpdateAssignmentRequest,
  AssessmentSession,
  StartSessionRequest,
} from "@contracts/assignments";
import type {
  PracticeTaskSummary,
  PracticeTask,
  PracticeSession,
  StartPracticeRequest,
  GetPracticeAllowanceResponse,
} from "@contracts/practice";
import type { Evaluation, EvaluationCriterion } from "@contracts/evaluation";
import type {
  CandidateFeedback,
  ReviewQueueItem,
  ReviewerNote,
  ReviewerDecision,
} from "@contracts/reports";
import type { EvidenceRecord, ActivityEvent } from "@contracts/evidence";
import type {
  AiInteraction,
  AiCoachResponse,
  AiCoachContext,
  AiCoachHistoryMessage,
} from "@contracts/ai";
import type { AgentResponse, AgentOperation, ApplyOperationsResponse } from "@contracts/agent";
import type { OrganizationWithRole, CreateOrganizationRequest } from "@contracts/auth";

export type AppProfile = {
  id: string;
  authId: string;
  email: string;
  name: string;
  role: "candidate" | "recruiter" | "admin";
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export const authApi = {
  upsertProfile: () => api.post<{ success: true; data: AppProfile }>("/api/v1/auth/profile"),

  getProfile: () => api.get<{ success: true; data: AppProfile }>("/api/v1/auth/profile"),
};

export const organizationsApi = {
  list: () => api.get<{ success: true; data: OrganizationWithRole[] }>("/api/v1/organizations"),

  create: (data: CreateOrganizationRequest) =>
    api.post<{ success: true; data: OrganizationWithRole }>("/api/v1/organizations", data),

  get: (id: string) =>
    api.get<{ success: true; data: OrganizationWithRole }>(`/api/v1/organizations/${id}`),
};

export const assessmentsApi = {
  list: (
    params?: PaginationParams & { status?: string; search?: string; organizationId?: string },
  ) =>
    api.get<{ success: true; data: PaginatedResponse<Assessment> }>("/api/v1/assessments", {
      params,
    }),

  create: (data: CreateAssessmentRequest) =>
    api.post<{ success: true; data: Assessment }>("/api/v1/assessments", data),

  get: (id: string) => api.get<{ success: true; data: Assessment }>(`/api/v1/assessments/${id}`),

  update: (id: string, data: UpdateAssessmentRequest) =>
    api.patch<{ success: true; data: Assessment }>(`/api/v1/assessments/${id}`, data),

  delete: (id: string) =>
    api.delete<{ success: true; data: { message: string } }>(`/api/v1/assessments/${id}`),

  publish: (id: string) =>
    api.post<{ success: true; data: Assessment }>(`/api/v1/assessments/${id}/publish`),

  getVersions: (id: string) =>
    api.get<{ success: true; data: AssessmentVersion[] }>(`/api/v1/assessments/${id}/versions`),

  createVersion: (id: string) =>
    api.post<{ success: true; data: AssessmentVersion }>(`/api/v1/assessments/${id}/versions`),

  getCurrentVersion: (id: string) =>
    api.get<{ success: true; data: AssessmentVersion }>(
      `/api/v1/assessments/${id}/current-version`,
    ),
};

export const rubricsApi = {
  list: (assessmentVersionId: string) =>
    api.get<{ success: true; data: RubricVersion[] }>(
      `/api/v1/assessments/versions/${assessmentVersionId}/rubrics`,
    ),

  get: (rubricId: string) =>
    api.get<{ success: true; data: RubricVersion }>(`/api/v1/rubrics/${rubricId}`),

  create: (
    assessmentVersionId: string,
    data: { version: number; criteria: unknown[]; totalPoints: number },
  ) =>
    api.post<{ success: true; data: RubricVersion }>(
      `/api/v1/assessments/versions/${assessmentVersionId}/rubrics`,
      data,
    ),

  update: (rubricId: string, data: { criteria?: unknown[]; totalPoints?: number }) =>
    api.patch<{ success: true; data: RubricVersion }>(`/api/v1/rubrics/${rubricId}`, data),
};

export const assessmentFilesApi = {
  list: (assessmentVersionId: string) =>
    api.get<{ success: true; data: AssessmentFile[] }>(
      `/api/v1/assessments/versions/${assessmentVersionId}/files`,
    ),

  get: (fileId: string) =>
    api.get<{ success: true; data: AssessmentFile }>(`/api/v1/assessment-files/${fileId}`),

  create: (
    assessmentVersionId: string,
    data: Omit<AssessmentFile, "id" | "assessmentVersionId" | "createdAt" | "updatedAt">,
  ) =>
    api.post<{ success: true; data: AssessmentFile }>(
      `/api/v1/assessments/versions/${assessmentVersionId}/files`,
      data,
    ),

  update: (fileId: string, data: Partial<AssessmentFile>) =>
    api.patch<{ success: true; data: AssessmentFile }>(`/api/v1/assessment-files/${fileId}`, data),

  delete: (fileId: string) =>
    api.delete<{ success: true; data: { message: string } }>(`/api/v1/assessment-files/${fileId}`),
};

export const testConfigApi = {
  get: (assessmentVersionId: string) =>
    api.get<{ success: true; data: AssessmentTestConfig }>(
      `/api/v1/assessments/versions/${assessmentVersionId}/test-config`,
    ),

  update: (assessmentVersionId: string, data: Partial<AssessmentTestConfig>) =>
    api.patch<{ success: true; data: AssessmentTestConfig }>(
      `/api/v1/assessments/versions/${assessmentVersionId}/test-config`,
      data,
    ),
};

export const assignmentsApi = {
  list: (params?: PaginationParams & { status?: string; organizationId?: string }) =>
    api.get<{ success: true; data: PaginatedResponse<CandidateAssignment> }>(
      "/api/v1/assignments",
      {
        params,
      },
    ),

  getMyAssignments: () =>
    api.get<{ success: true; data: CandidateAssignment[] }>("/api/v1/assignments/candidate/me"),

  create: (data: CreateAssignmentRequest) =>
    api.post<{ success: true; data: CandidateAssignment }>("/api/v1/assignments", data),

  get: (id: string) =>
    api.get<{ success: true; data: CandidateAssignment }>(`/api/v1/assignments/${id}`),

  update: (id: string, data: UpdateAssignmentRequest) =>
    api.patch<{ success: true; data: CandidateAssignment }>(`/api/v1/assignments/${id}`, data),

  withdraw: (id: string, reason: string) =>
    api.post<{ success: true; data: CandidateAssignment }>(`/api/v1/assignments/${id}/withdraw`, {
      reason,
    }),
};

export const sessionsApi = {
  start: (data: StartSessionRequest) =>
    api.post<{ success: true; data: AssessmentSession }>("/api/v1/auth/sessions/start", data),

  get: (sessionId: string) =>
    api.get<{ success: true; data: AssessmentSession }>(`/api/v1/auth/sessions/${sessionId}`),

  getByAssignment: (assignmentId: string) =>
    api.get<{ success: true; data: AssessmentSession }>(
      `/api/v1/auth/sessions/by-assignment/${assignmentId}`,
    ),

  submit: (sessionId: string) =>
    api.post<{ success: true; data: AssessmentSession }>(
      `/api/v1/auth/sessions/${sessionId}/submit`,
    ),

  pause: (sessionId: string) =>
    api.post<{ success: true; data: AssessmentSession }>(
      `/api/v1/auth/sessions/${sessionId}/pause`,
    ),

  resume: (sessionId: string) =>
    api.post<{ success: true; data: AssessmentSession }>(
      `/api/v1/auth/sessions/${sessionId}/resume`,
    ),

  heartbeat: (sessionId: string, data: { currentFile?: string; timeRemainingSeconds?: number }) =>
    api.post<{ success: true; data: AssessmentSession }>(
      `/api/v1/auth/sessions/${sessionId}/heartbeat`,
      data,
    ),
};

export const workspaceApi = {
  getRevisions: (sessionId: string) =>
    api.get<{
      success: true;
      data: Array<{
        id: string;
        revisionNumber: number;
        files: unknown[];
        message?: string;
        isSnapshot: boolean;
        createdAt: string;
      }>;
    }>(`/api/v1/sessions/${sessionId}/revisions`),

  createRevision: (
    sessionId: string,
    data: {
      revisionNumber: number;
      files: unknown[];
      message?: string;
      isSnapshot?: boolean;
    },
  ) =>
    api.post<{ success: true; data: { id: string } }>(
      `/api/v1/sessions/${sessionId}/revisions`,
      data,
    ),

  getFiles: (sessionId: string) =>
    api.get<{
      success: true;
      data: Array<{
        id: string;
        path: string;
        language: string;
        content: string;
        isReadOnly: boolean;
        isDeleted: boolean;
      }>;
    }>(`/api/v1/sessions/${sessionId}/files`),

  upsertFile: (
    sessionId: string,
    data: {
      path: string;
      language: string;
      content: string;
      isReadOnly?: boolean;
    },
  ) =>
    api.post<{ success: true; data: { id: string } }>(`/api/v1/sessions/${sessionId}/files`, data),

  deleteFile: (sessionId: string, path: string) =>
    api.delete<{ success: true; data: { message: string } }>(
      `/api/v1/sessions/${sessionId}/files/${encodeURIComponent(path)}`,
    ),
};

export const practiceApi = {
  listTasks: (params?: PaginationParams & { isActive?: boolean }) =>
    api.get<{ success: true; data: PaginatedResponse<PracticeTaskSummary> }>(
      "/api/v1/practice/tasks",
      {
        params,
      },
    ),

  getTask: (taskId: string) =>
    api.get<{ success: true; data: PracticeTask }>(`/api/v1/practice/tasks/${taskId}`),

  listSessions: (params?: PaginationParams) =>
    api.get<{ success: true; data: PaginatedResponse<PracticeSession> }>(
      "/api/v1/practice/sessions",
      {
        params,
      },
    ),

  startSession: (taskId: string) =>
    api.post<{ success: true; data: PracticeSession }>("/api/v1/practice/sessions/start", {
      taskId,
    }),

  getSession: (sessionId: string) =>
    api.get<{ success: true; data: PracticeSession }>(`/api/v1/practice/sessions/${sessionId}`),

  getAllowance: () =>
    api.get<{ success: true; data: GetPracticeAllowanceResponse }>("/api/v1/practice/allowance"),
};

export const evaluationApi = {
  list: (
    params?: PaginationParams & {
      candidateId?: string;
      organizationId?: string;
    },
  ) =>
    api.get<{ success: true; data: PaginatedResponse<Evaluation> }>("/api/v1/evaluations", {
      params,
    }),

  get: (id: string) => api.get<{ success: true; data: Evaluation }>(`/api/v1/evaluations/${id}`),

  getBySession: (sessionId: string) =>
    api.get<{ success: true; data: Evaluation }>(`/api/v1/evaluations/session/${sessionId}`),

  getCriteria: (evaluationId: string) =>
    api.get<{ success: true; data: EvaluationCriterion[] }>(
      `/api/v1/evaluations/${evaluationId}/criteria`,
    ),

  getFeedback: (evaluationId: string) =>
    api.get<{ success: true; data: CandidateFeedback }>(
      `/api/v1/evaluations/${evaluationId}/feedback`,
    ),

  releaseFeedback: (evaluationId: string) =>
    api.post<{ success: true; data: { message: string } }>(
      `/api/v1/evaluations/${evaluationId}/release-feedback`,
    ),
};

export const reviewQueueApi = {
  list: (params?: PaginationParams & { status?: string; organizationId?: string }) =>
    api.get<{ success: true; data: PaginatedResponse<ReviewQueueItem> }>("/api/v1/review-queue", {
      params,
    }),

  get: (id: string) =>
    api.get<{ success: true; data: ReviewQueueItem }>(`/api/v1/review-queue/${id}`),

  assignReviewer: (id: string, reviewerId: string) =>
    api.post<{ success: true; data: ReviewQueueItem }>(`/api/v1/review-queue/${id}/assign`, {
      reviewerId,
    }),

  addNote: (
    evaluationId: string,
    data: { note: string; criterionId?: string; isInternal?: boolean },
  ) =>
    api.post<{ success: true; data: ReviewerNote }>(
      `/api/v1/evaluations/${evaluationId}/reviewer-notes`,
      data,
    ),

  submitDecision: (
    evaluationId: string,
    data: {
      overallOutcome: string;
      criterionDecisions: unknown[];
      notes?: string;
      isFinal?: boolean;
    },
  ) =>
    api.post<{ success: true; data: ReviewerDecision }>(
      `/api/v1/evaluations/${evaluationId}/reviewer-decisions`,
      data,
    ),
};

export const evidenceApi = {
  list: (sessionId: string, params?: PaginationParams) =>
    api.get<{ success: true; data: PaginatedResponse<EvidenceRecord> }>(
      `/api/v1/sessions/${sessionId}/evidence`,
      {
        params,
      },
    ),

  get: (evidenceId: string) =>
    api.get<{ success: true; data: EvidenceRecord }>(`/api/v1/evidence/${evidenceId}`),

  listActivity: (sessionId: string, params?: PaginationParams) =>
    api.get<{ success: true; data: PaginatedResponse<ActivityEvent> }>(
      `/api/v1/sessions/${sessionId}/activity`,
      { params },
    ),
};

export const aiCoachApi = {
  prompt: (
    sessionId: string,
    data: {
      action: string;
      prompt?: string;
      context?: AiCoachContext;
      history?: AiCoachHistoryMessage[];
    },
  ) =>
    api.post<{ success: true; data: AiCoachResponse }>(
      `/api/v1/sessions/${sessionId}/ai-coach`,
      data,
    ),

  getHistory: (sessionId: string) =>
    api.get<{ success: true; data: AiInteraction[] }>(
      `/api/v1/sessions/${sessionId}/ai-coach/history`,
    ),
};

export const aiAgentApi = {
  run: (
    sessionId: string,
    data: {
      prompt: string;
      context?: AiCoachContext;
      history?: AiCoachHistoryMessage[];
    },
  ) =>
    api.post<{ success: true; data: AgentResponse }>(
      `/api/v1/sessions/${sessionId}/ai-agent`,
      data,
    ),

  apply: (sessionId: string, operations: AgentOperation[]) =>
    api.post<{ success: true; data: ApplyOperationsResponse }>(
      `/api/v1/sessions/${sessionId}/ai-agent/apply`,
      { operations },
    ),
};

export {
  api,
  type ApiErrorResponse,
  isApiError,
  getErrorMessage,
  type PaginationParams,
  type PaginatedResponse,
};
