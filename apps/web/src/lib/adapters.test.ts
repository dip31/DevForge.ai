import { describe, expect, it } from "vitest";

import type { Assessment as ApiAssessment } from "@contracts/assessment";

import {
  apiAssessmentToUi,
  formatAssessmentStatus,
  formatDifficulty,
  toCreateAssessmentRequest,
  toUpdateAssessmentRequest,
} from "./adapters";

const apiAssessment: ApiAssessment = {
  id: "11111111-1111-1111-1111-111111111111",
  organizationId: "22222222-2222-2222-2222-222222222222",
  title: "React Analytics Dashboard",
  description: "Build a responsive dashboard.",
  role: "Senior Frontend Engineer",
  skills: "React, TypeScript",
  durationMinutes: 90,
  difficulty: "intermediate",
  status: "published",
  isPublic: false,
  createdBy: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-02-15T00:00:00.000Z",
  publishedAt: "2026-01-02T00:00:00.000Z",
  archivedAt: null,
};

describe("adapters", () => {
  describe("formatDifficulty", () => {
    it("capitalises known difficulty enums", () => {
      expect(formatDifficulty("beginner")).toBe("Beginner");
      expect(formatDifficulty("intermediate")).toBe("Intermediate");
      expect(formatDifficulty("advanced")).toBe("Advanced");
    });
  });

  describe("formatAssessmentStatus", () => {
    it("maps published and non-published statuses to UI labels", () => {
      expect(formatAssessmentStatus("published")).toBe("Published");
      expect(formatAssessmentStatus("draft")).toBe("Draft");
      expect(formatAssessmentStatus("archived")).toBe("Draft");
    });
  });

  describe("apiAssessmentToUi", () => {
    it("maps an API assessment to the UI presentation model", () => {
      const ui = apiAssessmentToUi(apiAssessment);

      expect(ui.id).toBe(apiAssessment.id);
      expect(ui.title).toBe("React Analytics Dashboard");
      expect(ui.duration).toBe(90);
      expect(ui.difficulty).toBe("Intermediate");
      expect(ui.status).toBe("Published");
      expect(ui.candidates).toBe(0);
      expect(ui.updated).toBe(
        new Date(apiAssessment.updatedAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      );
    });
  });

  describe("toCreateAssessmentRequest", () => {
    it("converts form values to a create request", () => {
      const request = toCreateAssessmentRequest(
        {
          title: "  API Challenge  ",
          role: "Backend Engineer",
          description: "  Build an API.  ",
          skills: "  Node.js, REST  ",
          duration: "120",
          difficulty: "Advanced",
        },
        "22222222-2222-2222-2222-222222222222",
      );

      expect(request).toEqual({
        organizationId: "22222222-2222-2222-2222-222222222222",
        title: "API Challenge",
        role: "Backend Engineer",
        description: "Build an API.",
        skills: "Node.js, REST",
        durationMinutes: 120,
        difficulty: "advanced",
        isPublic: false,
      });
    });
  });

  describe("toUpdateAssessmentRequest", () => {
    it("converts form values to an update request without isPublic", () => {
      const request = toUpdateAssessmentRequest({
        title: "Updated",
        role: "Software Engineer",
        description: "Updated description.",
        skills: "JavaScript",
        duration: "45",
        difficulty: "Beginner",
      });

      expect(request).toEqual({
        title: "Updated",
        role: "Software Engineer",
        description: "Updated description.",
        skills: "JavaScript",
        durationMinutes: 45,
        difficulty: "beginner",
      });
      expect(request).not.toHaveProperty("isPublic");
    });
  });
});
