/**
 * Adapters between backend API contracts and the UI's presentation models.
 *
 * The UI models (see ./data) predate the API and differ in a few ways:
 *   - difficulty is capitalised ("Intermediate") vs the API enum ("intermediate")
 *   - status uses "Draft" | "Published" | "In progress" vs "draft" | "published" | "archived"
 *   - duration is a plain number vs durationMinutes
 *   - candidates (a display count) and updated (a formatted date) have no direct API field
 *
 * Keeping the translation here avoids leaking API types into the large UI components.
 */
import type {
  Assessment as ApiAssessment,
  CreateAssessmentRequest,
  UpdateAssessmentRequest,
} from "@contracts/assessment";

import type { CandidateAssignment as ApiCandidateAssignment } from "@contracts/assignments";

import type { Assessment as UiAssessment, CandidateAssignment as UiCandidateAssignment } from "../data";

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export function formatDifficulty(value: string): string {
  return DIFFICULTY_LABELS[value] ?? value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatUpdated(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatAssessmentStatus(status: string): UiAssessment["status"] {
  return status === "published" ? "Published" : "Draft";
}

export function apiCandidateAssignmentToUi(assignment: ApiCandidateAssignment): UiCandidateAssignment {
  const taskDetails = assignment.taskDetails || {};
  const skills = taskDetails.skills || "";
  const skillsArray = skills ? skills.split(",").map(s => s.trim()).filter(Boolean) : [];
  
  return {
    id: assignment.id,
    companyId: assignment.organizationId,
    company: taskDetails.company || "Unknown Company",
    assessment: taskDetails.title || "Assessment",
    task: taskDetails.title || "Assessment",
    description: taskDetails.description || "",
    duration: taskDetails.durationMinutes || 60,
    deadline: assignment.deadline ? new Date(assignment.deadline).toLocaleDateString() : undefined,
    difficulty: formatDifficulty(taskDetails.difficulty || "intermediate"),
    skills: skillsArray,
    implemented: true,
    starterFiles: taskDetails.starterFiles || [],
    instructions: taskDetails.instructions,
    aiPolicy: taskDetails.aiPolicy,
    taskDetails,
  };
}

export function apiAssessmentToUi(assessment: ApiAssessment): UiAssessment {
  return {
    id: assessment.id,
    title: assessment.title,
    role: assessment.role,
    description: assessment.description,
    skills: assessment.skills,
    duration: assessment.durationMinutes,
    difficulty: formatDifficulty(assessment.difficulty),
    status: formatAssessmentStatus(assessment.status),
    candidates: 0,
    updated: formatUpdated(assessment.updatedAt),
  };
}

export type AssessmentFormValues = {
  title: string;
  role: string;
  description: string;
  skills: string;
  duration: string;
  difficulty: string;
};

export function toCreateAssessmentRequest(
  form: AssessmentFormValues,
  organizationId: string,
): CreateAssessmentRequest {
  return {
    organizationId,
    title: form.title.trim(),
    role: form.role,
    description: form.description.trim(),
    skills: form.skills.trim(),
    durationMinutes: Number(form.duration),
    difficulty: form.difficulty.toLowerCase() as CreateAssessmentRequest["difficulty"],
    isPublic: false,
  };
}

export function toUpdateAssessmentRequest(form: AssessmentFormValues): UpdateAssessmentRequest {
  return {
    title: form.title.trim(),
    role: form.role,
    description: form.description.trim(),
    skills: form.skills.trim(),
    durationMinutes: Number(form.duration),
    difficulty: form.difficulty.toLowerCase() as UpdateAssessmentRequest["difficulty"],
  };
}
