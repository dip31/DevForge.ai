import { describe, it, expect, vi, beforeEach } from "vitest";
import { analyzeTests, coachResponse, buildCoachContext, now, uid } from "./assessment";
import { normalizeEvidence, createEvaluation, EvidenceRecord } from "./evidence";
import { AssessmentSession, WorkspaceFile, TestResult, CandidateAssignment } from "./data";

describe("Data Utilities", () => {
  describe("uid", () => {
    it("generates unique IDs with prefix", () => {
      const id1 = uid("test");
      const id2 = uid("test");
      expect(id1).toContain("test-");
      expect(id2).toContain("test-");
      expect(id1).not.toBe(id2);
    });
  });

  describe("now", () => {
    it("returns ISO timestamp", () => {
      const timestamp = now();
      expect(typeof timestamp).toBe("string");
      expect(new Date(timestamp).toString()).not.toBe("Invalid Date");
    });
  });
});

describe("Assessment Analysis", () => {
  const mockFiles: WorkspaceFile[] = [
    {
      path: "src/taskUtils.js",
      language: "javascript",
      content: `
export function addTask(tasks, title, priority = "medium") {
  const cleanTitle = title.trim();
  if (!cleanTitle) return tasks;
  return [...tasks, { id: Date.now(), title: cleanTitle, priority, completed: false }];
}

export function toggleTask(tasks, taskId) {
  return tasks.map((task) =>
    task.id === taskId ? { ...task, completed: !task.completed } : task
  );
}

export function filterTasks(tasks, filter) {
  if (filter === "active") return tasks.filter((task) => !task.completed);
  if (filter === "completed") return tasks.filter((task) => task.completed);
  return tasks;
}
      `,
    },
    {
      path: "src/App.jsx",
      language: "jsx",
      content: `
import { useMemo, useState } from "react";

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState("all");

  const visibleTasks = useMemo(() => filterTasks(tasks, filter), [tasks, filter]);

  return (
    <main className="task-app">
      <h1>Team tasks</h1>
      {visibleTasks.length === 0 && <div className="empty-state">Nothing here</div>}
      {visibleTasks.map((task) => <div key={task.id}>{task.title}</div>)}
    </main>
  );
}
      `,
    },
  ];

  describe("analyzeTests", () => {
    it("detects all 6 supported checks for complete implementation", () => {
      const results = analyzeTests(mockFiles);
      expect(results).toHaveLength(6);
      const passed = results.filter((r) => r.status === "passed");
      expect(passed).toHaveLength(6);
    });

    it("detects missing filter implementation", () => {
      const incompleteFiles = mockFiles.map((f) =>
        f.path === "src/taskUtils.js"
          ? {
              ...f,
              content: f.content.replace(
                /filterTasks[\s\S]*$/,
                "export function filterTasks(tasks, filter) { return tasks; }",
              ),
            }
          : f,
      );
      const results = analyzeTests(incompleteFiles);
      const filterResult = results.find((r) => r.id === "filter");
      expect(filterResult?.status).toBe("failed");
    });

    it("detects missing empty state handling", () => {
      const incompleteFiles = mockFiles.map((f) =>
        f.path === "src/App.jsx"
          ? {
              ...f,
              content: f.content.replace(/visibleTasks\.length === 0.*empty-state/, ""),
            }
          : f,
      );
      const results = analyzeTests(incompleteFiles);
      const emptyStateResult = results.find((r) => r.id === "empty-state");
      expect(emptyStateResult?.status).toBe("failed");
    });
  });

  describe("coachResponse", () => {
    const mockSession: AssessmentSession = {
      sessionId: "test-session",
      candidateId: "alex-morgan",
      companyId: "novatech-solutions",
      assignmentId: "novatech-task-manager",
      assessmentId: "frontend-developer-coding-challenge",
      startedAt: new Date().toISOString(),
      durationMinutes: 45,
      currentFile: "src/taskUtils.js",
      files: mockFiles,
      savedFiles: mockFiles,
      unsaved: false,
      revisions: [
        {
          id: "revision-0",
          timestamp: new Date().toISOString(),
          files: mockFiles,
        },
      ],
      coachMessages: [],
      runHistory: [],
      testRuns: [],
      activity: [],
    };

    it("provides hint based on latest test failure", () => {
      const sessionWithFailure: AssessmentSession = {
        ...mockSession,
        testRuns: [
          {
            id: "test-1",
            timestamp: new Date().toISOString(),
            revisionId: "revision-1",
            results: [
              {
                id: "filter",
                name: "Filtering tasks by status",
                status: "failed",
                diagnostic: "Support both active and completed filtering",
                criterion: "Filter tasks by status",
              },
              {
                id: "add",
                name: "Adding a task",
                status: "passed",
                diagnostic: "Supported source pattern detected",
                criterion: "Add a task",
              },
            ],
          },
        ],
      };
      const response = coachResponse("hint", "", sessionWithFailure);
      expect(response.content).toContain("Filtering tasks by status");
      expect(response.explanation).toContain("deterministic test result");
    });

    it("explains active code when asked", () => {
      const response = coachResponse("explain", "", mockSession);
      expect(response.content).toContain("taskUtils.js");
      expect(response.explanation).toContain("active filename");
    });

    it("helps debug latest error", () => {
      const sessionWithFailure: AssessmentSession = {
        ...mockSession,
        testRuns: [
          {
            id: "test-1",
            timestamp: new Date().toISOString(),
            revisionId: "revision-1",
            results: [
              {
                id: "filter",
                name: "Filtering tasks by status",
                status: "failed",
                diagnostic: "Support both active and completed filtering",
                criterion: "Filter tasks by status",
              },
            ],
          },
        ],
      };
      const response = coachResponse("debug", "", sessionWithFailure);
      expect(response.content).toContain("Filtering tasks by status");
      expect(response.suggestion).toBeDefined();
    });

    it("responds to a greeting with a greeting, not debugging instructions", () => {
      const response = coachResponse("prompt", "hiii", mockSession);
      expect(response.content).toMatch(/hi!/i);
      expect(response.content).not.toMatch(/one acceptance criterion at a time/i);
    });

    it("does not send a theme request to the debugging fallback", () => {
      const response = coachResponse("prompt", "make the entire theme dark", mockSession);
      expect(response.content).toMatch(/can't change the theme/i);
      expect(response.content).not.toMatch(/one acceptance criterion at a time/i);
    });

    it("classifies a code explanation request and asks for a file when none is active", () => {
      const response = coachResponse("prompt", "explain this code", {
        ...mockSession,
        currentFile: "src/missing.js",
      });
      expect(response.content).toMatch(/which file or function/i);
    });

    it("gives an honest clarification for unsupported requests", () => {
      const response = coachResponse("prompt", "write me a haiku about clouds", mockSession);
      expect(response.content).toMatch(/not sure what you'd like help with/i);
      expect(response.content).not.toMatch(/one acceptance criterion at a time/i);
    });

    it("passes real assessment requirements into the coach context", () => {
      const context = buildCoachContext({
        ...mockSession,
        taskDetails: {
          instructions: "Build the task manager.",
          requirements: ["Add a task", "Filter tasks by status"],
        },
      });
      expect(context.instructions).toBe("Build the task manager.");
      expect(context.requirements).toEqual(["Add a task", "Filter tasks by status"]);
    });

    it("hints from real requirements when no failure is stored", () => {
      const response = coachResponse("hint", "", {
        ...mockSession,
        testRuns: [],
        taskDetails: { requirements: ["Add a task", "Filter tasks by status"] },
      });
      expect(response.content).toContain("Add a task");
    });
  });
});

describe("Evidence Normalization", () => {
  const mockSession: AssessmentSession = {
    sessionId: "test-session",
    candidateId: "alex-morgan",
    companyId: "novatech-solutions",
    assignmentId: "novatech-task-manager",
    assessmentId: "frontend-developer-coding-challenge",
    startedAt: "2025-01-01T10:00:00.000Z",
    durationMinutes: 45,
    currentFile: "src/taskUtils.js",
    files: [],
    savedFiles: [],
    unsaved: false,
    revisions: [{ id: "revision-0", timestamp: "2025-01-01T10:00:00.000Z", files: [] }],
    coachMessages: [
      {
        id: "msg-1",
        role: "coach",
        content: "Welcome!",
        timestamp: "2025-01-01T10:00:00.000Z",
        explanation: "Demo response",
      },
      {
        id: "msg-2",
        role: "candidate",
        content: "Help me with filter",
        timestamp: "2025-01-01T10:05:00.000Z",
      },
    ],
    runHistory: [
      {
        id: "run-1",
        timestamp: "2025-01-01T10:10:00.000Z",
        revisionId: "revision-1",
        status: "success",
        message: "OK",
      },
    ],
    testRuns: [
      {
        id: "test-1",
        timestamp: "2025-01-01T10:15:00.000Z",
        revisionId: "revision-1",
        results: [
          {
            id: "add",
            name: "Adding a task",
            status: "passed",
            diagnostic: "OK",
            criterion: "Add a task",
          },
          {
            id: "filter",
            name: "Filtering tasks",
            status: "failed",
            diagnostic: "Missing filter",
            criterion: "Filter tasks by status",
          },
        ],
      },
    ],
    activity: [
      {
        id: "evt-1",
        type: "assessment_started",
        timestamp: "2025-01-01T10:00:00.000Z",
        detail: "Started",
        provenance: "candidate_action",
      },
      {
        id: "evt-2",
        type: "file_opened",
        timestamp: "2025-01-01T10:01:00.000Z",
        file: "src/taskUtils.js",
        detail: "Opened taskUtils",
        provenance: "system_generated",
      },
      {
        id: "evt-3",
        type: "code_changed",
        timestamp: "2025-01-01T10:02:00.000Z",
        file: "src/taskUtils.js",
        detail: "Changed taskUtils",
        provenance: "unknown",
      },
      {
        id: "evt-4",
        type: "workspace_saved",
        timestamp: "2025-01-01T10:03:00.000Z",
        file: "src/taskUtils.js",
        revisionId: "revision-1",
        detail: "Saved",
        provenance: "candidate_action",
      },
      {
        id: "evt-5",
        type: "test_run",
        timestamp: "2025-01-01T10:15:00.000Z",
        revisionId: "revision-1",
        resultId: "test-1",
        detail: "Ran tests",
        provenance: "candidate_action",
      },
    ],
    submittedAt: "2025-01-01T10:30:00.000Z",
  };

  it("creates evidence records for all activity events", () => {
    const evidence = normalizeEvidence(mockSession);
    expect(evidence.length).toBeGreaterThan(0);
    const eventEvidence = evidence.filter(
      (e) => e.type === "assessment_event" || e.type === "file_event",
    );
    expect(eventEvidence.length).toBeGreaterThanOrEqual(4);
  });

  it("creates evidence for coach messages", () => {
    const evidence = normalizeEvidence(mockSession);
    const coachEvidence = evidence.filter(
      (e) => e.type === "ai_coach_prompt" || e.type === "ai_coach_response",
    );
    expect(coachEvidence.length).toBe(2);
  });

  it("creates evidence for test runs", () => {
    const evidence = normalizeEvidence(mockSession);
    const testEvidence = evidence.filter((e) => e.type === "test_result");
    expect(testEvidence.length).toBe(2);
  });

  it("sorts evidence chronologically", () => {
    const evidence = normalizeEvidence(mockSession);
    for (let i = 1; i < evidence.length; i++) {
      expect(new Date(evidence[i].timestamp).getTime()).toBeGreaterThanOrEqual(
        new Date(evidence[i - 1].timestamp).getTime(),
      );
    }
  });
});

describe("Evaluation Creation", () => {
  const mockSubmittedSession: AssessmentSession = {
    sessionId: "eval-session",
    candidateId: "alex-morgan",
    companyId: "novatech-solutions",
    assignmentId: "novatech-task-manager",
    assessmentId: "frontend-developer-coding-challenge",
    startedAt: "2025-01-01T10:00:00.000Z",
    durationMinutes: 45,
    currentFile: "src/taskUtils.js",
    files: [],
    savedFiles: [],
    unsaved: false,
    revisions: [
      { id: "revision-0", timestamp: "2025-01-01T10:00:00.000Z", files: [] },
      { id: "revision-1", timestamp: "2025-01-01T10:15:00.000Z", files: [] },
    ],
    coachMessages: [
      {
        id: "msg-1",
        role: "candidate",
        content: "Help with filter",
        timestamp: "2025-01-01T10:05:00.000Z",
      },
      {
        id: "msg-2",
        role: "coach",
        content: "Try this...",
        timestamp: "2025-01-01T10:06:00.000Z",
        explanation: "Demo",
      },
    ],
    runHistory: [
      {
        id: "run-1",
        timestamp: "2025-01-01T10:10:00.000Z",
        revisionId: "revision-1",
        status: "success",
        message: "OK",
      },
    ],
    testRuns: [
      {
        id: "test-1",
        timestamp: "2025-01-01T10:15:00.000Z",
        revisionId: "revision-1",
        results: [
          {
            id: "add",
            name: "Adding a task",
            status: "passed",
            diagnostic: "OK",
            criterion: "Add a task",
          },
          {
            id: "filter",
            name: "Filtering tasks",
            status: "passed",
            diagnostic: "OK",
            criterion: "Filter tasks by status",
          },
          {
            id: "empty",
            name: "Handling empty task titles",
            status: "passed",
            diagnostic: "OK",
            criterion: "Preserve task state during interaction",
          },
          {
            id: "complete",
            name: "Marking a task complete",
            status: "passed",
            diagnostic: "OK",
            criterion: "Mark a task complete",
          },
          {
            id: "priority",
            name: "Preserving task priority",
            status: "passed",
            diagnostic: "OK",
            criterion: "Set task priority",
          },
          {
            id: "empty-state",
            name: "Showing an empty state",
            status: "passed",
            diagnostic: "OK",
            criterion: "Display an empty state",
          },
        ],
      },
    ],
    activity: [
      {
        id: "evt-1",
        type: "assessment_started",
        timestamp: "2025-01-01T10:00:00.000Z",
        detail: "Started",
        provenance: "candidate_action",
      },
      {
        id: "evt-2",
        type: "code_changed",
        timestamp: "2025-01-01T10:05:00.000Z",
        detail: "Applied coach suggestion",
        provenance: "candidate_action",
      },
      {
        id: "evt-3",
        type: "workspace_saved",
        timestamp: "2025-01-01T10:15:00.000Z",
        revisionId: "revision-1",
        detail: "Saved",
        provenance: "candidate_action",
      },
      {
        id: "evt-4",
        type: "test_run",
        timestamp: "2025-01-01T10:15:00.000Z",
        revisionId: "revision-1",
        resultId: "test-1",
        detail: "Ran tests",
        provenance: "candidate_action",
      },
      {
        id: "evt-5",
        type: "assessment_submitted",
        timestamp: "2025-01-01T10:30:00.000Z",
        revisionId: "revision-1",
        detail: "Submitted",
        provenance: "candidate_action",
      },
    ],
    submittedAt: "2025-01-01T10:30:00.000Z",
  };

  it("creates evaluation with all 5 criteria", () => {
    const evaluation = createEvaluation(mockSubmittedSession);
    expect(evaluation.criteria).toHaveLength(5);
    const criterionIds = evaluation.criteria.map((c) => c.id);
    expect(criterionIds).toContain("functional-correctness");
    expect(criterionIds).toContain("code-quality");
    expect(criterionIds).toContain("testing-debugging");
    expect(criterionIds).toContain("problem-solving");
    expect(criterionIds).toContain("ai-collaboration");
  });

  it("marks functional correctness as Demonstrated when all tests pass", () => {
    const evaluation = createEvaluation(mockSubmittedSession);
    const functional = evaluation.criteria.find((c) => c.id === "functional-correctness");
    expect(functional?.status).toBe("Demonstrated");
    expect(functional?.supportedScore).toBe(100);
  });

  it("includes custom rubric version when provided", () => {
    const evaluation = createEvaluation(mockSubmittedSession, null, [
      {
        id: "custom-1",
        title: "Custom Criterion",
        category: "Custom",
        description: "Test",
        points: 10,
      },
    ]);
    expect(evaluation.rubricVersion).toContain("custom-1");
  });

  it("includes evidence coverage calculation", () => {
    const evaluation = createEvaluation(mockSubmittedSession);
    expect(evaluation.evidenceCoverage).toBeGreaterThan(0);
    expect(evaluation.evidenceCoverage).toBeLessThanOrEqual(100);
  });

  it("includes evaluation status", () => {
    const evaluation = createEvaluation(mockSubmittedSession);
    expect(["Ready for Review", "Needs Attention", "Inconclusive", "Reviewed"]).toContain(
      evaluation.evaluationStatus,
    );
  });
});

describe("Timer Logic", () => {
  it("calculates remaining time correctly", () => {
    const startedAt = new Date("2025-01-01T10:00:00.000Z").getTime();
    const durationMinutes = 45;
    const end = startedAt + durationMinutes * 60_000;
    const now = new Date("2025-01-01T10:20:00.000Z").getTime();
    const remaining = Math.max(0, end - now);
    const minutes = Math.floor(remaining / 60_000);
    const seconds = Math.floor((remaining % 60_000) / 1000);
    expect(minutes).toBe(25);
    expect(seconds).toBe(0);
  });

  it("shows expired when time is up", () => {
    const startedAt = new Date("2025-01-01T10:00:00.000Z").getTime();
    const durationMinutes = 45;
    const end = startedAt + durationMinutes * 60_000;
    const now = new Date("2025-01-01T10:50:00.000Z").getTime();
    const remaining = Math.max(0, end - now);
    expect(remaining).toBe(0);
  });
});
