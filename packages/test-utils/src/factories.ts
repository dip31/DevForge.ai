import { createId } from "@paralleldrive/cuid2";
import type { User, Organization, Assessment, AssessmentVersion } from "@database/schema";

export function createTestUser(overrides: Partial<User> = {}): User {
  return {
    id: createId(),
    email: `test-${createId()}@example.com`,
    passwordHash: "$2a$10$testhash",
    name: "Test User",
    role: "candidate",
    avatarUrl: null,
    isActive: true,
    emailVerified: true,
    emailVerificationToken: null,
    emailVerificationExpires: null,
    passwordResetToken: null,
    passwordResetExpires: null,
    lastLoginAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createTestOrganization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: createId(),
    name: "Test Organization",
    slug: `test-org-${createId()}`,
    description: null,
    logoUrl: null,
    websiteUrl: null,
    billingEmail: null,
    isActive: true,
    settings: "{}",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createTestAssessment(overrides: Partial<Assessment> = {}): Assessment {
  return {
    id: createId(),
    organizationId: createId(),
    title: "Test Assessment",
    description: "A test assessment",
    role: "Software Engineer",
    skills: "JavaScript, Testing",
    durationMinutes: 60,
    difficulty: "intermediate",
    status: "published",
    isPublic: false,
    createdBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    archivedAt: null,
    ...overrides,
  };
}

export function createTestAssessmentVersion(
  overrides: Partial<AssessmentVersion> = {},
): AssessmentVersion {
  return {
    id: createId(),
    assessmentId: createId(),
    version: 1,
    title: "Test Assessment v1",
    description: "A test assessment version",
    role: "Software Engineer",
    skills: "JavaScript, Testing",
    durationMinutes: 60,
    difficulty: "intermediate",
    starterFiles: [],
    testConfig: {},
    instructions: null,
    aiPolicy: null,
    createdAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    isCurrent: true,
    ...overrides,
  };
}

export function createTestCandidateProfile() {
  return {
    id: createId(),
    userId: createId(),
    headline: "Software Engineer",
    bio: "Experienced developer",
    location: "San Francisco, CA",
    timezone: "America/Los_Angeles",
    githubUrl: "https://github.com/test",
    linkedinUrl: "https://linkedin.com/in/test",
    portfolioUrl: "https://portfolio.test",
    skills: ["JavaScript", "TypeScript", "React"],
    experienceYears: 5,
    preferredRoles: ["Software Engineer", "Full Stack Developer"],
    practiceAttemptsUsed: 0,
    practiceAttemptsLimit: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createTestSession() {
  return {
    id: createId(),
    assignmentId: createId(),
    candidateId: createId(),
    assessmentVersionId: createId(),
    status: "in_progress",
    startedAt: new Date().toISOString(),
    pausedAt: null,
    resumedAt: null,
    submittedAt: null,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    timeRemainingSeconds: 3600,
    totalPausedSeconds: 0,
    currentFile: "src/App.jsx",
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createTestEvidenceRecord() {
  return {
    id: createId(),
    candidateId: createId(),
    organizationId: createId(),
    assignmentId: createId(),
    assessmentId: createId(),
    sessionId: createId(),
    type: "test_result",
    timestamp: new Date().toISOString(),
    title: "Test passed",
    summary: "Test passed successfully",
    file: "src/test.js",
    revisionId: null,
    sourceEventId: null,
    resultId: null,
    contentRef: "test:123",
    provenance: "system_generated",
    integrity: "available",
    testStatus: "passed",
    metadata: {},
    createdAt: new Date().toISOString(),
  };
}
