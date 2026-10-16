import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import {
  ActivityEvent,
  AssessmentSession,
  candidateAssignments,
  CandidateAssignment,
  CoachMessage,
  starterWorkspaceFiles,
  TestResult,
  WorkspaceFile,
} from "./data";
import { aiCoachApi } from "./lib/api-endpoints";
import type { AiCoachContext } from "@contracts/ai";
import "./workspace.css";

type PersistSession = (session: AssessmentSession) => boolean;
export type UpdateSession = (
  next: AssessmentSession | ((current: AssessmentSession) => AssessmentSession),
) => void;

export const now = () => new Date().toISOString();
export const uid = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function go(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0 });
}

export function WIcon({
  name,
  size = 17,
}: {
  name:
    | "ai"
    | "arrow"
    | "account"
    | "back"
    | "branch"
    | "check"
    | "chevron"
    | "code"
    | "extensions"
    | "eye"
    | "file"
    | "filter"
    | "folder"
    | "history"
    | "info"
    | "play"
    | "plus"
    | "refresh"
    | "save"
    | "search"
    | "send"
    | "settings"
    | "split"
    | "stop"
    | "terminal"
    | "test"
    | "timer"
    | "trash"
    | "warning"
    | "x";
  size?: number;
}) {
  const paths: Record<string, ReactNode> = {
    account: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0116 0" />
      </>
    ),
    ai: (
      <>
        <path d="M12 3l1.3 4.3L18 9l-4.7 1.7L12 15l-1.3-4.3L6 9l4.7-1.7z" />
        <path d="M19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="M14 7l5 5-5 5" />
      </>
    ),
    back: (
      <>
        <path d="M19 12H5" />
        <path d="M10 7l-5 5 5 5" />
      </>
    ),
    branch: (
      <>
        <circle cx="6" cy="5" r="2" />
        <circle cx="18" cy="6" r="2" />
        <circle cx="6" cy="19" r="2" />
        <path d="M6 7v10M8 7c5 0 4-1 8-1M8 17c6 0 4-9 8-9" />
      </>
    ),
    check: <path d="M5 12l4 4L19 6" />,
    chevron: <path d="M9 18l6-6-6-6" />,
    code: (
      <>
        <path d="M9 18l-6-6 6-6M15 6l6 6-6 6" />
      </>
    ),
    extensions: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <path d="M17.5 13v9M13 17.5h9" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    file: (
      <>
        <path d="M6 2h8l4 4v16H6z" />
        <path d="M14 2v5h5" />
      </>
    ),
    filter: <path d="M4 6h16M7 12h10M10 18h4" />,
    folder: <path d="M3 6h7l2 2h9v11H3z" />,
    history: (
      <>
        <path d="M3 12a9 9 0 109-9 9 9 0 00-7 3.3L3 8" />
        <path d="M3 3v5h5M12 7v5l3 2" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 8h.01" />
      </>
    ),
    play: <path d="M8 5l11 7-11 7z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    refresh: (
      <>
        <path d="M20 6v5h-5" />
        <path d="M19 11a7 7 0 10.2 4" />
      </>
    ),
    save: (
      <>
        <path d="M5 3h12l2 2v16H5z" />
        <path d="M8 3v6h8V3M8 21v-7h8v7" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-4-4" />
      </>
    ),
    send: (
      <>
        <path d="M22 2L11 13" />
        <path d="M22 2l-7 20-4-9-9-4z" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.6V21h-4v-.1a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 00.3-1.9A1.7 1.7 0 003 14H3v-4h.1a1.7 1.7 0 001.6-1 1.7 1.7 0 00-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 009 4.6a1.7 1.7 0 001-1.6V3h4v.1a1.7 1.7 0 001 1.6 1.7 1.7 0 001.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 00-.3 1.9 1.7 1.7 0 001.6 1h.1v4H21a1.7 1.7 0 00-1.6 1z" />
      </>
    ),
    split: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="1" />
        <path d="M12 4v16" />
      </>
    ),
    stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
    test: (
      <>
        <path d="M9 3v5l-5 9a3 3 0 003 4h10a3 3 0 003-4l-5-9V3" />
        <path d="M7 14h10M8 3h8" />
      </>
    ),
    terminal: (
      <>
        <path d="M4 7l5 5-5 5M12 17h8" />
        <rect x="2" y="3" width="20" height="18" rx="2" />
      </>
    ),
    timer: (
      <>
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v5l3 2M9 2h6" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14" />
      </>
    ),
    warning: (
      <>
        <path d="M12 3L2 21h20z" />
        <path d="M12 9v5M12 17h.01" />
      </>
    ),
    x: <path d="M6 6l12 12M18 6L6 18" />,
  };
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

function CompanyMark({ company }: { company: string }) {
  return (
    <span className="company-mark">
      {company
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}

export function assignmentStatus(
  assignment: CandidateAssignment,
  session: AssessmentSession | null,
) {
  if (assignment.id !== session?.assignmentId) return "Assigned";
  if (session.submittedAt) return "Submitted";
  return "In Progress";
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`as-status ${status.toLowerCase().replace(" ", "-")}`}>
      <i></i>
      {status}
    </span>
  );
}

function ActionButton({
  children,
  onClick,
  secondary = false,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      className={`as-button ${secondary ? "secondary" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function CandidateAssignmentCards({
  session,
  compact = false,
  assignments,
}: {
  session: AssessmentSession | null;
  compact?: boolean;
  assignments: CandidateAssignment[];
}) {
  return (
    <div className={`assignment-card-grid ${compact ? "compact" : ""}`}>
      {assignments.map((assignment) => {
        const status = assignmentStatus(assignment, session);
        const label =
          status === "Submitted"
            ? "View Submission"
            : status === "In Progress"
              ? "Resume Assessment"
              : "View Assessment";
        return (
          <article className="assignment-card-v2 card" key={assignment.id}>
            <div className="assignment-company">
              <CompanyMark company={assignment.company} />
              <div>
                <strong>{assignment.company}</strong>
                <small>Illustrative company · Demo assignment</small>
              </div>
              <StatusPill status={status} />
            </div>
            <div className="assignment-body">
              <span>{assignment.assessment}</span>
              <h3>{assignment.task}</h3>
              <p>{assignment.description}</p>
              <div className="assignment-facts">
                <span>
                  <WIcon name="timer" />
                  {assignment.duration} min
                </span>
                <span>
                  <WIcon name="test" />
                  {assignment.difficulty}
                </span>
                {assignment.deadline && (
                  <span>
                    <WIcon name="history" />
                    Due {assignment.deadline}
                  </span>
                )}
              </div>
              <div className="assignment-skills">
                {assignment.skills.slice(0, compact ? 3 : 5).map((skill) => (
                  <span key={skill}>{skill}</span>
                ))}
              </div>
            </div>
            <div className="assignment-actions">
              <button onClick={() => go(`/candidate/assessments/${assignment.id}`)}>
                {label}
                <WIcon name="arrow" />
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function AssignedAssessmentsV2({
  session,
  assignments,
}: {
  session: AssessmentSession | null;
  assignments: CandidateAssignment[];
}) {
  const [filter, setFilter] = useState("All");
  const visible = assignments.filter(
    (item) => filter === "All" || assignmentStatus(item, session) === filter,
  );
  return (
    <>
      <div className="assessment-page-heading">
        <div>
          <span>Candidate workspace</span>
          <h1>Assigned assessments</h1>
          <p>
            Review company-specific demo assignments and continue from your actual session state.
          </p>
        </div>
        <span className="demo-disclaimer">
          <i></i>Illustrative companies and invitations
        </span>
      </div>
      <div className="assignment-filters" role="group" aria-label="Filter assignments">
        {["All", "Assigned", "In Progress", "Submitted"].map((item) => (
          <button
            className={filter === item ? "active" : ""}
            onClick={() => setFilter(item)}
            key={item}
          >
            {item}
            <span>
              {
                candidateAssignments.filter(
                  (assignment) => item === "All" || assignmentStatus(assignment, session) === item,
                ).length
              }
            </span>
          </button>
        ))}
      </div>
      {visible.length ? (
        <CandidateAssignmentCards session={session} assignments={visible} />
      ) : (
        <div className="assignment-empty card">
          <WIcon name="filter" size={22} />
          <h2>No {filter.toLowerCase()} assignments</h2>
          <p>Your current demo assignment state does not include records in this filter.</p>
        </div>
      )}
    </>
  );
}

export function CandidateHistoryV2({ session }: { session: AssessmentSession | null }) {
  const submitted = session?.submittedAt;
  return (
    <>
      <div className="assessment-page-heading">
        <div>
          <span>Candidate workspace</span>
          <h1>Assessment history</h1>
          <p>
            Submitted assessment records are shown without invented skill scores or hiring outcomes.
          </p>
        </div>
        <span className="demo-disclaimer">
          <i></i>Demo records only
        </span>
      </div>
      {submitted ? (
        <article className="history-submission card">
          <CompanyMark company="NovaTech Solutions" />
          <div>
            <span>NovaTech Solutions</span>
            <h2>Build a Team Task Manager</h2>
            <p>
              Submitted {new Date(submitted).toLocaleString()} ·{" "}
              {session.testRuns.at(-1)?.results.filter((r) => r.status === "passed").length ?? 0}
              /6 supported checks passed
            </p>
          </div>
          <ActionButton
            secondary
            onClick={() => go("/candidate/assessments/novatech-task-manager/submission")}
          >
            View Submission
          </ActionButton>
        </article>
      ) : (
        <div className="assignment-empty card">
          <WIcon name="history" size={22} />
          <h2>No submitted assessments yet</h2>
          <p>
            Your submitted NovaTech assessment will appear here after the confirmation flow is
            complete.
          </p>
          <ActionButton onClick={() => go("/candidate/assessments")}>
            View assigned assessments
          </ActionButton>
        </div>
      )}
    </>
  );
}

export function AssessmentDetails({
  assignment,
  session,
}: {
  assignment: CandidateAssignment;
  session: AssessmentSession | null;
}) {
  const status = assignmentStatus(assignment, session);
  const unavailable = !assignment.implemented;
  return (
    <div className="assessment-detail-page">
      <button className="detail-back" onClick={() => go("/candidate/assessments")}>
        <WIcon name="back" />
        Back to assigned assessments
      </button>
      <section className="assessment-detail-hero card">
        <div className="detail-company">
          <CompanyMark company={assignment.company} />
          <div>
            <span>{assignment.company}</span>
            <small>Illustrative demo company</small>
          </div>
          <StatusPill status={status} />
        </div>
        <span className="detail-eyebrow">{assignment.assessment}</span>
        <h1>{assignment.task}</h1>
        <p>{assignment.description}</p>
        <div className="detail-facts">
          <div>
            <WIcon name="timer" />
            <span>
              <small>Duration</small>
              <strong>{assignment.duration} minutes</strong>
            </span>
          </div>
          <div>
            <WIcon name="history" />
            <span>
              <small>Deadline</small>
              <strong>{assignment.deadline ?? "Flexible demo deadline"}</strong>
            </span>
          </div>
          <div>
            <WIcon name="test" />
            <span>
              <small>Difficulty</small>
              <strong>{assignment.difficulty}</strong>
            </span>
          </div>
        </div>
      </section>
      <div className="assessment-detail-grid">
        <main>
          <section className="card detail-section">
            <h2>Task overview</h2>
            <p>{assignment.description}</p>
            <h3>Expected deliverables</h3>
            <ul>
              {assignment.id === "novatech-task-manager"
                ? [
                    "A usable task creation flow",
                    "Priority and completion controls",
                    "Status filtering and empty states",
                    "Readable implementation and deterministic checks",
                  ]
                : [
                    "A clear implementation matching the task brief",
                    "Thoughtful handling of edge cases",
                    "Readable code and validation evidence",
                  ].map((item) => (
                    <li key={item}>
                      <WIcon name="check" />
                      {item}
                    </li>
                  ))}
            </ul>
          </section>
          <section className="card detail-section">
            <h2>Assessment instructions</h2>
            <ul>
              <li>
                <WIcon name="info" />
                Read the requirements before starting the timed session.
              </li>
              <li>
                <WIcon name="info" />
                Save your work and review supported test results before submitting.
              </li>
              <li>
                <WIcon name="info" />
                Do not refresh to gain time; the persisted start timestamp controls the timer.
              </li>
            </ul>
            <h3>AI assistance policy</h3>
            <p>
              The built-in demo coach may help explain errors, suggest next steps, and discuss code.
              You remain responsible for reviewing and applying any suggestion. Coach activity is
              recorded locally with the session.
            </p>
          </section>
        </main>
        <aside>
          <section className="card detail-side">
            <h2>Skill focus</h2>
            <div>
              {assignment.skills.map((skill) => (
                <span key={skill}>{skill}</span>
              ))}
            </div>
          </section>
          <section className="card detail-side">
            <h2>Session status</h2>
            <StatusPill status={status} />
            <p>
              {status === "Assigned"
                ? "The timer has not started."
                : status === "In Progress"
                  ? "Your existing session and original start time will be restored."
                  : "This submission is locked and read-only."}
            </p>
            {unavailable ? (
              <div className="unavailable-note">
                <WIcon name="warning" />
                <div>
                  <strong>Demo workspace not yet available</strong>
                  <p>
                    This assignment has a complete details page, but it will not open the Team Task
                    Manager workspace.
                  </p>
                </div>
              </div>
            ) : (
              <ActionButton
                onClick={() =>
                  go(
                    status === "Submitted"
                      ? `/candidate/assessments/${assignment.id}/submission`
                      : status === "In Progress"
                        ? `/candidate/assessments/${assignment.id}/workspace`
                        : `/candidate/assessments/${assignment.id}/onboarding`,
                  )
                }
              >
                {status === "Submitted"
                  ? "View Submission"
                  : status === "In Progress"
                    ? "Resume Assessment"
                    : "Start Assessment"}
                <WIcon name="arrow" />
              </ActionButton>
            )}
          </section>
          <p className="detail-demo-copy">
            Company names, deadlines, and invitations are illustrative demo data. No actual
            partnership or hiring invitation is implied.
          </p>
        </aside>
      </div>
    </div>
  );
}

export function AssessmentOnboarding({
  assignment,
  session,
  persist,
}: {
  assignment: CandidateAssignment;
  session: AssessmentSession | null;
  persist: PersistSession;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const begin = () => {
    if (session?.assignmentId === assignment.id) {
      go(`/candidate/assessments/${assignment.id}/workspace`);
      return;
    }
    const startedAt = now();
    const event: ActivityEvent = {
      id: uid("event"),
      type: "assessment_started",
      timestamp: startedAt,
      detail: "Candidate acknowledged the rules and began the assessment.",
      provenance: "candidate_action",
    };
    const openedEvent: ActivityEvent = {
      id: uid("event"),
      type: "file_opened",
      timestamp: startedAt,
      file: "src/App.jsx",
      detail: "Opened the initial workspace file.",
      provenance: "system_generated",
    };
    const next: AssessmentSession = {
      sessionId: uid("session"),
      candidateId: "alex-morgan",
      companyId: assignment.companyId,
      assignmentId: assignment.id,
      assessmentId: "frontend-developer-coding-challenge",
      startedAt,
      durationMinutes: assignment.duration,
      currentFile: "src/App.jsx",
      files: structuredClone(starterWorkspaceFiles),
      savedFiles: structuredClone(starterWorkspaceFiles),
      unsaved: false,
      revisions: [
        {
          id: "revision-0",
          timestamp: startedAt,
          files: structuredClone(starterWorkspaceFiles),
        },
      ],
      coachMessages: [
        {
          id: uid("message"),
          role: "coach",
          timestamp: startedAt,
          content:
            "Welcome to the local demo coach. I can help you reason about the requirements, explain the active file, or diagnose supported test failures. I will never change code without your explicit action.",
          explanation:
            "This response is deterministic and generated locally from the assessment context.",
        },
      ],
      runHistory: [],
      testRuns: [],
      activity: [event, openedEvent],
    };
    if (persist(next)) go(`/candidate/assessments/${assignment.id}/workspace`);
  };
  return (
    <div className="onboarding-page">
      <button className="detail-back" onClick={() => go(`/candidate/assessments/${assignment.id}`)}>
        <WIcon name="back" />
        Back to assessment details
      </button>
      <header>
        <CompanyMark company={assignment.company} />
        <span>Before you begin</span>
        <h1>Review the task and recording disclosure.</h1>
        <p>Your 45-minute timer starts only after you acknowledge the rules and begin.</p>
      </header>
      <div className="onboarding-grid">
        <main>
          <section className="card onboarding-section">
            <span className="section-index">01</span>
            <h2>Task requirements</h2>
            <p>Build a Team Task Manager that supports the following visible behavior.</p>
            <div className="criteria-grid">
              {[
                "Add a task",
                "Set task priority",
                "Mark a task complete",
                "Filter tasks by status",
                "Display an empty state",
                "Preserve task state during interaction",
              ].map((item) => (
                <div key={item}>
                  <WIcon name="check" />
                  {item}
                </div>
              ))}
            </div>
          </section>
          <section className="card onboarding-section">
            <span className="section-index">02</span>
            <h2>Working instructions</h2>
            <ul>
              <li>Use the provided project files and read-only public demo tests.</li>
              <li>Run and save often. Test results are linked to a saved code revision.</li>
              <li>
                The preview uses a predefined task-manager adapter; arbitrary source is not
                executed.
              </li>
              <li>Review all AI coach suggestions before choosing to apply them.</li>
            </ul>
          </section>
          <section className="card onboarding-section disclosure">
            <span className="section-index">03</span>
            <h2>Local activity recording disclosure</h2>
            <p>
              This prototype records supported assessment actions locally in this browser: code
              snapshots, opened files, AI coach interactions, application runs, test runs, and
              submission events.
            </p>
            <div className="not-recorded">
              <strong>Not recorded</strong>
              <span>No webcam recording</span>
              <span>No screen recording</span>
              <span>No keystroke surveillance</span>
            </div>
            <p className="provenance-copy">
              Activity records show that an interface action occurred. They do not prove intent,
              independent understanding, or source-code authorship; provenance is marked unknown
              where it cannot be established.
            </p>
          </section>
        </main>
        <aside className="card begin-panel">
          <StatusPill status={session ? "In Progress" : "Assigned"} />
          <h2>{assignment.task}</h2>
          <div>
            <span>Company</span>
            <strong>{assignment.company}</strong>
          </div>
          <div>
            <span>Duration</span>
            <strong>{assignment.duration} minutes</strong>
          </div>
          <div>
            <span>Deadline</span>
            <strong>{assignment.deadline}</strong>
          </div>
          <label className="acknowledge-control">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />
            <span>
              I understand the rules, AI policy, timer, and local activity-recording disclosure.
            </span>
          </label>
          <ActionButton disabled={!acknowledged} onClick={begin}>
            {session ? "Acknowledge and Resume" : "Acknowledge and Begin Assessment"}
            <WIcon name="arrow" />
          </ActionButton>
          <small>The original start time is preserved when resuming.</small>
        </aside>
      </div>
    </div>
  );
}

export function analyzeTests(files: WorkspaceFile[]): TestResult[] {
  const utils = files.find((file) => file.path === "src/taskUtils.js")?.content ?? "";
  const app = files.find((file) => file.path === "src/App.jsx")?.content ?? "";
  const checks = [
    [
      "add",
      "Adding a task",
      /function\s+addTask[\s\S]*cleanTitle[\s\S]*return\s*\[/,
      "addTask should trim input and return a new task array.",
      "Add a task",
    ],
    [
      "empty",
      "Handling empty task titles",
      /if\s*\(\s*!cleanTitle\s*\)\s*return\s+tasks/,
      "Return the original collection when the trimmed title is empty.",
      "Preserve task state during interaction",
    ],
    [
      "complete",
      "Marking a task complete",
      /completed:\s*!task\.completed/,
      "toggleTask should invert the matching task's completed value.",
      "Mark a task complete",
    ],
    [
      "priority",
      "Preserving task priority",
      /priority,\s*\n?\s*completed:\s*false/,
      "New task records should preserve the selected priority.",
      "Set task priority",
    ],
    [
      "filter",
      "Filtering tasks by status",
      /(filter\s*===\s*["']active["']|case\s+["']active["'])[\s\S]*(filter\s*===\s*["']completed["']|case\s+["']completed["'])/,
      "Support both active and completed filtering in filterTasks.",
      "Filter tasks by status",
    ],
    [
      "empty-state",
      "Showing an empty state",
      /(visibleTasks\.length\s*===\s*0|!visibleTasks\.length|empty-state)/,
      "Render a clear empty state when no tasks match the selected filter.",
      "Display an empty state",
    ],
  ] as const;
  return checks.map(([id, name, pattern, diagnostic, criterion]) => ({
    id,
    name,
    status: pattern.test(id === "empty-state" ? app : utils) ? "passed" : "failed",
    diagnostic: pattern.test(id === "empty-state" ? app : utils)
      ? "Supported source pattern detected by the deterministic demo analyzer."
      : diagnostic,
    criterion,
  }));
}

export function coachResponse(
  action: string,
  prompt: string,
  session: AssessmentSession,
): CoachMessage {
  const latestFailed = session.testRuns
    .at(-1)
    ?.results.find((result) => result.status === "failed");
  const active = session.files.find((file) => file.path === session.currentFile);
  let content = "";
  let explanation = "";
  let suggestion: CoachMessage["suggestion"];
  if (action === "hint") {
    content = latestFailed
      ? `Start with “${latestFailed.name}.” ${latestFailed.diagnostic} Make the smallest change, then save and rerun the supported checks.`
      : "Start by connecting one acceptance criterion to one small function. Save the revision, run the public checks, and use the first concrete failure to guide the next change.";
    explanation =
      "I reviewed the latest deterministic test result and selected the first actionable gap.";
  } else if (action === "explain") {
    content = `${active?.path ?? "The active file"} currently contains ${active?.content.split("\n").length ?? 0} lines. The starter separates UI state in App.jsx from task transformations in taskUtils.js, which makes the supported behaviors easier to test independently.`;
    explanation =
      "I used the active filename, source length, and starter-project architecture. No hidden reasoning or remote model was used.";
  } else if (action === "debug") {
    content = latestFailed
      ? `The latest failure is “${latestFailed.name}.” The runner reports: ${latestFailed.diagnostic}`
      : "There is no failed supported check yet. Run Tests first so I can respond to a concrete diagnostic.";
    explanation = "I inspected the most recent locally stored test result.";
    if (latestFailed?.id === "filter")
      suggestion = {
        file: "src/taskUtils.js",
        label: "Insert filter implementation",
        content: `export function filterTasks(tasks, filter) {
  if (filter === "active") {
    return tasks.filter((task) => !task.completed);
  }
  if (filter === "completed") {
    return tasks.filter((task) => task.completed);
  }
  return tasks;
}`,
      };
  } else {
    const lower = prompt.toLowerCase();
    if (lower.includes("filter")) {
      content =
        "Keep filtering as a pure transformation: return active tasks when the filter is active, completed tasks when it is completed, and the original collection for all. Then run the deterministic checks.";
      suggestion = {
        file: "src/taskUtils.js",
        label: "Insert filter implementation",
        content: `export function filterTasks(tasks, filter) {
  if (filter === "active") return tasks.filter((task) => !task.completed);
  if (filter === "completed") return tasks.filter((task) => task.completed);
  return tasks;
}`,
      };
    } else if (lower.includes("empty"))
      content =
        "Treat an empty task list and an empty filtered result as valid UI states. Render a short message where the list would normally appear, rather than treating it as an execution error.";
    else if (lower.includes("test"))
      content = latestFailed
        ? `Your latest supported failure is “${latestFailed.name}.” ${latestFailed.diagnostic}`
        : "Run Tests to create a revision-linked result. I can then help interpret the first supported failure.";
    else
      content =
        "Break the request into one acceptance criterion at a time. Tell me which file or failing behavior you want to inspect, or use Hint, Explain Code, or Debug Error.";
    explanation =
      "This deterministic response uses keywords from your prompt, the active file, and the most recent supported test result.";
  }
  return {
    id: uid("message"),
    role: "coach",
    content: `${content} (Demo coach response)`,
    timestamp: now(),
    explanation,
    suggestion,
  };
}

export function buildCoachContext(session: AssessmentSession): AiCoachContext {
  return {
    currentFile: session.currentFile,
    files: session.files.map((file) => ({ path: file.path, content: file.content })),
    testResults: session.testRuns.at(-1)?.results.map((result) => ({
      id: result.id,
      name: result.name,
      status: result.status,
      diagnostic: result.diagnostic,
      criterion: result.criterion,
    })),
  };
}

type PreviewTask = {
  id: number;
  title: string;
  priority: string;
  completed: boolean;
};

export function LivePreview({
  runKey,
  running,
  onRun,
}: {
  runKey: number;
  running: boolean;
  onRun: () => void;
}) {
  const [tasks, setTasks] = useState<PreviewTask[]>([
    {
      id: 1,
      title: "Review acceptance criteria",
      priority: "high",
      completed: true,
    },
    {
      id: 2,
      title: "Implement status filters",
      priority: "medium",
      completed: false,
    },
  ]);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [filter, setFilter] = useState("all");
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  useEffect(() => {
    setFilter("all");
  }, [runKey]);
  const visible = tasks.filter(
    (task) => filter === "all" || (filter === "completed" ? task.completed : !task.completed),
  );
  const add = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setTasks([...tasks, { id: Date.now(), title: title.trim(), priority, completed: false }]);
    setTitle("");
  };
  return (
    <section className="preview-panel">
      <header>
        <div>
          <WIcon name="eye" />
          <strong>Preview</strong>
          <span>Demo adapter</span>
        </div>
        <div>
          <button
            className={viewport === "desktop" ? "active" : ""}
            onClick={() => setViewport("desktop")}
            title="Desktop viewport"
          >
            D
          </button>
          <button
            className={viewport === "mobile" ? "active" : ""}
            onClick={() => setViewport("mobile")}
            title="Mobile viewport"
          >
            M
          </button>
          <button onClick={onRun} disabled={running} title="Run and refresh preview">
            <WIcon name="refresh" size={13} />
          </button>
        </div>
      </header>
      <div className={`preview-canvas ${viewport}`}>
        {running ? (
          <div className="preview-running">
            <i></i>
            <span>Refreshing supported preview…</span>
          </div>
        ) : (
          <div className="task-preview-app">
            <div className="preview-app-head">
              <div>
                <span>Nova team</span>
                <h2>Task manager</h2>
              </div>
              <span>{tasks.filter((task) => !task.completed).length} open</span>
            </div>
            <form onSubmit={add}>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Add a team task…"
                aria-label="Task title"
              />
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
                aria-label="Task priority"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <button type="submit">
                <WIcon name="plus" />
              </button>
            </form>
            <div className="preview-filters">
              {["all", "active", "completed"].map((item) => (
                <button
                  className={filter === item ? "active" : ""}
                  onClick={() => setFilter(item)}
                  key={item}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="preview-task-list">
              {visible.length ? (
                visible.map((task) => (
                  <label key={task.id}>
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() =>
                        setTasks(
                          tasks.map((item) =>
                            item.id === task.id ? { ...item, completed: !item.completed } : item,
                          ),
                        )
                      }
                    />
                    <span className={task.completed ? "done" : ""}>{task.title}</span>
                    <i className={task.priority}>{task.priority}</i>
                  </label>
                ))
              ) : (
                <div className="preview-empty">
                  <WIcon name="check" />
                  <strong>Nothing here</strong>
                  <span>No tasks match this filter.</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <footer>
        <WIcon name="info" />
        <span>Interactive predefined adapter. Edited JavaScript is not executed.</span>
      </footer>
    </section>
  );
}

export function Timer({
  session,
  onExpire,
}: {
  session: AssessmentSession;
  onExpire?: () => void;
}) {
  const [tick, setTick] = useState(Date.now());
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setTick(Date.now());
      const end = new Date(session.startedAt).getTime() + session.durationMinutes * 60_000;
      if (Date.now() >= end) {
        setExpired(true);
        onExpire?.();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [session.startedAt, session.durationMinutes, onExpire]);
  const end = new Date(session.startedAt).getTime() + session.durationMinutes * 60_000;
  const remaining = Math.max(0, end - tick);
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  if (expired || remaining <= 0) {
    return (
      <span className="workspace-timer expired">
        <WIcon name="timer" />
        Time Expired
      </span>
    );
  }
  return (
    <span className={`workspace-timer ${remaining < 5 * 60_000 ? "low" : ""}`}>
      <WIcon name="timer" />
      {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
    </span>
  );
}

function Editor({ session, update }: { session: AssessmentSession; update: UpdateSession }) {
  const active =
    session.files.find((file) => file.path === session.currentFile) ?? session.files[0];
  const openFile = (path: string) => {
    if (path === session.currentFile) return;
    update({
      ...session,
      currentFile: path,
      activity: [
        ...session.activity,
        {
          id: uid("event"),
          type: "file_opened",
          timestamp: now(),
          file: path,
          detail: `Opened ${path}.`,
          provenance: "candidate_action",
        },
      ],
    });
  };
  const change = (content: string) => {
    if (session.submittedAt || active.readOnly) return;
    const event = session.unsaved
      ? []
      : [
          {
            id: uid("event"),
            type: "code_changed" as const,
            timestamp: now(),
            file: active.path,
            detail: `Changed ${active.path}; content provenance is unknown.`,
            provenance: "unknown" as const,
          },
        ];
    update({
      ...session,
      unsaved: true,
      files: session.files.map((file) => (file.path === active.path ? { ...file, content } : file)),
      activity: [...session.activity, ...event],
    });
  };
  const lines = active.content.split("\n");
  return (
    <section className="editor-panel">
      <div className="file-tabs">
        {session.files.map((file) => (
          <button
            className={file.path === active.path ? "active" : ""}
            onClick={() => openFile(file.path)}
            key={file.path}
          >
            <WIcon name="file" />
            {file.path.split("/").at(-1)}
            {file.path === active.path && session.unsaved && !file.readOnly && <i></i>}
          </button>
        ))}
      </div>
      <div className="editor-toolbar">
        <span>{active.path}</span>
        <div>
          {active.readOnly && <span className="readonly-label">Read only</span>}
          <span>{active.language}</span>
        </div>
      </div>
      <div className="editor-surface">
        <pre aria-hidden="true">
          {lines.map((_, index) => (
            <span key={index}>{index + 1}</span>
          ))}
        </pre>
        <textarea
          aria-label={`Editing ${active.path}`}
          value={active.content}
          onChange={(event) => change(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Tab" || active.readOnly || session.submittedAt) return;
            event.preventDefault();
            const target = event.currentTarget;
            const start = target.selectionStart;
            const end = target.selectionEnd;
            change(`${active.content.slice(0, start)}  ${active.content.slice(end)}`);
            window.requestAnimationFrame(() => target.setSelectionRange(start + 2, start + 2));
          }}
          readOnly={active.readOnly || !!session.submittedAt}
          spellCheck={false}
        />
      </div>
    </section>
  );
}

export function CoachPanel({
  session,
  update,
  onClose,
}: {
  session: AssessmentSession;
  update: UpdateSession;
  onClose?: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [processing, setProcessing] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const runCoach = async (action: string, text = prompt) => {
    if (!text.trim() && action === "prompt") return;
    const candidateMessage: CoachMessage = {
      id: uid("message"),
      role: "candidate",
      content:
        action === "prompt"
          ? text.trim()
          : action === "hint"
            ? "Give me a focused hint."
            : action === "explain"
              ? "Explain the active code."
              : "Help me debug the latest error.",
      timestamp: now(),
    };
    const prompted: ActivityEvent = {
      id: uid("event"),
      type: "ai_coach_prompted",
      timestamp: now(),
      file: session.currentFile,
      detail: `Requested coach action: ${action}.`,
      provenance: "candidate_action",
    };
    const interim = {
      ...session,
      coachMessages: [...session.coachMessages, candidateMessage],
      activity: [...session.activity, prompted],
    };
    update(interim);
    setPrompt("");
    setProcessing(
      action === "debug"
        ? "Reviewing the latest test failure."
        : action === "explain"
          ? "Reviewing the active file."
          : "Reviewing task context.",
    );
    const context = buildCoachContext(session);
    let response: CoachMessage;
    try {
      const { data } = await aiCoachApi.prompt(session.sessionId, {
        action,
        prompt: action === "prompt" ? text.trim() : undefined,
        context,
      });
      response = {
        id: data.id,
        role: "coach",
        content: data.content,
        timestamp: data.createdAt,
        explanation: data.explanation ?? undefined,
        suggestion: data.suggestion ?? undefined,
      };
    } catch {
      response = coachResponse(action, text, session);
    }
    update((latest) => {
      const responded: ActivityEvent = {
        id: uid("event"),
        type: "ai_coach_responded",
        timestamp: response.timestamp,
        file: latest.currentFile,
        detail: "Deterministic coach responded.",
        provenance: "system_generated",
      };
      return {
        ...latest,
        coachMessages: [...latest.coachMessages, response],
        activity: [...latest.activity, responded],
      };
    });
    setProcessing("");
  };
  const apply = (message: CoachMessage) => {
    if (!message.suggestion || session.submittedAt) return;
    update({
      ...session,
      currentFile: message.suggestion.file,
      unsaved: true,
      files: session.files.map((file) =>
        file.path === message.suggestion?.file
          ? {
              ...file,
              content: file.content.replace(
                /export function filterTasks[\s\S]*$/,
                message.suggestion.content,
              ),
            }
          : file,
      ),
      activity: [
        ...session.activity,
        {
          id: uid("event"),
          type: "code_changed",
          timestamp: now(),
          file: message.suggestion.file,
          detail: `Candidate explicitly applied demo coach suggestion: ${message.suggestion.label}.`,
          provenance: "candidate_action",
        },
      ],
    });
  };
  const criteria = [
    "Add a task",
    "Set task priority",
    "Mark a task complete",
    "Filter tasks by status",
    "Display an empty state",
    "Preserve task state during interaction",
  ];
  const passed = new Set(
    session.testRuns
      .at(-1)
      ?.results.filter((result) => result.status === "passed")
      .map((result) => result.criterion) ?? [],
  );
  if (collapsed)
    return (
      <aside className="coach-panel collapsed">
        <button
          onClick={() => {
            update((latest) => ({
              ...latest,
              activity: [
                ...latest.activity,
                {
                  id: uid("event"),
                  type: "panel_opened" as const,
                  timestamp: now(),
                  detail: "Opened AI Coach panel.",
                  provenance: "candidate_action",
                },
              ],
            }));
            setCollapsed(false);
          }}
          title="Open AI Coach"
        >
          <WIcon name="ai" />
          <span>AI Coach</span>
          <WIcon name="chevron" />
        </button>
      </aside>
    );
  return (
    <aside className="coach-panel">
      <header>
        <div>
          <span>
            <WIcon name="ai" />
          </span>
          <div>
            <strong>AI Coach</strong>
            <small>
              <i></i>Deterministic · Connected
            </small>
          </div>
        </div>
        <button
          onClick={() => {
            update((latest) => ({
              ...latest,
              activity: [
                ...latest.activity,
                {
                  id: uid("event"),
                  type: "panel_closed" as const,
                  timestamp: now(),
                  detail: "Closed AI Coach panel.",
                  provenance: "candidate_action",
                },
              ],
            }));
            onClose ? onClose() : setCollapsed(true);
          }}
          title="Close AI Coach"
        >
          <WIcon name="x" />
        </button>
      </header>
      <div className="coach-checklist">
        <div>
          <strong>Acceptance criteria</strong>
          <span>{passed.size}/6 supported</span>
        </div>
        {criteria.map((item) => (
          <div className={passed.has(item) ? "verified" : ""} key={item}>
            <span>{passed.has(item) ? <WIcon name="check" /> : ""}</span>
            <p>{item}</p>
            <small>{passed.has(item) ? "Test-supported" : "Pending"}</small>
          </div>
        ))}
      </div>
      <div className="coach-messages">
        {session.coachMessages.map((message) => (
          <article className={message.role} key={message.id}>
            <div>
              <strong>{message.role === "coach" ? "Coach" : "You"}</strong>
              <small>
                {new Date(message.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </small>
            </div>
            <p>{message.content}</p>
            {message.explanation && (
              <>
                <button
                  className="explanation-toggle"
                  onClick={() =>
                    setExpanded(
                      expanded.includes(message.id)
                        ? expanded.filter((id) => id !== message.id)
                        : [...expanded, message.id],
                    )
                  }
                >
                  <WIcon name="chevron" />
                  Diagnostic approach
                </button>
                {expanded.includes(message.id) && (
                  <div className="coach-explanation">{message.explanation}</div>
                )}
              </>
            )}
            {message.suggestion && (
              <div className="coach-suggestion">
                <span>Suggested change · {message.suggestion.file}</span>
                <code>{message.suggestion.content.slice(0, 105)}…</code>
                <button onClick={() => apply(message)} disabled={!!session.submittedAt}>
                  Review and apply
                </button>
              </div>
            )}
          </article>
        ))}
        {processing && (
          <div className="coach-processing">
            <i></i>
            <span>
              <strong>AI Coach is working</strong>
              <small>{processing}</small>
            </span>
          </div>
        )}
      </div>
      <div className="coach-compose">
        <div className="coach-quick">
          <button onClick={() => runCoach("hint")}>Hint</button>
          <button onClick={() => runCoach("explain")}>Explain Code</button>
          <button onClick={() => runCoach("debug")}>Debug Error</button>
        </div>
        <div>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ask about the task or active file…"
            aria-label="Message AI Coach"
            disabled={!!session.submittedAt}
          />
          <button
            onClick={() => runCoach("prompt")}
            disabled={!prompt.trim() || !!processing || !!session.submittedAt}
            title="Send message"
          >
            <WIcon name="send" />
          </button>
        </div>
        <small>Deterministic coach served by the API. No external model configured.</small>
      </div>
    </aside>
  );
}

function ExecutionPanel({
  session,
  active,
  setActive,
  collapsed,
  setCollapsed,
  runTests,
}: {
  session: AssessmentSession;
  active: string;
  setActive: (tab: string) => void;
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  runTests: () => void;
}) {
  const latestTests = session.testRuns.at(-1);
  const latestRun = session.runHistory.at(-1);
  const problems = latestTests?.results.filter((result) => result.status === "failed") ?? [];
  const tabs = [
    ["output", "Application Output", latestRun ? 1 : 0],
    ["problems", "Problems", problems.length],
    ["tests", "Test Results", latestTests?.results.length ?? 0],
    ["activity", "Activity Log", session.activity.length],
  ] as const;
  return (
    <section className={`execution-panel ${collapsed ? "collapsed" : ""}`}>
      <header>
        <nav>
          {tabs.map(([id, label, count]) => (
            <button
              className={active === id ? "active" : ""}
              onClick={() => {
                setActive(id);
                setCollapsed(false);
              }}
              key={id}
            >
              {label}
              {count > 0 && <span>{count}</span>}
            </button>
          ))}
        </nav>
        <div>
          <button onClick={runTests}>
            <WIcon name="test" />
            Run Tests
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand panel" : "Collapse panel"}
          >
            <WIcon name="chevron" />
          </button>
        </div>
      </header>
      {!collapsed && (
        <div className="execution-content">
          {active === "output" &&
            (latestRun ? (
              <div className={`output-line ${latestRun.status}`}>
                <span>{new Date(latestRun.timestamp).toLocaleTimeString()}</span>
                <WIcon name={latestRun.status === "success" ? "check" : "warning"} />
                <p>
                  <strong>
                    {latestRun.status === "success"
                      ? "Application preview refreshed"
                      : "Application run failed"}
                  </strong>
                  {latestRun.message}
                </p>
                <code>{latestRun.revisionId}</code>
              </div>
            ) : (
              <div className="execution-empty">
                Run the supported application preview to see output.
              </div>
            ))}
          {active === "problems" &&
            (problems.length ? (
              problems.map((result) => (
                <div className="problem-line" key={result.id}>
                  <WIcon name="warning" />
                  <p>
                    <strong>{result.name}</strong>
                    {result.diagnostic}
                  </p>
                  <span>source analyzer</span>
                </div>
              ))
            ) : (
              <div className="execution-empty">
                No supported diagnostics. Run tests to analyze the current saved revision.
              </div>
            ))}
          {active === "tests" &&
            (latestTests ? (
              <div className="test-results">
                <div className="test-summary">
                  <span className="passed">
                    {latestTests.results.filter((r) => r.status === "passed").length} passed
                  </span>
                  <span className="failed">
                    {latestTests.results.filter((r) => r.status === "failed").length} failed
                  </span>
                  <span>Revision {latestTests.revisionId}</span>
                  <span>{new Date(latestTests.timestamp).toLocaleTimeString()}</span>
                </div>
                {latestTests.results.map((result) => (
                  <div className={result.status} key={result.id}>
                    <WIcon name={result.status === "passed" ? "check" : "x"} />
                    <p>
                      <strong>{result.name}</strong>
                      <small>{result.diagnostic}</small>
                    </p>
                    <span>{result.status}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="execution-empty">
                No test run yet. Tests use a deterministic source analyzer, not arbitrary code
                execution.
              </div>
            ))}
          {active === "activity" && (
            <div className="activity-console">
              {[...session.activity].reverse().map((event) => (
                <div key={event.id}>
                  <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
                  <code>{event.type}</code>
                  <p>{event.detail}</p>
                  <small>{event.provenance.replace("_", " ")}</small>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export function CodingWorkspace({
  session,
  persist,
}: {
  session: AssessmentSession;
  persist: PersistSession;
}) {
  const [current, setCurrent] = useState(session);
  const [running, setRunning] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const [executionTab, setExecutionTab] = useState("output");
  const [executionCollapsed, setExecutionCollapsed] = useState(true);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [timerExpired, setTimerExpired] = useState(false);
  const currentRef = useRef(session);
  useEffect(() => {
    currentRef.current = session;
    setCurrent(session);
  }, [session]);
  const update: UpdateSession = (next) => {
    const resolved = typeof next === "function" ? next(currentRef.current) : next;
    currentRef.current = resolved;
    setCurrent(resolved);
    persist(resolved);
  };
  const save = (source = current) => {
    if (source.submittedAt || !source.unsaved) return source;
    const revisionId = `revision-${source.revisions.length}`;
    const timestamp = now();
    const next = {
      ...source,
      unsaved: false,
      savedFiles: structuredClone(source.files),
      revisions: [
        ...source.revisions,
        { id: revisionId, timestamp, files: structuredClone(source.files) },
      ],
      activity: [
        ...source.activity,
        {
          id: uid("event"),
          type: "workspace_saved" as const,
          timestamp,
          file: source.currentFile,
          revisionId,
          detail: `Saved workspace as ${revisionId}.`,
          provenance: "candidate_action" as const,
        },
      ],
    };
    update(next);
    return next;
  };
  const ensureRevision = () => (current.unsaved ? save() : current);
  const run = () => {
    const saved = ensureRevision();
    setRunning(true);
    window.setTimeout(() => {
      const revisionId = saved.revisions.at(-1)?.id ?? "revision-0";
      const timestamp = now();
      const record = {
        id: uid("run"),
        timestamp,
        revisionId,
        status: "success" as const,
        message:
          "Supported preview adapter refreshed successfully. Arbitrary source was not executed.",
      };
      const next = {
        ...saved,
        runHistory: [...saved.runHistory, record],
        activity: [
          ...saved.activity,
          {
            id: uid("event"),
            type: "application_run" as const,
            timestamp,
            revisionId,
            resultId: record.id,
            detail: "Ran the supported Team Task Manager preview adapter.",
            provenance: "candidate_action" as const,
          },
        ],
      };
      update(next);
      setRunKey((key) => key + 1);
      setRunning(false);
      setExecutionTab("output");
      setExecutionCollapsed(false);
    }, 500);
  };
  const runTests = () => {
    const saved = ensureRevision();
    const revisionId = saved.revisions.at(-1)?.id ?? "revision-0";
    const timestamp = now();
    const results = analyzeTests(saved.savedFiles);
    const record = { id: uid("tests"), timestamp, revisionId, results };
    const next = {
      ...saved,
      testRuns: [...saved.testRuns, record],
      activity: [
        ...saved.activity,
        {
          id: uid("event"),
          type: "test_run" as const,
          timestamp,
          revisionId,
          resultId: record.id,
          detail: `Ran 6 supported checks: ${results.filter((r) => r.status === "passed").length} passed, ${results.filter((r) => r.status === "failed").length} failed.`,
          provenance: "candidate_action" as const,
        },
      ],
    };
    update(next);
    setExecutionTab("tests");
    setExecutionCollapsed(false);
  };
  const reset = () => {
    const timestamp = now();
    update({
      ...current,
      files: structuredClone(starterWorkspaceFiles),
      currentFile: "src/App.jsx",
      unsaved: true,
      activity: [
        ...current.activity,
        {
          id: uid("event"),
          type: "code_changed",
          timestamp,
          file: "all files",
          detail: "Candidate confirmed reset to starter code; content provenance is unknown.",
          provenance: "candidate_action",
        },
      ],
    });
    setResetOpen(false);
  };
  const submit = () => {
    if (timerExpired) {
      setSubmitError("Time has expired. You can no longer submit this assessment.");
      return;
    }
    const saved = current.unsaved ? save() : current;
    const timestamp = now();
    const revisionId = saved.revisions.at(-1)?.id ?? "revision-0";
    const next: AssessmentSession = {
      ...saved,
      submittedAt: timestamp,
      unsaved: false,
      files: structuredClone(saved.savedFiles),
      activity: [
        ...saved.activity,
        {
          id: uid("event"),
          type: "assessment_submitted",
          timestamp,
          revisionId,
          detail: "Candidate explicitly confirmed final assessment submission.",
          provenance: "candidate_action",
        },
      ],
    };
    if (!persist(next)) {
      setSubmitError(
        "The browser could not save your submission. Check storage availability and try again.",
      );
      return;
    }
    setCurrent(next);
    go("/candidate/assessments/novatech-task-manager/submission");
  };
  const latestTest = current.testRuns.at(-1);
  return (
    <div className="coding-workspace">
      <header className="workspace-header">
        <button className="workspace-brand" onClick={() => go("/candidate/dashboard")}>
          <span>&lt;/&gt;</span>
          <strong>
            DevForge<span>.ai</span>
          </strong>
        </button>
        <div className="workspace-context">
          <span>NovaTech Solutions</span>
          <strong>Frontend Developer Coding Challenge</strong>
        </div>
        <StatusPill status={current.submittedAt ? "Submitted" : "In Progress"} />
        <div className="workspace-header-actions">
          <Timer session={current} onExpire={() => setTimerExpired(true)} />
          <span className={`save-state ${current.unsaved ? "unsaved" : ""}`}>
            <i></i>
            {current.unsaved ? "Unsaved changes" : `Saved · ${current.revisions.at(-1)?.id}`}
          </span>
          <button onClick={() => save()} disabled={!current.unsaved || !!current.submittedAt}>
            <WIcon name="save" />
            Save
          </button>
          <button className="run-button" onClick={run} disabled={running || !!current.submittedAt}>
            <WIcon name={running ? "stop" : "play"} />
            {running ? "Running" : "Run"}
          </button>
          <button
            className="submit-button"
            onClick={() => setSubmitOpen(true)}
            disabled={!!current.submittedAt || timerExpired}
          >
            {timerExpired ? "Time Expired" : "Submit Assessment"}
          </button>
          <button
            className="exit-button"
            onClick={() => go("/candidate/assessments/novatech-task-manager")}
            title="Exit workspace"
          >
            <WIcon name="x" />
          </button>
        </div>
      </header>
      <div className="workspace-main">
        <CoachPanel session={current} update={update} />
        <div className="build-region">
          <div className="work-split">
            <div className="editor-stack">
              <Editor session={current} update={update} />
              <div className="editor-status">
                <span>
                  <i></i>JavaScript
                </span>
                <span>
                  Ln{" "}
                  {current.files.find((f) => f.path === current.currentFile)?.content.split("\n")
                    .length ?? 1}
                  , Col 1
                </span>
                <button onClick={() => setResetOpen(true)} disabled={!!current.submittedAt}>
                  <WIcon name="refresh" />
                  Reset starter
                </button>
              </div>
            </div>
            <LivePreview runKey={runKey} running={running} onRun={run} />
          </div>
          <ExecutionPanel
            session={current}
            active={executionTab}
            setActive={setExecutionTab}
            collapsed={executionCollapsed}
            setCollapsed={setExecutionCollapsed}
            runTests={runTests}
          />
        </div>
      </div>
      {submitOpen && (
        <div className="workspace-modal-backdrop" role="presentation">
          <div
            className="workspace-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="submit-title"
          >
            <button className="modal-close" onClick={() => setSubmitOpen(false)}>
              <WIcon name="x" />
            </button>
            <span className="modal-icon">
              <WIcon name="send" />
            </span>
            <h2 id="submit-title">Submit your assessment?</h2>
            <p>
              This saves the final supported project snapshot and permanently locks this demo
              session.
            </p>
            <div className="submission-review">
              <div>
                <span>Save status</span>
                <strong className={current.unsaved ? "warning" : ""}>
                  {current.unsaved ? "Unsaved changes will be saved" : "All changes saved"}
                </strong>
              </div>
              <div>
                <span>Latest application run</span>
                <strong>{current.runHistory.at(-1)?.status ?? "Not run"}</strong>
              </div>
              <div>
                <span>Latest supported tests</span>
                <strong>
                  {latestTest
                    ? `${latestTest.results.filter((r) => r.status === "passed").length}/6 passed · ${latestTest.revisionId}`
                    : "Not run"}
                </strong>
              </div>
            </div>
            {submitError && (
              <div className="modal-error">
                <WIcon name="warning" />
                {submitError}
              </div>
            )}
            <label className="submit-confirm">
              <input type="checkbox" id="submit-confirm-check" />
              <span>I understand that I cannot edit this submitted version.</span>
            </label>
            <div className="modal-actions">
              <ActionButton secondary onClick={() => setSubmitOpen(false)}>
                Keep working
              </ActionButton>
              <button
                className="as-button"
                onClick={() => {
                  const checkbox = document.getElementById(
                    "submit-confirm-check",
                  ) as HTMLInputElement | null;
                  if (checkbox?.checked) submit();
                  else setSubmitError("Confirm that you understand the submission will be locked.");
                }}
              >
                Confirm and Submit
              </button>
            </div>
          </div>
        </div>
      )}
      {resetOpen && (
        <div className="workspace-modal-backdrop">
          <div className="workspace-modal small" role="dialog" aria-modal="true">
            <span className="modal-icon warning">
              <WIcon name="warning" />
            </span>
            <h2>Reset all starter files?</h2>
            <p>
              This replaces editable files with the original starter code. The reset is recorded as
              an activity event.
            </p>
            <div className="modal-actions">
              <ActionButton secondary onClick={() => setResetOpen(false)}>
                Cancel
              </ActionButton>
              <button className="as-button danger" onClick={reset}>
                Reset files
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function SubmissionConfirmation({ session }: { session: AssessmentSession }) {
  const latest = session.testRuns.at(-1);
  return (
    <div className="submission-page">
      <div className="submission-card">
        <span className="submission-check">
          <WIcon name="check" size={28} />
        </span>
        <span className="submission-eyebrow">Assessment submitted</span>
        <h1>Your work has been saved.</h1>
        <p>
          The supported project snapshot is locked. No skill score or hiring decision is generated
          in Phase 2.
        </p>
        <div className="submission-company">
          <CompanyMark company="NovaTech Solutions" />
          <div>
            <span>NovaTech Solutions</span>
            <strong>Build a Team Task Manager</strong>
          </div>
        </div>
        <div className="submission-facts">
          <div>
            <span>Submitted</span>
            <strong>
              {session.submittedAt
                ? new Date(session.submittedAt).toLocaleString()
                : "Not submitted"}
            </strong>
          </div>
          <div>
            <span>Final revision</span>
            <strong>{session.revisions.at(-1)?.id}</strong>
          </div>
          <div>
            <span>Supported checks</span>
            <strong>
              {latest
                ? `${latest.results.filter((r) => r.status === "passed").length}/6 passed`
                : "Not run"}
            </strong>
          </div>
        </div>
        <div className="submission-notice">
          <WIcon name="info" />
          <span>
            Tests use a deterministic source analyzer and preview adapter. Results are demo
            evidence, not a verified skill evaluation.
          </span>
        </div>
        <div className="submission-actions">
          <ActionButton secondary onClick={() => go("/candidate/dashboard")}>
            Return to Dashboard
          </ActionButton>
          <ActionButton onClick={() => go("/candidate/history")}>
            View in Assessment History
            <WIcon name="arrow" />
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

export function getAssignment(id: string) {
  return candidateAssignments.find((assignment) => assignment.id === id);
}
