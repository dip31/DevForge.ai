import { ReactNode, useMemo, useState, useEffect } from "react";
import { AssessmentSession, CandidateAssignment } from "./data";
import {
  CriterionFinding,
  effectiveCriterionStatus,
  EvaluationRecord,
  EvaluationStatus,
  EvidenceRecord,
  EvidenceType,
  ReviewEvent,
} from "./evidence";
import { assignmentsApi } from "./lib/api-endpoints";
import "./evaluation.css";

type PersistEvaluation = (evaluation: EvaluationRecord) => boolean;

function go(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0 });
}

function EIcon({
  name,
  size = 18,
}: {
  name:
    | "arrow"
    | "check"
    | "clock"
    | "code"
    | "evidence"
    | "filter"
    | "info"
    | "report"
    | "search"
    | "shield"
    | "test"
    | "user"
    | "warning";
  size?: number;
}) {
  const paths: Record<string, ReactNode> = {
    arrow: (
      <>
        <path d="M5 12h14M14 7l5 5-5 5" />
      </>
    ),
    check: <path d="M5 12l4 4L19 6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    code: (
      <>
        <path d="M9 18l-6-6 6-6M15 6l6 6-6 6" />
      </>
    ),
    evidence: (
      <>
        <path d="M5 3h14v18H5zM8 8h8M8 12h8M8 16h5" />
      </>
    ),
    filter: <path d="M4 6h16M7 12h10M10 18h4" />,
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 8h.01" />
      </>
    ),
    report: (
      <>
        <path d="M5 3h14v18H5zM9 16v-3M12 16V8M15 16v-5" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-4-4" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-3 8-10V5l-8-3-8 3v7c0 7 8 10 8 10z" />
        <path d="M9 12l2 2 4-5" />
      </>
    ),
    test: (
      <>
        <path d="M9 3v5l-5 9a3 3 0 003 4h10a3 3 0 003-4l-5-9V3M7 14h10" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0116 0" />
      </>
    ),
    warning: (
      <>
        <path d="M12 3L2 21h20z" />
        <path d="M12 9v5M12 17h.01" />
      </>
    ),
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

const statusClass = (status: string) => status.toLowerCase().replace(/ /g, "-");

function EvalStatus({ status }: { status: string }) {
  const descriptions: Record<string, string> = {
    Demonstrated: "Available evidence supports the configured rubric requirement.",
    "Partially Demonstrated":
      "Available evidence supports part, but not all, of the configured rubric.",
    "Not Demonstrated in Available Evidence":
      "The available evidence does not demonstrate the criterion; this is not proof the candidate lacks the skill.",
    Inconclusive:
      "The available evidence is insufficient or unclear, so no supported conclusion is available.",
    "Invalid Assessment Evidence":
      "Evidence integrity or revision alignment prevents this evidence from supporting a conclusion.",
    Reviewed: "A human reviewer has recorded an assessment outcome.",
  };
  return (
    <span className={`eval-status ${statusClass(status)}`} title={descriptions[status] ?? status}>
      <i></i>
      {status}
    </span>
  );
}

function EmptyEvaluation({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="eval-empty card">
      <span>
        <EIcon name="evidence" />
      </span>
      <h2>{title}</h2>
      <p>{copy}</p>
    </div>
  );
}

function FindingCard({
  criterion,
  evaluation,
  onReview,
}: {
  criterion: CriterionFinding;
  evaluation: EvaluationRecord;
  onReview: (criterion: CriterionFinding) => void;
}) {
  const effective = effectiveCriterionStatus(evaluation, criterion.id) ?? criterion.status;
  const overridden = effective !== criterion.status;
  return (
    <article className="criterion-card card" id={`criterion-${criterion.id}`}>
      <div className="criterion-top">
        <div>
          <span>{criterion.weight}% rubric weight</span>
          <h3>{criterion.name}</h3>
        </div>
        <EvalStatus status={effective} />
      </div>
      {overridden && (
        <div className="review-override">
          <EIcon name="user" />
          Reviewer override · Original finding remains {criterion.status}
        </div>
      )}
      <p>{criterion.explanation}</p>
      <div className="criterion-rubric">
        <strong>Rule-based rubric</strong>
        <span>{criterion.rubric}</span>
      </div>
      <div className="criterion-meta">
        <span>
          <small>Evidence sufficiency</small>
          <strong>{criterion.sufficiency}</strong>
        </span>
        <span>
          <small>Supported score</small>
          <strong>
            {criterion.supportedScore === undefined
              ? "Excluded"
              : `${criterion.supportedScore}/100`}
          </strong>
        </span>
        <span>
          <small>Evidence references</small>
          <strong>{criterion.evidenceIds.length}</strong>
        </span>
      </div>
      {criterion.missingEvidence.length > 0 && (
        <div className="missing-evidence">
          <EIcon name="info" />
          <div>
            <strong>Missing or insufficient evidence</strong>
            {criterion.missingEvidence.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
      )}
      <div className="criterion-actions">
        <button
          onClick={() =>
            criterion.evidenceIds.length
              ? go(`/recruiter/reports/${evaluation.id}/evidence/${criterion.evidenceIds[0]}`)
              : undefined
          }
          disabled={!criterion.evidenceIds.length}
        >
          <EIcon name="evidence" />
          {criterion.evidenceIds.length ? "Inspect supporting evidence" : "Evidence unavailable"}
        </button>
        <button onClick={() => onReview(criterion)}>Review finding</button>
      </div>
    </article>
  );
}

const evaluationStatuses: EvaluationStatus[] = [
  "Demonstrated",
  "Partially Demonstrated",
  "Not Demonstrated in Available Evidence",
  "Inconclusive",
  "Invalid Assessment Evidence",
];

function ReportsOverviewV2({
  session,
  evaluation,
  organizationId,
}: {
  session: AssessmentSession | null;
  evaluation: EvaluationRecord | null;
  organizationId?: string;
}) {
  const [search, setSearch] = useState("");
  const [assessment, setAssessment] = useState("All assessments");
  const [company, setCompany] = useState("All companies");
  const [evaluationStatus, setEvaluationStatus] = useState("All evaluation statuses");
  const [reviewStatus, setReviewStatus] = useState("All review statuses");
  const [date, setDate] = useState("Any submission date");
  const [sort, setSort] = useState("Most recent submission");
  const [submittedAssignments, setSubmittedAssignments] = useState<CandidateAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchSubmitted = async () => {
      try {
        const response = await assignmentsApi.list({
          status: "submitted",
          organizationId,
          page: 1,
          limit: 100,
        });
        if (!cancelled) {
          setSubmittedAssignments(response.data.items);
          setLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to fetch submitted assignments:", error);
          setLoading(false);
        }
      }
    };
    fetchSubmitted();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const submitted = !!session?.submittedAt;
  const matches =
    !!evaluation &&
    submitted &&
    `${evaluation.candidateName} ${evaluation.assessmentTitle} ${evaluation.taskTitle}`
      .toLowerCase()
      .includes(search.toLowerCase()) &&
    (assessment === "All assessments" || assessment === evaluation.assessmentTitle) &&
    (company === "All companies" || company === evaluation.companyName) &&
    (evaluationStatus === "All evaluation statuses" ||
      evaluationStatus === evaluation.evaluationStatus) &&
    (reviewStatus === "All review statuses" || reviewStatus === evaluation.reviewerStatus) &&
    (date === "Any submission date" ||
      (date === "Last 7 days" &&
        Date.now() - new Date(evaluation.submissionTimestamp).getTime() <= 7 * 86_400_000));
  const clear = () => {
    setSearch("");
    setAssessment("All assessments");
    setCompany("All companies");
    setEvaluationStatus("All evaluation statuses");
    setReviewStatus("All review statuses");
    setDate("Any submission date");
    setSort("Most recent submission");
  };
  return (
    <>
      <div className="eval-page-header">
        <div>
          <span>Evidence-backed evaluation</span>
          <h1>Assessment Reports</h1>
          <p>
            Search submitted assessments and open the evaluation tied to the exact candidate
            session.
          </p>
        </div>
        <span className="local-demo-label">
          <i></i>Local demo records
        </span>
      </div>
      <div className="eval-metrics">
        <article className="card">
          <span>
            <EIcon name="report" />
          </span>
          <div>
            <small>Submitted reports</small>
            <strong>{loading ? "..." : submittedAssignments.length}</strong>
            <p>From backend database</p>
          </div>
        </article>
        <article className="card">
          <span>
            <EIcon name="shield" />
          </span>
          <div>
            <small>Awaiting human review</small>
            <strong>{evaluation && evaluation.reviewerStatus !== "Reviewed" ? 1 : 0}</strong>
            <p>Evaluation and review are separate states</p>
          </div>
        </article>
        <article className="card">
          <span>
            <EIcon name="evidence" />
          </span>
          <div>
            <small>Evidence coverage</small>
            <strong>{evaluation ? `${evaluation.evidenceCoverage}%` : "—"}</strong>
            <p>Across configured rubric criteria</p>
          </div>
        </article>
      </div>
      <section className="report-list-controls card">
        <div className="report-search">
          <EIcon name="search" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search candidate or assessment"
            aria-label="Search reports"
          />
          {search && <button onClick={() => setSearch("")}>Clear</button>}
        </div>
        <div className="report-filter-grid">
          <select
            value={assessment}
            onChange={(event) => setAssessment(event.target.value)}
            aria-label="Filter by assessment"
          >
            <option>All assessments</option>
            {evaluation && <option>{evaluation.assessmentTitle}</option>}
          </select>
          <select
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            aria-label="Filter by company"
          >
            <option>All companies</option>
            {evaluation && <option>{evaluation.companyName}</option>}
          </select>
          <select
            value={evaluationStatus}
            onChange={(event) => setEvaluationStatus(event.target.value)}
            aria-label="Filter by evaluation status"
          >
            <option>All evaluation statuses</option>
            <option>Awaiting Evaluation</option>
            <option>Ready for Review</option>
            <option>Inconclusive</option>
            <option>Needs Attention</option>
            <option>Reviewed</option>
          </select>
          <select
            value={reviewStatus}
            onChange={(event) => setReviewStatus(event.target.value)}
            aria-label="Filter by review status"
          >
            <option>All review statuses</option>
            <option>Pending</option>
            <option>In Review</option>
            <option>Reviewed</option>
            <option>Needs Attention</option>
          </select>
          <select
            value={date}
            onChange={(event) => setDate(event.target.value)}
            aria-label="Filter by submission date"
          >
            <option>Any submission date</option>
            <option>Last 7 days</option>
          </select>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            aria-label="Sort reports"
          >
            <option>Most recent submission</option>
            <option>Review status</option>
          </select>
        </div>
      </section>
      {loading ? (
        <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
          Loading submitted assessments...
        </div>
      ) : submittedAssignments.length === 0 ? (
        <EmptyEvaluation
          title="No submitted assessment reports"
          copy="Submitted assignments will appear here after candidates complete and submit their assessments."
        />
      ) : (
        <section className="reports-table card">
          <div className="reports-table-head">
            <span>Candidate</span>
            <span>Assessment</span>
            <span>Submitted</span>
            <span>Status</span>
            <span></span>
          </div>
          {submittedAssignments.map((assignment: any) => (
            <div key={assignment.id} className="reports-table-row" style={{ padding: "1rem", borderBottom: "1px solid #eee", display: "grid", gridTemplateColumns: "1fr 2fr 1fr 1fr 1fr", gap: "1rem", alignItems: "center" }}>
              <span>
                <strong>{assignment.candidateName || assignment.candidateEmail || "Unknown"}</strong>
                <br /><small style={{ opacity: 0.6 }}>{assignment.candidateEmail}</small>
              </span>
              <span>
                <strong>{assignment.taskDetails?.title || "Assessment"}</strong>
                <br /><small style={{ opacity: 0.6 }}>{assignment.taskDetails?.company || "—"}</small>
              </span>
              <span>
                <strong>
                  {assignment.submittedAt
                    ? new Date(assignment.submittedAt).toLocaleDateString()
                    : "—"}
                </strong>
              </span>
              <span>
                <strong style={{ color: "#16a34a" }}>Submitted</strong>
              </span>
              <span style={{ color: "#6b7280", fontSize: "0.85rem" }}>
                Ready for review
              </span>
            </div>
          ))}
          <footer>
            <span>Showing {submittedAssignments.length} report{submittedAssignments.length !== 1 ? "s" : ""}</span>
            <span>Sorted by {sort.toLowerCase()}</span>
          </footer>
        </section>
      )}
      <div className="evaluation-limit card">
        <EIcon name="info" />
        <div>
          <strong>Decision support, not an employment decision</strong>
          <p>
            Evaluation status and human review status are intentionally separate. DevForge.ai does
            not automatically hire, reject, or rank candidates.
          </p>
        </div>
      </div>
    </>
  );
}

type ReportTimelineFilter =
  | "All Activity"
  | "Code Changes"
  | "AI Interactions"
  | "Test Runs"
  | "Submission Events";

function ReportTimeline({ evaluation }: { evaluation: EvaluationRecord }) {
  const [filter, setFilter] = useState<ReportTimelineFilter>("All Activity");
  const filtered = evaluation.evidence.filter((item) => {
    if (filter === "All Activity") return true;
    if (filter === "Code Changes")
      return item.type === "file_event" || item.type.includes("snapshot");
    if (filter === "AI Interactions")
      return item.type === "ai_coach_prompt" || item.type === "ai_coach_response";
    if (filter === "Test Runs")
      return item.type === "test_result" || item.type === "application_run";
    return item.type === "assessment_event" || item.type === "submitted_snapshot";
  });
  return (
    <section className="card report-timeline-section">
      <div className="detail-title">
        <span>
          <EIcon name="clock" />
        </span>
        <div>
          <h2>Evidence Timeline</h2>
          <p>Actual captured events only; no webcam, screen, or keystroke recording</p>
        </div>
      </div>
      <div className="timeline-filters">
        {(
          [
            "All Activity",
            "Code Changes",
            "AI Interactions",
            "Test Runs",
            "Submission Events",
          ] as ReportTimelineFilter[]
        ).map((item) => (
          <button
            className={filter === item ? "active" : ""}
            onClick={() => setFilter(item)}
            key={item}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="report-timeline-list">
        {filtered.length ? (
          filtered
            .slice()
            .reverse()
            .map((item) => (
              <div key={item.id}>
                <span className={`timeline-event-dot ${item.type}`}></span>
                <div>
                  <small>{new Date(item.timestamp).toLocaleString()}</small>
                  <strong>{item.title}</strong>
                  <p>{item.summary}</p>
                  <span>
                    {item.revisionId ? `${item.revisionId} · ` : ""}
                    {item.provenance.replace("_", " ")}
                  </span>
                </div>
                <button
                  onClick={() => go(`/recruiter/reports/${evaluation.id}/evidence/${item.id}`)}
                >
                  Inspect evidence
                </button>
              </div>
            ))
        ) : (
          <div className="report-unavailable">No captured events match this timeline filter.</div>
        )}
        <div className="evaluation-timeline-event">
          <span className="timeline-event-dot evaluation"></span>
          <div>
            <small>{new Date(evaluation.evaluatedAt).toLocaleString()}</small>
            <strong>Deterministic evaluation completed</strong>
            <p>
              {evaluation.evaluatorVersion} evaluated {evaluation.criteria.length} rubric criteria.
            </p>
          </div>
        </div>
        {evaluation.reviewEvents.map((item) => (
          <div className="evaluation-timeline-event" key={item.id}>
            <span className="timeline-event-dot review"></span>
            <div>
              <small>{new Date(item.timestamp).toLocaleString()}</small>
              <strong>Reviewer decision · {item.criterionId}</strong>
              <p>{item.reason}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReportPageV2({
  session,
  evaluation,
  persist,
}: {
  session: AssessmentSession;
  evaluation: EvaluationRecord;
  persist: PersistEvaluation;
}) {
  const [reviewing, setReviewing] = useState<CriterionFinding | null>(null);
  const [status, setStatus] = useState<EvaluationStatus>("Inconclusive");
  const [reason, setReason] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [notes, setNotes] = useState(evaluation.internalReviewerNotes);
  const [outcome, setOutcome] = useState(evaluation.reviewerOutcome ?? "Reviewed");
  const [expandedTests, setExpandedTests] = useState<string[]>([]);
  const [feedbackPreview, setFeedbackPreview] = useState(false);
  const latestTest = session.testRuns.at(-1);
  const latestRun = session.runHistory.at(-1);
  const prompts = session.coachMessages.filter((message) => message.role === "candidate");
  const responses = session.coachMessages.filter((message) => message.role === "coach");
  const timeSpentMs =
    new Date(evaluation.submissionTimestamp).getTime() - new Date(session.startedAt).getTime();
  const timeSpent = Math.max(1, Math.round(timeSpentMs / 60_000));
  const sufficient = evaluation.criteria.filter((item) => item.sufficiency === "Sufficient").length;
  const moreEvidence = evaluation.criteria.length - sufficient;
  const passed = latestTest?.results.filter((item) => item.status === "passed").length ?? 0;
  const failed = latestTest?.results.filter((item) => item.status === "failed").length ?? 0;
  const visibleFeedback = evaluation.criteria.filter((item) => item.candidateVisible);
  const openReview = (criterion: CriterionFinding) => {
    setReviewing(criterion);
    setStatus(effectiveCriterionStatus(evaluation, criterion.id) ?? criterion.status);
    setReason("");
    setReviewError("");
  };
  const addReviewEvent = (
    criterion: CriterionFinding,
    action: ReviewEvent["action"],
    nextStatus: EvaluationStatus,
    reviewReason: string,
  ) => {
    const event: ReviewEvent = {
      id: `review-${Date.now()}`,
      criterionId: criterion.id,
      action,
      previousStatus: effectiveCriterionStatus(evaluation, criterion.id) ?? criterion.status,
      newStatus: nextStatus,
      reviewerId: "jordan-lee-demo",
      reviewerName: "Jordan Lee · Demo recruiter",
      timestamp: new Date().toISOString(),
      reason: reviewReason,
      evidenceIds: criterion.evidenceIds,
    };
    if (
      persist({
        ...evaluation,
        reviewerStatus: "In Review",
        reviewEvents: [...evaluation.reviewEvents, event],
      })
    )
      setReviewing(null);
  };
  const saveOverride = () => {
    if (!reviewing) return;
    const currentStatus = effectiveCriterionStatus(evaluation, reviewing.id) ?? reviewing.status;
    if (status === currentStatus) {
      setReviewError("Choose a different status or accept the current finding.");
      return;
    }
    if (!reason.trim()) {
      setReviewError("A reason is required when changing a finding.");
      return;
    }
    addReviewEvent(reviewing, "overridden", status, reason.trim());
  };
  const saveNotes = () =>
    persist({
      ...evaluation,
      internalReviewerNotes: notes,
      reviewerStatus: "In Review",
    });
  const markReviewed = () =>
    persist({
      ...evaluation,
      reviewerStatus: outcome === "Needs Attention" ? "Needs Attention" : "Reviewed",
      reviewerOutcome: outcome,
      evaluationStatus: outcome === "Needs Attention" ? "Needs Attention" : "Reviewed",
    });
  const exportReport = () => {
    const payload = {
      reportId: evaluation.id,
      candidate: evaluation.candidateName,
      company: evaluation.companyName,
      assessment: evaluation.assessmentTitle,
      submissionRevision: evaluation.submissionRevisionId,
      rubricVersion: evaluation.rubricVersion,
      evaluatorVersion: evaluation.evaluatorVersion,
      criteria: evaluation.criteria,
      reviewerStatus: evaluation.reviewerStatus,
      reviewEvents: evaluation.reviewEvents,
      limitations: evaluation.limitations,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${evaluation.candidateName.replace(/ /g, "-").toLowerCase()}-assessment-report.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="evaluation-report report-v2">
      <nav className="report-breadcrumb" aria-label="Breadcrumb">
        <button onClick={() => go("/recruiter/dashboard")}>Recruiter Dashboard</button>
        <span>/</span>
        <button onClick={() => go("/recruiter/reports")}>Reports</button>
        <span>/</span>
        <button onClick={() => go("/recruiter/candidates/alex-morgan")}>
          {evaluation.candidateName}
        </button>
        <span>/</span>
        <strong>Assessment Report</strong>
      </nav>
      <section className="report-v2-header card">
        <div className="report-v2-title">
          <span className="candidate-avatar large">AM</span>
          <div>
            <span>{evaluation.companyName} · Frontend Developer</span>
            <h1>{evaluation.candidateName}</h1>
            <p>
              {evaluation.assessmentTitle} — {evaluation.taskTitle}
            </p>
          </div>
          <div className="dual-status">
            <span>
              <small>Evaluation</small>
              <EvalStatus status={evaluation.evaluationStatus} />
            </span>
            <span>
              <small>Human review</small>
              <EvalStatus
                status={
                  evaluation.reviewerStatus === "Pending"
                    ? "Review Pending"
                    : evaluation.reviewerStatus
                }
              />
            </span>
          </div>
        </div>
        <div className="report-v2-meta">
          <span>
            <small>Submitted</small>
            <strong>{new Date(evaluation.submissionTimestamp).toLocaleString()}</strong>
          </span>
          <span>
            <small>Time spent</small>
            <strong>{timeSpent} minutes</strong>
          </span>
          <span>
            <small>Submission ID</small>
            <strong>{session.sessionId}</strong>
          </span>
          <span>
            <small>Evaluation version</small>
            <strong>
              v{evaluation.version} · {evaluation.rubricVersion}
            </strong>
          </span>
        </div>
        <div className="report-v2-actions">
          <button onClick={() => go(`/recruiter/reports/${evaluation.id}/evidence`)}>
            <EIcon name="evidence" />
            Open Evidence Explorer
          </button>
          <button
            onClick={() =>
              document.getElementById("submission-overview")?.scrollIntoView({ behavior: "smooth" })
            }
          >
            <EIcon name="code" />
            Review Submission
          </button>
          <button
            onClick={() => {
              document.getElementById("reviewer-note")?.scrollIntoView({ behavior: "smooth" });
              window.setTimeout(() => document.getElementById("reviewer-note")?.focus(), 350);
            }}
          >
            <EIcon name="user" />
            Add Reviewer Note
          </button>
          {evaluation.reviewerStatus !== "Reviewed" && (
            <button className="primary" onClick={markReviewed}>
              <EIcon name="check" />
              Mark Reviewed
            </button>
          )}
          <button onClick={exportReport}>
            <EIcon name="report" />
            Export JSON
          </button>
        </div>
      </section>
      <section className="assessment-summary-v2 card">
        <div>
          <small>Assessment status</small>
          <strong>Submitted</strong>
        </div>
        <div>
          <small>Criteria evaluated</small>
          <strong>{evaluation.criteria.length}</strong>
        </div>
        <div>
          <small>Sufficient evidence</small>
          <strong>{sufficient}</strong>
        </div>
        <div>
          <small>More evidence needed</small>
          <strong>{moreEvidence}</strong>
        </div>
        <div>
          <small>Tests</small>
          <strong>
            {passed} passed · {failed} failed
          </strong>
        </div>
        <div>
          <small>Evidence records</small>
          <strong>{evaluation.evidence.length}</strong>
        </div>
        <div>
          <small>Human review</small>
          <strong>{evaluation.reviewerStatus}</strong>
        </div>
      </section>
      <div className="report-score-explanation card">
        <EIcon name="info" />
        {evaluation.aggregateScore === undefined ? (
          <div>
            <strong>No overall score calculated</strong>
            <p>
              {evaluation.excludedCriteria.length} criteria are excluded because evidence is
              inconclusive or invalid. Missing evidence is never converted to zero performance.
            </p>
          </div>
        ) : (
          <div>
            <strong>Supported aggregate: {evaluation.aggregateScore}/100</strong>
            <p>
              Weighted from the five configured criteria using 30%, 20%, 20%, 15%, and 15% weights.
            </p>
          </div>
        )}
      </div>
      <section className="report-section-heading">
        <div>
          <span>Configured rubric</span>
          <h2>Skills Assessment</h2>
          <p>
            Hover status labels for definitions. Open each finding to inspect its exact evidence
            IDs.
          </p>
        </div>
      </section>
      <div className="criteria-list">
        {evaluation.criteria.map((criterion) => (
          <FindingCard
            key={criterion.id}
            criterion={criterion}
            evaluation={evaluation}
            onReview={openReview}
          />
        ))}
      </div>
      <section className="report-section-heading">
        <div>
          <span>Evidence-backed findings</span>
          <h2>Why This Assessment Received These Findings</h2>
          <p>
            Important findings are shown with the first available supporting record. Activity alone
            is not treated as proof of authorship or intent.
          </p>
        </div>
      </section>
      <div className="why-findings card">
        {evaluation.criteria.map((criterion) => {
          const evidence = evaluation.evidence.find((item) =>
            criterion.evidenceIds.includes(item.id),
          );
          return (
            <article key={criterion.id}>
              <span className="finding-index">
                {String(evaluation.criteria.indexOf(criterion) + 1).padStart(2, "0")}
              </span>
              <div>
                <small>{criterion.name}</small>
                <strong>{criterion.explanation}</strong>
                <p>
                  {evidence
                    ? `${evidenceLabels[evidence.type]} · ${new Date(evidence.timestamp).toLocaleString()}${
                        evidence.file ? ` · ${evidence.file}` : ""
                      }${evidence.revisionId ? ` · ${evidence.revisionId}` : ""}`
                    : "Supporting evidence unavailable"}
                </p>
              </div>
              <EvalStatus status={criterion.sufficiency} />
              <button
                onClick={() =>
                  evidence && go(`/recruiter/reports/${evaluation.id}/evidence/${evidence.id}`)
                }
                disabled={!evidence}
              >
                View exact evidence <EIcon name="arrow" />
              </button>
            </article>
          );
        })}
      </div>
      <div className="report-v2-body">
        <main>
          <section className="card submission-overview-v2" id="submission-overview">
            <div className="detail-title">
              <span>
                <EIcon name="code" />
              </span>
              <div>
                <h2>Submission Overview</h2>
                <p>Immutable submitted snapshot, not the editable candidate workspace</p>
              </div>
            </div>
            <div className="submission-overview-grid">
              <span>
                <small>Final revision</small>
                <strong>{evaluation.submissionRevisionId}</strong>
              </span>
              <span>
                <small>Submitted</small>
                <strong>{new Date(evaluation.submissionTimestamp).toLocaleString()}</strong>
              </span>
              <span>
                <small>Final test status</small>
                <strong>
                  {latestTest ? `${passed}/${latestTest.results.length} passed` : "Unavailable"}
                </strong>
              </span>
              <span>
                <small>Application run</small>
                <strong>{latestRun?.status ?? "Unavailable"}</strong>
              </span>
            </div>
            <div className="submitted-files">
              {session.savedFiles.map((file) => (
                <span key={file.path}>
                  {file.path}
                  {file.readOnly && <small>read only</small>}
                </span>
              ))}
            </div>
            <button
              className="open-snapshot"
              onClick={() =>
                go(
                  `/recruiter/reports/${evaluation.id}/evidence/evidence-submission-${session.sessionId}`,
                )
              }
            >
              View Code Snapshot <EIcon name="arrow" />
            </button>
          </section>
          <section className="card ai-analysis-v2">
            <div className="detail-title">
              <span>
                <EIcon name="code" />
              </span>
              <div>
                <h2>AI Collaboration & Verification</h2>
                <p>Recorded facts are separated from reviewer interpretation</p>
              </div>
            </div>
            <div className="ai-facts">
              <span>
                <small>Candidate prompts</small>
                <strong>{prompts.length}</strong>
              </span>
              <span>
                <small>Coach responses</small>
                <strong>{responses.length}</strong>
              </span>
              <span>
                <small>Explicit applied suggestions</small>
                <strong>
                  {
                    session.activity.filter((item) =>
                      item.detail.includes("applied demo coach suggestion"),
                    ).length
                  }
                </strong>
              </span>
              <span>
                <small>Verification status</small>
                <strong>
                  {prompts.length && latestTest ? "Test activity available" : "Unclear"}
                </strong>
              </span>
            </div>
            {prompts.length ? (
              <div className="ai-timeline-v2">
                {prompts.map((message) => {
                  const response = responses.find(
                    (item) =>
                      new Date(item.timestamp).getTime() >= new Date(message.timestamp).getTime(),
                  );
                  return (
                    <article key={message.id}>
                      <span>
                        <EIcon name="user" />
                      </span>
                      <div>
                        <small>
                          {new Date(message.timestamp).toLocaleString()} · Candidate prompt
                        </small>
                        <strong>{message.content}</strong>
                        {response && <p>Demo coach: {response.content}</p>}
                        <button
                          onClick={() =>
                            go(
                              `/recruiter/reports/${evaluation.id}/evidence/evidence-coach-${message.id}`,
                            )
                          }
                        >
                          Open prompt and response evidence
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="report-unavailable">
                <EIcon name="info" />
                <strong>No AI interaction evidence available</strong>
                <p>No conclusion is made about unobserved AI use.</p>
              </div>
            )}
            <div className="ai-caution">
              <EIcon name="info" />
              <p>
                Interaction count is not a negative score. The platform does not claim submitted
                code was AI-generated without reliable provenance.
              </p>
            </div>
          </section>
          <section className="card execution-results-v2">
            <div className="detail-title">
              <span>
                <EIcon name="test" />
              </span>
              <div>
                <h2>Execution & Test Results</h2>
                <p>Deterministic demo-runner output; no hidden tests are claimed</p>
              </div>
            </div>
            {latestTest ? (
              <>
                <div className="execution-summary-v2">
                  <span>
                    <small>Total</small>
                    <strong>{latestTest.results.length}</strong>
                  </span>
                  <span>
                    <small>Passed</small>
                    <strong className="success">{passed}</strong>
                  </span>
                  <span>
                    <small>Failed</small>
                    <strong className="danger">{failed}</strong>
                  </span>
                  <span>
                    <small>Skipped</small>
                    <strong>
                      {latestTest.results.filter((item) => item.status === "pending").length}
                    </strong>
                  </span>
                  <span>
                    <small>Run timestamp</small>
                    <strong>{new Date(latestTest.timestamp).toLocaleString()}</strong>
                  </span>
                  <span>
                    <small>Revision</small>
                    <strong>{latestTest.revisionId}</strong>
                  </span>
                </div>
                <div className="expandable-tests">
                  {latestTest.results.map((result) => {
                    const open = expandedTests.includes(result.id);
                    return (
                      <article className={result.status} key={result.id}>
                        <button
                          onClick={() =>
                            setExpandedTests(
                              open
                                ? expandedTests.filter((id) => id !== result.id)
                                : [...expandedTests, result.id],
                            )
                          }
                        >
                          <span>
                            <EIcon name={result.status === "passed" ? "check" : "warning"} />
                          </span>
                          <strong>{result.name}</strong>
                          <EvalStatus status={result.status} />
                          <b>{open ? "−" : "+"}</b>
                        </button>
                        {open && (
                          <div>
                            <strong>
                              {result.status === "failed"
                                ? "Candidate-code or assertion diagnostic"
                                : "Supported check output"}
                            </strong>
                            <p>{result.diagnostic}</p>
                            <small>
                              Source: deterministic demo analyzer · No hidden definition exposed
                            </small>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="report-unavailable">
                <EIcon name="warning" />
                <strong>Test results unavailable</strong>
                <p>No supported runner record exists for this submission.</p>
              </div>
            )}
          </section>
          <ReportTimeline evaluation={evaluation} />
          <section className="card candidate-feedback-report">
            <div className="detail-title">
              <span>
                <EIcon name="user" />
              </span>
              <div>
                <h2>Candidate Feedback</h2>
                <p>Candidate-visible content only; private recruiter notes are excluded</p>
              </div>
            </div>
            <div className="feedback-preview-summary">
              <span>
                <strong>
                  {
                    visibleFeedback.filter(
                      (item) => effectiveCriterionStatus(evaluation, item.id) === "Demonstrated",
                    ).length
                  }
                </strong>{" "}
                demonstrated strengths
              </span>
              <span>
                <strong>
                  {
                    visibleFeedback.filter(
                      (item) => effectiveCriterionStatus(evaluation, item.id) !== "Demonstrated",
                    ).length
                  }
                </strong>{" "}
                development or evidence gaps
              </span>
            </div>
            <button onClick={() => setFeedbackPreview(true)}>
              Preview Candidate Feedback <EIcon name="arrow" />
            </button>
            <small>Sharing or publishing feedback is unavailable in this local demo.</small>
          </section>
        </main>
        <aside className="card reviewer-decision-v2">
          <div className="reviewer-decision-head">
            <span>
              <EIcon name="shield" />
            </span>
            <div>
              <h2>Reviewer Decision</h2>
              <p>Human decision support</p>
            </div>
          </div>
          <div className="review-state">
            <small>Current review status</small>
            <EvalStatus
              status={
                evaluation.reviewerStatus === "Pending"
                  ? "Review Pending"
                  : evaluation.reviewerStatus
              }
            />
          </div>
          <div className="review-criteria-list">
            <strong>Criterion agreement</strong>
            {evaluation.criteria.map((criterion) => {
              const effective =
                effectiveCriterionStatus(evaluation, criterion.id) ?? criterion.status;
              return (
                <button onClick={() => openReview(criterion)} key={criterion.id}>
                  <span>
                    {criterion.name}
                    <small>
                      {effective === criterion.status
                        ? "No reviewer disagreement"
                        : `Changed from ${criterion.status}`}
                    </small>
                  </span>
                  <EvalStatus status={effective} />
                </button>
              );
            })}
          </div>
          <label>
            <span>Confidential reviewer notes</span>
            <textarea
              id="reviewer-note"
              rows={5}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Add evidence-linked internal notes…"
            />
          </label>
          <button onClick={saveNotes}>Save Reviewer Note</button>
          <label>
            <span>Overall reviewer assessment</span>
            <select value={outcome} onChange={(event) => setOutcome(event.target.value)}>
              <option>Reviewed</option>
              <option>Needs Attention</option>
            </select>
          </label>
          <button className="mark-reviewed" onClick={markReviewed}>
            Record Reviewer Decision
          </button>
          <div className="request-unavailable">
            <button disabled>Request Additional Verification</button>
            <span>Targeted follow-up sessions are not implemented.</span>
          </div>
          <div className="decision-history">
            <strong>Decision history</strong>
            {evaluation.reviewEvents.length ? (
              evaluation.reviewEvents
                .slice()
                .reverse()
                .map((item) => (
                  <div key={item.id}>
                    <span>{item.action}</span>
                    <p>
                      {item.criterionId}: {item.previousStatus} → {item.newStatus}
                    </p>
                    <small>
                      {new Date(item.timestamp).toLocaleString()} · {item.reviewerName}
                    </small>
                  </div>
                ))
            ) : (
              <p>Review Pending — no human decisions recorded.</p>
            )}
          </div>
        </aside>
      </div>
      <section className="card audit-section">
        <div className="detail-title">
          <span>
            <EIcon name="shield" />
          </span>
          <div>
            <h2>Review Audit Trail</h2>
            <p>Original automated findings and reviewer changes remain separate</p>
          </div>
        </div>
        {evaluation.reviewEvents.length ? (
          evaluation.reviewEvents
            .slice()
            .reverse()
            .map((event) => (
              <div className="audit-row" key={event.id}>
                <span>
                  <EIcon name={event.action === "accepted" ? "check" : "user"} />
                </span>
                <div>
                  <strong>
                    {event.action === "accepted"
                      ? "Automated finding accepted"
                      : "Reviewer override recorded"}
                  </strong>
                  <p>
                    {event.criterionId} · {event.previousStatus} → {event.newStatus}
                  </p>
                  <small>{event.reason}</small>
                </div>
                <div>
                  <strong>{event.reviewerName}</strong>
                  <small>{new Date(event.timestamp).toLocaleString()}</small>
                </div>
              </div>
            ))
        ) : (
          <div className="report-unavailable">
            Review Pending — no reviewer actions have been recorded.
          </div>
        )}
      </section>
      <div className="limitations-panel card">
        <EIcon name="info" />
        <div>
          <strong>Evaluation limitations</strong>
          {evaluation.limitations.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      </div>
      {reviewing && (
        <div className="review-modal-backdrop">
          <div className="review-modal" role="dialog" aria-modal="true">
            <span className="review-modal-icon">
              <EIcon name="shield" />
            </span>
            <h2>Review {reviewing.name}</h2>
            <p>
              Original automated status: <strong>{reviewing.status}</strong>. It remains preserved
              in the evaluation record.
            </p>
            <label>
              <span>Reviewer status</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as EvaluationStatus)}
              >
                {evaluationStatuses.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Evidence-linked reason</span>
              <textarea
                rows={4}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Explain the change and reference the available evidence…"
              />
            </label>
            {reviewError && (
              <div className="review-error">
                <EIcon name="warning" />
                {reviewError}
              </div>
            )}
            <div className="review-modal-actions">
              <button onClick={() => setReviewing(null)}>Cancel</button>
              <button
                onClick={() =>
                  addReviewEvent(
                    reviewing,
                    "accepted",
                    reviewing.status,
                    "Accepted the original deterministic finding after reviewing its evidence references.",
                  )
                }
              >
                Accept automated finding
              </button>
              <button className="primary" onClick={saveOverride}>
                Save reviewer override
              </button>
            </div>
            <div className="follow-up-unavailable">
              <button disabled>Request candidate clarification</button>
              <span>Targeted follow-up is unavailable in this local prototype.</span>
            </div>
          </div>
        </div>
      )}
      {feedbackPreview && (
        <div className="review-modal-backdrop">
          <div className="review-modal candidate-preview-modal" role="dialog" aria-modal="true">
            <span className="review-modal-icon">
              <EIcon name="user" />
            </span>
            <h2>Candidate Feedback Preview</h2>
            <p>This preview excludes confidential reviewer notes and internal decision history.</p>
            <div>
              {visibleFeedback.map((criterion) => (
                <article key={criterion.id}>
                  <EvalStatus
                    status={effectiveCriterionStatus(evaluation, criterion.id) ?? criterion.status}
                  />
                  <strong>{criterion.name}</strong>
                  <p>{criterion.explanation}</p>
                </article>
              ))}
            </div>
            <div className="review-modal-actions">
              <button className="primary" onClick={() => setFeedbackPreview(false)}>
                Close Preview
              </button>
            </div>
            <div className="follow-up-unavailable">
              <button disabled>Publish Feedback</button>
              <span>Publishing is unavailable in the local demo.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const evidenceLabels: Record<EvidenceType, string> = {
  submitted_snapshot: "Submitted snapshot",
  earlier_snapshot: "Earlier snapshot",
  test_result: "Test result",
  application_run: "Application run",
  ai_coach_prompt: "AI Coach prompt",
  ai_coach_response: "AI Coach response",
  file_event: "File event",
  assessment_event: "Assessment event",
  terminal_command: "Terminal command",
};

function EvidenceDetail({
  evidence,
  evaluation,
  session,
}: {
  evidence: EvidenceRecord;
  evaluation: EvaluationRecord;
  session: AssessmentSession;
}) {
  const [file, setFile] = useState(
    evidence.file ??
      session.savedFiles.find((item) => !item.readOnly)?.path ??
      session.savedFiles[0]?.path,
  );
  const related = evaluation.criteria.filter((criterion) =>
    criterion.evidenceIds.includes(evidence.id),
  );
  const revision = session.revisions.find((item) => item.id === evidence.revisionId);
  const snapshotFiles =
    evidence.type === "submitted_snapshot" ? session.savedFiles : revision?.files;
  const snapshotFile = snapshotFiles?.find((item) => item.path === file) ?? snapshotFiles?.[0];
  const [kind, ...refParts] = evidence.contentRef.split(":");
  const coachMessage =
    kind === "coach"
      ? session.coachMessages.find((message) => message.id === refParts[0])
      : undefined;
  const testRun =
    kind === "test" ? session.testRuns.find((run) => run.id === refParts[0]) : undefined;
  const testResult = testRun?.results.find((result) => result.id === refParts[1]);
  const activity =
    kind === "activity" ? session.activity.find((event) => event.id === refParts[0]) : undefined;
  const terminalCapture = (() => {
    if (evidence.type !== "terminal_command" || !evidence.resultId) return null;
    try {
      const ui = JSON.parse(
        localStorage.getItem(`devforge-workspace-ui:${session.sessionId}`) ?? "null",
      );
      return ui?.terminals?.find((terminal: { id: string }) => terminal.id === evidence.resultId);
    } catch {
      return null;
    }
  })();
  return (
    <div className="evidence-detail">
      <div className="evidence-detail-head">
        <span className={`evidence-type-icon ${evidence.type}`}>
          <EIcon
            name={
              evidence.type.includes("snapshot")
                ? "code"
                : evidence.type === "test_result"
                  ? "test"
                  : "evidence"
            }
          />
        </span>
        <div>
          <span>{evidenceLabels[evidence.type]}</span>
          <h2>{evidence.title}</h2>
          <p>{new Date(evidence.timestamp).toLocaleString()}</p>
        </div>
        <EvalStatus status={evidence.integrity} />
      </div>
      <dl>
        <div>
          <dt>Evidence ID</dt>
          <dd>{evidence.id}</dd>
        </div>
        <div>
          <dt>Session</dt>
          <dd>{evidence.sessionId}</dd>
        </div>
        <div>
          <dt>Revision</dt>
          <dd>{evidence.revisionId ?? "Not applicable"}</dd>
        </div>
        <div>
          <dt>Provenance</dt>
          <dd>{evidence.provenance.replace("_", " ")}</dd>
        </div>
      </dl>
      <div className="evidence-summary">
        <strong>Captured record</strong>
        <p>{evidence.summary}</p>
      </div>
      {snapshotFiles && (
        <div className="snapshot-viewer">
          <div className="snapshot-files">
            {snapshotFiles.map((item) => (
              <button
                className={snapshotFile?.path === item.path ? "active" : ""}
                onClick={() => setFile(item.path)}
                key={item.path}
              >
                {item.path}
              </button>
            ))}
          </div>
          <pre>
            <code>{snapshotFile?.content ?? "Snapshot content unavailable."}</code>
          </pre>
        </div>
      )}
      {testResult && (
        <div className="test-evidence-detail">
          <EvalStatus status={testResult.status} />
          <h3>{testResult.name}</h3>
          <p>{testResult.diagnostic}</p>
          <span>
            Run {testRun?.id} · {testRun?.revisionId}
          </span>
        </div>
      )}
      {coachMessage && (
        <div className={`coach-evidence-detail ${coachMessage.role}`}>
          <span>
            {coachMessage.role === "candidate" ? "Candidate prompt" : "Deterministic demo response"}
          </span>
          <p>{coachMessage.content}</p>
          {coachMessage.explanation && <small>{coachMessage.explanation}</small>}
        </div>
      )}
      {activity && (
        <div className="activity-evidence-detail">
          <strong>{activity.type}</strong>
          <p>{activity.detail}</p>
          <span>Source event {activity.id}</span>
        </div>
      )}
      {evidence.type === "terminal_command" && (
        <div className="terminal-evidence-detail">
          <strong>Persisted Demo Terminal capture</strong>
          {terminalCapture?.lines?.length ? (
            terminalCapture.lines.map((line: { id: string; kind: string; text: string }) => (
              <pre className={line.kind} key={line.id}>
                {line.text}
              </pre>
            ))
          ) : (
            <p>
              Terminal output is unavailable. The command event remains available, but no matching
              terminal session capture was found.
            </p>
          )}
        </div>
      )}
      <div className="associated-findings">
        <strong>Associated criteria</strong>
        {related.length ? (
          related.map((criterion) => (
            <button
              onClick={() => go(`/recruiter/reports/${evaluation.id}#criterion-${criterion.id}`)}
              key={criterion.id}
            >
              {criterion.name}
              <EIcon name="arrow" />
            </button>
          ))
        ) : (
          <p>No evaluation criterion directly references this item.</p>
        )}
      </div>
      <div className="integrity-notice">
        <EIcon name="info" />
        <p>
          Activity provenance describes the captured interface source only. It does not prove
          authorship, intent, or independent understanding.
        </p>
      </div>
    </div>
  );
}

function EvidenceExplorer({
  session,
  evaluation,
  selectedId,
}: {
  session: AssessmentSession;
  evaluation: EvaluationRecord;
  selectedId?: string;
}) {
  const [type, setType] = useState("all");
  const [file, setFile] = useState("all");
  const [revision, setRevision] = useState("all");
  const [result, setResult] = useState("all");
  const [timeRange, setTimeRange] = useState("all");
  const [selected, setSelected] = useState(selectedId ?? evaluation.evidence[0]?.id);
  const files = [...new Set(evaluation.evidence.map((item) => item.file).filter(Boolean))];
  const revisions = [
    ...new Set(evaluation.evidence.map((item) => item.revisionId).filter(Boolean)),
  ];
  const start = new Date(session.startedAt).getTime();
  const end = new Date(session.submittedAt ?? session.startedAt).getTime();
  const filtered = useMemo(
    () =>
      evaluation.evidence.filter((item) => {
        const time = new Date(item.timestamp).getTime();
        return (
          (type === "all" || item.type === type) &&
          (file === "all" || item.file === file) &&
          (revision === "all" || item.revisionId === revision) &&
          (result === "all" || item.testStatus === result) &&
          (timeRange === "all" ||
            (timeRange === "first" ? time <= start + 15 * 60_000 : time >= end - 15 * 60_000))
        );
      }),
    [evaluation.evidence, type, file, revision, result, timeRange, start, end],
  );
  const selectedEvidence = evaluation.evidence.find((item) => item.id === selected);
  return (
    <div className="evidence-explorer">
      <button className="eval-back" onClick={() => go(`/recruiter/reports/${evaluation.id}`)}>
        ← Back to assessment report
      </button>
      <div className="eval-page-header">
        <div>
          <span>Evidence Explorer</span>
          <h1>
            {evaluation.candidateName} · {evaluation.taskTitle}
          </h1>
          <p>Chronological browser-local records normalized from session {evaluation.sessionId}.</p>
        </div>
        <span className="local-demo-label">
          <i></i>
          {evaluation.evidence.length} evidence records
        </span>
      </div>
      <div className="evidence-filters card">
        <label>
          <span>Evidence type</span>
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="all">All types</option>
            {Object.entries(evidenceLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>File</span>
          <select value={file} onChange={(event) => setFile(event.target.value)}>
            <option value="all">All files</option>
            {files.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Revision</span>
          <select value={revision} onChange={(event) => setRevision(event.target.value)}>
            <option value="all">All revisions</option>
            {revisions.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Test result</span>
          <select value={result} onChange={(event) => setResult(event.target.value)}>
            <option value="all">All outcomes</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
        </label>
        <label>
          <span>Time range</span>
          <select value={timeRange} onChange={(event) => setTimeRange(event.target.value)}>
            <option value="all">Entire session</option>
            <option value="first">First 15 minutes</option>
            <option value="last">Last 15 minutes</option>
          </select>
        </label>
      </div>
      <div className="evidence-layout">
        <aside className="card evidence-timeline">
          <header>
            <div>
              <strong>Activity timeline</strong>
              <span>{filtered.length} records</span>
            </div>
            <button
              onClick={() => {
                setType("all");
                setFile("all");
                setRevision("all");
                setResult("all");
                setTimeRange("all");
              }}
            >
              <EIcon name="filter" />
              Clear
            </button>
          </header>
          {filtered.length ? (
            filtered.map((item) => (
              <button
                className={selected === item.id ? "active" : ""}
                onClick={() => setSelected(item.id)}
                key={item.id}
              >
                <span className={`timeline-dot ${item.type}`}></span>
                <div>
                  <small>{new Date(item.timestamp).toLocaleTimeString()}</small>
                  <strong>{item.title}</strong>
                  <p>{item.summary}</p>
                  <span>
                    {evidenceLabels[item.type]}
                    {item.revisionId ? ` · ${item.revisionId}` : ""}
                  </span>
                </div>
              </button>
            ))
          ) : (
            <div className="timeline-empty">
              <EIcon name="search" />
              <strong>No matching evidence</strong>
              <p>No captured record matches the selected filters.</p>
            </div>
          )}
        </aside>
        <main className="card">
          {selectedEvidence ? (
            <EvidenceDetail evidence={selectedEvidence} evaluation={evaluation} session={session} />
          ) : (
            <div className="timeline-empty">
              <EIcon name="warning" />
              <strong>Evidence unavailable</strong>
              <p>The requested evidence record is missing or does not belong to this session.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export function RecruiterReportsPage({
  path,
  session,
  evaluation,
  persist,
  organizationId,
}: {
  path: string;
  session: AssessmentSession | null;
  evaluation: EvaluationRecord | null;
  persist: PersistEvaluation;
  organizationId?: string;
}) {
  const validEvaluation =
    evaluation && session && evaluation.sessionId === session.sessionId ? evaluation : null;
  if (
    path === "/recruiter/reports" &&
    evaluation &&
    session &&
    evaluation.sessionId !== session.sessionId
  )
    return (
      <div className="eval-empty card">
        <span>
          <EIcon name="warning" />
        </span>
        <h2>Report records could not be matched</h2>
        <p>
          The saved evaluation belongs to a different assessment session. No report is shown because
          evidence cannot be safely attributed.
        </p>
      </div>
    );
  if (path === "/recruiter/reports")
    return <ReportsOverviewV2 session={session} evaluation={validEvaluation} organizationId={organizationId} />;
  if (!session?.submittedAt || !validEvaluation)
    return (
      <EmptyEvaluation
        title="Report unavailable"
        copy="No matching submitted assessment and evaluation record is available in this browser."
      />
    );
  if (!path.includes(validEvaluation.id))
    return (
      <EmptyEvaluation
        title="Report not found"
        copy="The requested report does not belong to the available NovaTech submission."
      />
    );
  const evidenceMatch = path.match(/\/evidence(?:\/(.+))?$/);
  if (evidenceMatch)
    return (
      <EvidenceExplorer
        session={session}
        evaluation={validEvaluation}
        selectedId={evidenceMatch[1]}
      />
    );
  return <ReportPageV2 session={session} evaluation={validEvaluation} persist={persist} />;
}

export function RecruiterReviewQueuePage({
  path,
  session,
  evaluation,
}: {
  path: string;
  session: AssessmentSession | null;
  evaluation: EvaluationRecord | null;
}) {
  const [filter, setFilter] = useState("All");
  const validEvaluation =
    evaluation && session && evaluation.sessionId === session.sessionId ? evaluation : null;
  if (path !== "/recruiter/review" && validEvaluation && path.includes(validEvaluation.id)) {
    go(`/recruiter/reports/${validEvaluation.id}`);
    return null;
  }
  const status =
    validEvaluation?.reviewerStatus === "Reviewed"
      ? "Reviewed"
      : (validEvaluation?.evaluationStatus ?? "Awaiting Evaluation");
  const visible = filter === "All" || filter === status;
  return (
    <>
      <div className="eval-page-header">
        <div>
          <span>Reviewer workspace</span>
          <h1>Review Queue</h1>
          <p>Actual submitted assessments and deterministic evaluation state from this browser.</p>
        </div>
        <span className="local-demo-label">
          <i></i>Frontend role guards · Demo only
        </span>
      </div>
      <div className="review-filters">
        {[
          "All",
          "Awaiting Evaluation",
          "Ready for Review",
          "Inconclusive",
          "Needs Attention",
          "Reviewed",
        ].map((item) => (
          <button
            className={filter === item ? "active" : ""}
            onClick={() => setFilter(item)}
            key={item}
          >
            {item}
          </button>
        ))}
      </div>
      {validEvaluation && session?.submittedAt && visible ? (
        <div className="actual-queue card">
          <div className="actual-queue-head">
            <strong>Submitted assessments</strong>
            <span>1 actual local record</span>
          </div>
          <div className="actual-queue-row">
            <span className="candidate-avatar">AM</span>
            <div>
              <strong>{validEvaluation.candidateName}</strong>
              <small>
                {validEvaluation.companyName} · {validEvaluation.assessmentTitle}
              </small>
            </div>
            <div>
              <small>Submitted</small>
              <strong>{new Date(validEvaluation.submissionTimestamp).toLocaleString()}</strong>
            </div>
            <EvalStatus status={status} />
            <div>
              <small>Evidence coverage</small>
              <strong>{validEvaluation.evidenceCoverage}%</strong>
            </div>
            <button onClick={() => go(`/recruiter/reports/${validEvaluation.id}`)}>
              Open report <EIcon name="arrow" />
            </button>
          </div>
        </div>
      ) : (
        <EmptyEvaluation
          title={
            filter === "All" ? "No submitted assessments" : `No ${filter.toLowerCase()} reviews`
          }
          copy={
            filter === "All"
              ? "A submitted candidate session will appear here after deterministic evaluation."
              : "No actual local submission currently matches this filter."
          }
        />
      )}
    </>
  );
}

export function CandidateFeedbackPage({
  session,
  evaluation,
}: {
  session: AssessmentSession | null;
  evaluation: EvaluationRecord | null;
}) {
  if (
    !session?.submittedAt ||
    !evaluation ||
    evaluation.sessionId !== session.sessionId ||
    !evaluation.candidateFeedbackAvailable
  )
    return (
      <>
        <div className="eval-page-header">
          <div>
            <span>Candidate workspace</span>
            <h1>Feedback & Learning</h1>
            <p>Evidence-based feedback will appear after a submitted assessment is evaluated.</p>
          </div>
        </div>
        <EmptyEvaluation
          title="No assessment feedback available"
          copy="Submit the NovaTech coding challenge to generate local, deterministic feedback."
        />
      </>
    );
  const visible = evaluation.criteria.filter((criterion) => criterion.candidateVisible);
  const strengths = visible.filter(
    (criterion) => effectiveCriterionStatus(evaluation, criterion.id) === "Demonstrated",
  );
  const development = visible.filter(
    (criterion) => effectiveCriterionStatus(evaluation, criterion.id) !== "Demonstrated",
  );
  const recommendations: Record<string, string> = {
    "functional-correctness":
      "Practice completing one behavior at a time and rerun the public checks after each change.",
    "code-quality":
      "Refactor a small interface by separating UI state, domain transformations, and presentation styles.",
    "testing-debugging":
      "Use a repeatable diagnose-change-rerun loop and save a revision after meaningful fixes.",
    "problem-solving":
      "Write a short implementation plan and trade-off note before editing the next practice task.",
    "ai-collaboration":
      "When using AI guidance, document why a suggestion is correct and verify it with a focused check.",
  };
  return (
    <div className="candidate-evaluation-feedback">
      <div className="eval-page-header">
        <div>
          <span>Candidate workspace · Feedback v{evaluation.version}</span>
          <h1>Feedback & Learning</h1>
          <p>
            Based on available evidence from {evaluation.companyName} — {evaluation.taskTitle}.
          </p>
        </div>
        <span className="local-demo-label">
          <i></i>Deterministic demo feedback
        </span>
      </div>
      <div className="candidate-feedback-banner card">
        <span>
          <EIcon name="info" />
        </span>
        <div>
          <strong>Evidence describes this assessment session only.</strong>
          <p>
            Missing evidence is not proof of missing ability. No hiring decision or verified
            credential is generated.
          </p>
        </div>
      </div>
      <div className="feedback-summary-grid">
        <article className="card">
          <small>Evidence coverage</small>
          <strong>{evaluation.evidenceCoverage}%</strong>
          <p>{evaluation.evidence.length} normalized local records</p>
        </article>
        <article className="card">
          <small>Submitted snapshot</small>
          <strong>{evaluation.submissionRevisionId}</strong>
          <p>{new Date(evaluation.submissionTimestamp).toLocaleDateString()}</p>
        </article>
        <article className="card">
          <small>Evaluation method</small>
          <strong>Rule-based demo</strong>
          <p>No external evaluation model</p>
        </article>
      </div>
      <section className="feedback-section">
        <div>
          <span>Demonstrated strengths</span>
          <h2>Supported by available evidence</h2>
        </div>
        {strengths.length ? (
          <div className="feedback-card-grid">
            {strengths.map((criterion) => (
              <article className="card feedback-eval-card strength" key={criterion.id}>
                <span>
                  <EIcon name="check" />
                </span>
                <h3>{criterion.name}</h3>
                <p>{criterion.explanation}</p>
                <small>{criterion.evidenceIds.length} supporting evidence references</small>
              </article>
            ))}
          </div>
        ) : (
          <div className="feedback-honest-empty card">
            <EIcon name="info" />
            <div>
              <strong>No criterion is marked fully demonstrated.</strong>
              <p>
                The available records support partial or inconclusive findings only. This is not a
                statement about your overall ability.
              </p>
            </div>
          </div>
        )}
      </section>
      <section className="feedback-section">
        <div>
          <span>Development and evidence gaps</span>
          <h2>What the current record supports</h2>
        </div>
        <div className="feedback-card-grid">
          {development.map((criterion) => (
            <article className="card feedback-eval-card" key={criterion.id}>
              <EvalStatus
                status={effectiveCriterionStatus(evaluation, criterion.id) ?? criterion.status}
              />
              <h3>{criterion.name}</h3>
              <p>{criterion.explanation}</p>
              {criterion.missingEvidence.length > 0 && (
                <div>
                  <strong>Evidence gap</strong>
                  <span>{criterion.missingEvidence[0]}</span>
                </div>
              )}
              <div className="practice-recommendation">
                <strong>Suggested practice</strong>
                <p>{recommendations[criterion.id]}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="card feedback-limitations">
        <h2>How to interpret this feedback</h2>
        {evaluation.limitations.map((item) => (
          <p key={item}>
            <EIcon name="info" />
            {item}
          </p>
        ))}
      </section>
    </div>
  );
}
