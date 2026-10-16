import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  Assessment,
  AssessmentSession,
  candidateAssessments,
  candidates,
  reports,
  reviewQueue,
  Role,
  Rubric,
  seedRubrics,
  Session,
  practiceTasks,
  PracticeSession,
  PracticeTask,
  FREE_PRACTICE_ATTEMPTS,
  CandidateAssignment,
  candidateAssignments as initialCandidateAssignments,
} from "./data";
import { AuthProvider, useAuth } from "./lib/auth";
import { getErrorMessage } from "./lib/api";
import { assessmentsApi, authApi, organizationsApi } from "./lib/api-endpoints";
import { resolveInitialOrganizationId, slugify } from "./lib/organizations";
import type { OrganizationWithRole, CreateOrganizationRequest } from "@contracts/auth";
import {
  apiAssessmentToUi,
  toCreateAssessmentRequest,
  toUpdateAssessmentRequest,
} from "./lib/adapters";
import {
  AssessmentDetails,
  AssessmentOnboarding,
  AssignedAssessmentsV2,
  CandidateAssignmentCards,
  CandidateHistoryV2,
  getAssignment,
  SubmissionConfirmation,
} from "./assessment";
import IdeWorkspace from "./ide";
import {
  createEvaluation,
  EvaluationRecord,
  EVALUATION_RUBRIC_VERSION,
  EVALUATOR_VERSION,
} from "./evidence";
import {
  CandidateFeedbackPage,
  RecruiterReportsPage,
  RecruiterReviewQueuePage,
} from "./evaluation";

type IconName =
  | "activity"
  | "arrow"
  | "assessment"
  | "bell"
  | "briefcase"
  | "check"
  | "chevron"
  | "code"
  | "dashboard"
  | "eye"
  | "file"
  | "history"
  | "learning"
  | "logout"
  | "menu"
  | "people"
  | "plus"
  | "report"
  | "search"
  | "shield"
  | "spark"
  | "target"
  | "test"
  | "user"
  | "x";

const iconPaths: Record<IconName, ReactNode> = {
  activity: (
    <>
      <path d="M4 12h3l2-7 4 14 2-7h5" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </>
  ),
  assessment: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V4h8v3M3 12h18M10 12v2h4v-2" />
    </>
  ),
  check: <path d="M5 12l4 4L19 6" />,
  chevron: <path d="M9 18l6-6-6-6" />,
  code: (
    <>
      <path d="M9 18l-6-6 6-6M15 6l6 6-6 6" />
    </>
  ),
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
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
      <path d="M14 2v5h5M9 12h6M9 16h6" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 109-9 9 9 0 00-7 3.3L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </>
  ),
  learning: (
    <>
      <path d="M4 19V5a2 2 0 012-2h12a2 2 0 012 2v14a2 2 0 00-2-2H6a2 2 0 00-2 2z" />
      <path d="M8 7h8M8 11h6" />
    </>
  ),
  logout: (
    <>
      <path d="M10 17l5-5-5-5M15 12H3M14 4h5a2 2 0 012 2v12a2 2 0 01-2 2h-5" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  people: (
    <>
      <circle cx="9" cy="8" r="4" />
      <path d="M3 21v-2a6 6 0 0112 0v2M16 4a4 4 0 010 8M17 15a6 6 0 014 5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
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
  spark: (
    <>
      <path d="M12 3l1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4zM19 16l.6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6z" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  test: (
    <>
      <path d="M9 3v5l-5 9a3 3 0 003 4h10a3 3 0 003-4l-5-9V3M7 14h10M8 3h8" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0116 0" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6L6 18" />,
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPaths[name]}
    </svg>
  );
}

function navigate(path: string) {
  if (window.location.pathname === path) return;
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function Button({
  children,
  onClick,
  variant = "primary",
  type = "button",
  icon,
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  type?: "button" | "submit";
  icon?: IconName;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      className={`btn btn-${variant} ${className}`}
      type={type}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <button
      className={`brand ${compact ? "brand-compact" : ""}`}
      onClick={() => navigate("/")}
      aria-label="DevForge.ai home"
    >
      <span className="brand-mark">
        <span>&lt;</span>
        <i></i>
        <span>/&gt;</span>
      </span>
      {!compact && (
        <span>
          DevForge<span>.ai</span>
        </span>
      )}
    </button>
  );
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "info" | "warning" | "danger";
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function DemoTag() {
  return (
    <span className="demo-tag">
      <span></span>Demo data
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  error,
  required,
  children,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  error?: string;
  required?: boolean;
  children?: ReactNode;
}) {
  return (
    <label className={`field ${error ? "field-error" : ""}`}>
      <span>
        {label}
        {required && <b> *</b>}
      </span>
      <div className="field-control">
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-invalid={!!error}
        />
        {children}
      </div>
      {error && <small>{error}</small>}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  required?: boolean;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <b> *</b>}
      </span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select an option</option>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  error,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
}) {
  return (
    <label className={`field ${error ? "field-error" : ""}`}>
      <span>
        {label}
        {required && <b> *</b>}
      </span>
      <textarea
        rows={5}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      {error && <small>{error}</small>}
    </label>
  );
}

function EmptyState({ title, copy, action }: { title: string; copy: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name="file" size={24} />
      </span>
      <h3>{title}</h3>
      <p>{copy}</p>
      {action}
    </div>
  );
}

function OrganizationOnboarding({
  organizations,
  selectedOrganizationId,
  onSelect,
  onCreate,
}: {
  organizations: OrganizationWithRole[];
  selectedOrganizationId: string | null;
  onSelect: (id: string) => void;
  onCreate: (data: CreateOrganizationRequest) => Promise<OrganizationWithRole>;
}) {
  const [mode, setMode] = useState<"select" | "create">(organizations.length ? "select" : "create");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const finalSlug = slug.trim() || slugify(name);
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Organization name is required.";
    if (!/^[a-z0-9-]+$/.test(finalSlug)) next.slug = "Use lowercase letters, numbers, and hyphens.";
    if (billingEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(billingEmail))
      next.billingEmail = "Enter a valid email address.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      await onCreate({
        name: name.trim(),
        slug: finalSlug,
        description: description.trim() || undefined,
        billingEmail: billingEmail.trim() || undefined,
      });
    } catch (error) {
      setErrors({ form: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  if (mode === "select" && organizations.length > 0) {
    return (
      <>
        <PageHeader
          eyebrow="Workspace setup"
          title="Choose an organization"
          copy="Select the organization you want to work in. You can switch at any time from the sidebar."
        />
        <div className="card">
          <div className="flex flex-col gap-3">
            {organizations.map((org) => (
              <button
                key={org.id}
                type="button"
                className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left transition ${
                  org.id === selectedOrganizationId
                    ? "border-emerald-400 bg-emerald-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
                onClick={() => onSelect(org.id)}
              >
                <span className="flex flex-col">
                  <strong>{org.name}</strong>
                  <small className="text-slate-500">
                    {org.slug} · {org.userRole}
                  </small>
                </span>
                {org.id === selectedOrganizationId && <Icon name="check" />}
              </button>
            ))}
          </div>
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setMode("create")} icon="plus">
              Create another organization
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Workspace setup"
        title="Create your organization"
        copy="Set up the organization that will own your assessments and candidate pipeline."
      />
      <div className="form-layout">
        <form className="card assessment-form" onSubmit={submit}>
          <div className="form-section">
            <h2>Organization details</h2>
            <p>These details identify your hiring workspace across the platform.</p>
            <Field
              label="Organization name"
              value={name}
              onChange={(value) => {
                setName(value);
                if (!slugEdited) setSlug(slugify(value));
              }}
              placeholder="e.g. Acme Hiring"
              error={errors.name}
              required
            />
            <Field
              label="Workspace URL"
              value={slug}
              onChange={(value) => {
                setSlugEdited(true);
                setSlug(value);
              }}
              placeholder="acme-hiring"
              error={errors.slug}
              required
            />
            <TextAreaField
              label="Description"
              value={description}
              onChange={setDescription}
              placeholder="What kind of roles are you hiring for?"
            />
            <Field
              label="Billing email"
              value={billingEmail}
              onChange={setBillingEmail}
              placeholder="billing@acme.com"
              error={errors.billingEmail}
            />
            {errors.form && <small className="standalone-error">{errors.form}</small>}
          </div>
          <div className="form-actions">
            {organizations.length > 0 && (
              <Button variant="ghost" onClick={() => setMode("select")}>
                Back
              </Button>
            )}
            <Button type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create organization"}
            </Button>
          </div>
        </form>
        <aside className="card form-help">
          <span className="feature-icon">
            <Icon name="briefcase" />
          </span>
          <h2>You will be the owner</h2>
          <p>
            Creating an organization makes you its owner, with full control over assessments and
            team members. This is stored securely on the server.
          </p>
        </aside>
      </div>
    </>
  );
}

const candidateNav = [
  {
    label: "Dashboard",
    path: "/candidate/dashboard",
    icon: "dashboard" as IconName,
  },
  {
    label: "Practice Lab",
    path: "/candidate/practice",
    icon: "code" as IconName,
  },
  {
    label: "Assigned Assessments",
    path: "/candidate/assessments",
    icon: "assessment" as IconName,
  },
  {
    label: "Assessment History",
    path: "/candidate/history",
    icon: "history" as IconName,
  },
  {
    label: "Skill Passport",
    path: "/candidate/passport",
    icon: "shield" as IconName,
  },
  {
    label: "Feedback & Learning",
    path: "/candidate/learning",
    icon: "learning" as IconName,
  },
];

const recruiterNav = [
  {
    label: "Overview",
    path: "/recruiter/dashboard",
    icon: "dashboard" as IconName,
  },
  {
    label: "Assessments",
    path: "/recruiter/assessments",
    icon: "assessment" as IconName,
  },
  {
    label: "Candidates",
    path: "/recruiter/candidates",
    icon: "people" as IconName,
  },
  { label: "Reports", path: "/recruiter/reports", icon: "report" as IconName },
  {
    label: "Tasks & Rubrics",
    path: "/recruiter/tasks",
    icon: "target" as IconName,
  },
  {
    label: "Review Queue",
    path: "/recruiter/review",
    icon: "activity" as IconName,
  },
];

function AppShell({
  session,
  path,
  logout,
  children,
  organizations,
  selectedOrganizationId,
  onSelectOrganization,
}: {
  session: Session;
  path: string;
  logout: () => void;
  children: ReactNode;
  organizations?: OrganizationWithRole[];
  selectedOrganizationId?: string | null;
  onSelectOrganization?: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const nav = session.role === "candidate" ? candidateNav : recruiterNav;
  const active = [...nav].reverse().find((item) => path.startsWith(item.path)) ?? nav[0];
  useEffect(() => {
    setMenuOpen(false);
  }, [path]);
  return (
    <div className="app-shell">
      {menuOpen && (
        <button
          className="mobile-overlay"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-head">
          <Brand />
          <button
            className="icon-btn mobile-only"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation"
          >
            <Icon name="x" />
          </button>
        </div>
        <div className="role-pill">
          <span>
            <Icon name={session.role === "candidate" ? "user" : "briefcase"} />
          </span>
          <div>
            <small>Workspace</small>
            <strong>{session.role === "candidate" ? "Candidate" : "Recruiter"}</strong>
          </div>
        </div>
        {session.role === "recruiter" && organizations && organizations.length > 0 && (
          <div className="mt-2 rounded-lg border border-slate-200 px-3 py-2">
            <small className="block text-xs uppercase tracking-wide text-slate-400">
              Organization
            </small>
            {organizations.length === 1 ? (
              <strong className="text-sm">{organizations[0].name}</strong>
            ) : (
              <select
                aria-label="Select organization"
                className="w-full bg-transparent text-sm font-semibold outline-none"
                value={selectedOrganizationId ?? ""}
                onChange={(event) => onSelectOrganization?.(event.target.value)}
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
        <nav className="side-nav" aria-label={`${session.role} navigation`}>
          {nav.map((item) => (
            <button
              key={item.path}
              className={path.startsWith(item.path) ? "active" : ""}
              onClick={() => navigate(item.path)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="demo-notice">
            <Icon name="spark" />
            <div>
              <strong>Demo workspace</strong>
              <small>Illustrative data only</small>
            </div>
          </div>
          <button className="logout-link" onClick={logout}>
            <Icon name="logout" />
            <span>Log out</span>
          </button>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-btn menu-btn"
              onClick={() => setMenuOpen(true)}
              aria-label="Open navigation"
            >
              <Icon name="menu" />
            </button>
            <div>
              <span>
                {session.role === "candidate" ? "Candidate workspace" : "Hiring workspace"}
              </span>
              <strong>{active.label}</strong>
            </div>
          </div>
          <div className="topbar-actions">
            <div
              className="icon-btn notification"
              aria-label="Notifications: no new alerts"
              role="img"
            >
              <Icon name="bell" />
              <span></span>
            </div>
            <div className="profile-wrap">
              <button
                className="profile-button"
                onClick={() => setProfileOpen(!profileOpen)}
                aria-expanded={profileOpen}
              >
                <span className="avatar">
                  {session.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")}
                </span>
                <span className="profile-copy">
                  <strong>{session.name}</strong>
                  <small>{session.role}</small>
                </span>
                <Icon name="chevron" size={15} />
              </button>
              {profileOpen && (
                <div className="profile-menu">
                  <div>
                    <strong>{session.name}</strong>
                    <small>{session.email}</small>
                  </div>
                  <button onClick={logout}>
                    <Icon name="logout" />
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="workspace">{children}</main>
      </div>
    </div>
  );
}

function PublicHeader() {
  const [open, setOpen] = useState(false);
  const scroll = (id: string) => {
    if (window.location.pathname !== "/") {
      navigate("/");
      window.setTimeout(
        () => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }),
        50,
      );
    } else document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setOpen(false);
  };
  return (
    <header className="public-header">
      <div className="public-nav">
        <Brand />
        <button className="public-menu" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          <Icon name={open ? "x" : "menu"} />
        </button>
        <nav className={open ? "open" : ""}>
          <button onClick={() => scroll("product")}>Product</button>
          <button onClick={() => scroll("how")}>How it works</button>
          <button onClick={() => scroll("candidates")}>For candidates</button>
          <button onClick={() => scroll("recruiters")}>For recruiters</button>
          <div className="nav-actions">
            <Button variant="ghost" onClick={() => navigate("/roles")}>
              Log in
            </Button>
            <Button onClick={() => navigate("/roles")}>
              Get started <Icon name="arrow" />
            </Button>
          </div>
        </nav>
      </div>
    </header>
  );
}

function Landing() {
  return (
    <div className="public-page">
      <PublicHeader />
      <section className="hero" id="product">
        <div className="hero-grid">
          <div className="hero-copy">
            <Badge tone="info">
              <Icon name="spark" size={14} /> Evidence, not guesswork
            </Badge>
            <h1>
              Prove Your Coding Skills.
              <br />
              <span>Show How You Think.</span>
            </h1>
            <p>
              DevForge.ai evaluates more than the final code. Capture problem-solving, AI
              collaboration, testing, debugging, and the evidence behind every assessment outcome.
            </p>
            <div className="hero-actions">
              <Button onClick={() => navigate("/login/candidate")}>
                Continue as Candidate <Icon name="arrow" />
              </Button>
              <Button variant="secondary" onClick={() => navigate("/login/recruiter")}>
                Continue as Recruiter
              </Button>
            </div>
            <div className="hero-proof">
              <span>
                <Icon name="check" /> Transparent evaluation
              </span>
              <span>
                <Icon name="check" /> Responsible AI use
              </span>
              <span>
                <Icon name="check" /> Skills in context
              </span>
            </div>
          </div>
          <div className="product-preview" aria-label="DevForge.ai product preview">
            <div className="preview-top">
              <div>
                <span></span>
                <span></span>
                <span></span>
              </div>
              <small>Live assessment · Demo</small>
            </div>
            <div className="preview-body">
              <div className="preview-side">
                <div className="mini-logo">&lt;/&gt;</div>
                <i></i>
                <i></i>
                <i></i>
                <i></i>
              </div>
              <div className="preview-main">
                <div className="preview-title">
                  <div>
                    <small>FRONTEND ASSESSMENT</small>
                    <strong>Build a task manager</strong>
                  </div>
                  <Badge tone="success">Tests 6/8</Badge>
                </div>
                <div className="editor">
                  <div className="code-lines">
                    <span>1</span>
                    <code>
                      <b>function</b> TaskBoard() &#123;
                    </code>
                    <span>2</span>
                    <code>
                      &nbsp; <b>const</b> [tasks, setTasks] = useState([])
                    </code>
                    <span>3</span>
                    <code>
                      &nbsp; <em>// Verify status updates</em>
                    </code>
                    <span>4</span>
                    <code>
                      &nbsp; <b>return</b> &lt;Board tasks=&#123;tasks&#125; /&gt;
                    </code>
                    <span>5</span>
                    <code>&#125;</code>
                  </div>
                  <div className="evidence-panel">
                    <small>EVIDENCE SIGNALS</small>
                    <div>
                      <Icon name="test" />
                      <span>
                        <strong>Test-driven iteration</strong>
                        <small>3 meaningful test runs</small>
                      </span>
                    </div>
                    <div>
                      <Icon name="spark" />
                      <span>
                        <strong>AI code verified</strong>
                        <small>Candidate revised output</small>
                      </span>
                    </div>
                    <div>
                      <Icon name="activity" />
                      <span>
                        <strong>Debugging trail</strong>
                        <small>Issue isolated and fixed</small>
                      </span>
                    </div>
                  </div>
                </div>
                <div className="preview-report">
                  <span>
                    <Icon name="report" />
                  </span>
                  <div>
                    <small>RECRUITER REPORT</small>
                    <strong>Evidence-linked skill summary is ready</strong>
                  </div>
                  <Button variant="secondary" onClick={() => navigate("/login/recruiter")}>
                    Preview report
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="trust-strip">
        <p>Designed for a fairer signal in modern technical hiring</p>
        <div>
          <span>Product teams</span>
          <span>Engineering leaders</span>
          <span>Talent partners</span>
          <span>Growing startups</span>
        </div>
      </section>
      <section className="section" id="how">
        <div className="section-heading">
          <Badge tone="info">How it works</Badge>
          <h2>One assessment. A clearer view of capability.</h2>
          <p>See the journey behind the solution, not only the output at the end.</p>
        </div>
        <div className="steps">
          {[
            [
              "01",
              "Build",
              "Candidates solve realistic coding tasks with optional AI assistance in a structured workspace.",
              "code",
            ],
            [
              "02",
              "Verify",
              "Tests, code changes, and problem-solving evidence help demonstrate what actually works.",
              "test",
            ],
            [
              "03",
              "Evaluate",
              "Recruiters review evidence-backed skill signals through a consistent, transparent rubric.",
              "report",
            ],
          ].map(([number, title, copy, icon]) => (
            <article className="step-card" key={title}>
              <span className="step-number">{number}</span>
              <span className="feature-icon">
                <Icon name={icon as IconName} />
              </span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="section feature-section">
        <div className="section-heading">
          <Badge tone="neutral">Built for the AI era</Badge>
          <h2>Better evidence for both sides of the hiring table.</h2>
        </div>
        <div className="feature-grid">
          <article className="feature-card dark">
            <div>
              <Badge tone="info">AI coding workspace</Badge>
              <h3>Use AI. Show your judgment.</h3>
              <p>
                Capture how candidates prompt, verify, adapt, and understand generated code without
                treating AI usage as a shortcut.
              </p>
            </div>
            <div className="prompt-demo">
              <small>AI collaboration trail</small>
              <p>“Add error handling, but keep the existing retry behavior.”</p>
              <span>
                <Icon name="check" /> Candidate reviewed and revised suggestion
              </span>
            </div>
          </article>
          <article className="feature-card">
            <span className="feature-icon">
              <Icon name="activity" />
            </span>
            <h3>Development journey capture</h3>
            <p>
              Connect planning, code changes, test activity, and debugging decisions into a coherent
              work story.
            </p>
            <div className="timeline-mini">
              <i></i>
              <span>Plan</span>
              <i></i>
              <span>Build</span>
              <i></i>
              <span>Verify</span>
            </div>
          </article>
          <article className="feature-card">
            <span className="feature-icon">
              <Icon name="shield" />
            </span>
            <h3>Evidence-backed reports</h3>
            <p>
              Give every skill signal context, supporting actions, and transparent rubric criteria.
            </p>
            <div className="score-mini">
              <span>Problem solving</span>
              <b>Strong signal</b>
              <div>
                <i></i>
              </div>
            </div>
          </article>
        </div>
      </section>
      <section className="section audience" id="candidates">
        <div className="audience-card">
          <div>
            <Badge tone="info">For candidates</Badge>
            <h2>Let your process tell the full story.</h2>
            <p>
              Build confidence in a realistic environment and show the thoughtful work that a résumé
              cannot capture.
            </p>
            <ul>
              <li>
                <Icon name="check" /> Practice in a realistic coding environment
              </li>
              <li>
                <Icon name="check" /> Demonstrate responsible AI usage
              </li>
              <li>
                <Icon name="check" /> Receive actionable learning guidance
              </li>
            </ul>
            <Button onClick={() => navigate("/login/candidate")}>
              Explore candidate experience <Icon name="arrow" />
            </Button>
          </div>
          <div className="audience-visual candidate-visual">
            <span className="avatar large">AM</span>
            <strong>Alex's skill snapshot</strong>
            {["Problem solving", "Code quality", "Testing & debugging"].map((skill, index) => (
              <div key={skill}>
                <span>{skill}</span>
                <b>{[82, 76, 88][index]}%</b>
                <i>
                  <em style={{ width: `${[82, 76, 88][index]}%` }} />
                </i>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="section audience" id="recruiters">
        <div className="audience-card reverse">
          <div>
            <Badge tone="info">For recruiters</Badge>
            <h2>Move from coding scores to skill evidence.</h2>
            <p>
              Create role-relevant assessments and compare candidates with consistent, reviewable
              context.
            </p>
            <ul>
              <li>
                <Icon name="check" /> Create focused technical assessments
              </li>
              <li>
                <Icon name="check" /> Review testing and reasoning outcomes
              </li>
              <li>
                <Icon name="check" /> Compare candidates with one rubric
              </li>
            </ul>
            <Button onClick={() => navigate("/login/recruiter")}>
              Explore recruiter workspace <Icon name="arrow" />
            </Button>
          </div>
          <div className="audience-visual report-visual">
            <div className="report-head">
              <span>
                <Icon name="report" />
              </span>
              <div>
                <small>EVIDENCE REPORT</small>
                <strong>Frontend evaluation</strong>
              </div>
              <Badge tone="success">Ready</Badge>
            </div>
            {["Solution design", "Implementation", "Verification"].map((item) => (
              <div className="report-row" key={item}>
                <Icon name="check" />
                <span>{item}</span>
                <Badge tone="neutral">Evidence linked</Badge>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="cta-band">
        <div>
          <h2>Ready to see more than the final answer?</h2>
          <p>Enter the DevForge.ai demo as a candidate or recruiter.</p>
        </div>
        <Button onClick={() => navigate("/roles")}>
          Get started with the demo <Icon name="arrow" />
        </Button>
      </section>
      <footer>
        <div className="footer-main">
          <div>
            <Brand />
            <p>Evidence-backed coding assessment for the AI era.</p>
            <small>
              Phase 1 demonstration product. No production authentication or verified evaluation is
              provided.
            </small>
          </div>
          <div>
            <strong>Product</strong>
            <button onClick={() => navigate("/roles")}>Get started</button>
            <button onClick={() => navigate("/login/candidate")}>Candidate login</button>
            <button onClick={() => navigate("/login/recruiter")}>Recruiter login</button>
          </div>
          <div>
            <strong>Explore</strong>
            <button
              onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}
            >
              How it works
            </button>
            <button
              onClick={() =>
                document.getElementById("candidates")?.scrollIntoView({ behavior: "smooth" })
              }
            >
              For candidates
            </button>
            <button
              onClick={() =>
                document.getElementById("recruiters")?.scrollIntoView({ behavior: "smooth" })
              }
            >
              For recruiters
            </button>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2025 DevForge.ai</span>
          <span>Demo environment · Illustrative data only</span>
        </div>
      </footer>
    </div>
  );
}

function RoleSelection() {
  return (
    <div className="auth-page">
      <div className="auth-brand">
        <Brand />
      </div>
      <div className="role-shell">
        <div className="auth-heading">
          <Badge tone="info">Choose your workspace</Badge>
          <h1>How would you like to continue?</h1>
          <p>Select a role to enter the appropriate DevForge.ai demo experience.</p>
        </div>
        <div className="role-grid">
          <article className="role-card">
            <span className="role-icon candidate">
              <Icon name="code" size={26} />
            </span>
            <h2>Candidate</h2>
            <p>Practice, complete assessments, and review your skill development.</p>
            <ul>
              <li>
                <Icon name="check" /> Assigned assessments
              </li>
              <li>
                <Icon name="check" /> Practice and feedback
              </li>
              <li>
                <Icon name="check" /> Skill profile preview
              </li>
            </ul>
            <Button onClick={() => navigate("/login/candidate")}>
              Continue as Candidate <Icon name="arrow" />
            </Button>
          </article>
          <article className="role-card">
            <span className="role-icon recruiter">
              <Icon name="briefcase" size={26} />
            </span>
            <h2>Recruiter</h2>
            <p>Create assessments, manage candidates, and review evaluation evidence.</p>
            <ul>
              <li>
                <Icon name="check" /> Assessment management
              </li>
              <li>
                <Icon name="check" /> Candidate review
              </li>
              <li>
                <Icon name="check" /> Evidence reports
              </li>
            </ul>
            <Button onClick={() => navigate("/login/recruiter")}>
              Continue as Recruiter <Icon name="arrow" />
            </Button>
          </article>
        </div>
        <Button variant="ghost" onClick={() => navigate("/")}>
          <span className="back-arrow">←</span> Back to home
        </Button>
      </div>
    </div>
  );
}

function Login({
  role,
  onLogin,
  onSignUp,
}: {
  role: Role;
  onLogin: (email: string, password: string, role: Role) => Promise<void>;
  onSignUp: (email: string, password: string, role: Role, fullName: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!email.trim()) nextErrors.email = "Enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      nextErrors.email = "Enter a valid email address.";
    if (!password) nextErrors.password = "Enter your password.";
    if (isSignUp && !fullName.trim()) nextErrors.fullName = "Enter your full name.";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setSubmitting(true);
    try {
      if (isSignUp) {
        await onSignUp(email.trim(), password, role, fullName.trim());
      } else {
        await onLogin(email.trim(), password, role);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : isSignUp
            ? "Sign up failed."
            : "Sign in failed. Check your credentials.";
      setErrors({ form: message });
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="auth-page login-page">
      <div className="auth-brand">
        <Brand />
      </div>
      <div className="login-layout">
        <div className="login-story">
          <Badge tone="info">
            {role === "candidate" ? "Candidate workspace" : "Recruiter workspace"}
          </Badge>
          <h1>
            {role === "candidate"
              ? "Show the work behind your skills."
              : "See the evidence behind every outcome."}
          </h1>
          <p>
            {role === "candidate"
              ? "Complete realistic tasks, demonstrate your reasoning, and turn your coding process into a stronger signal."
              : "Manage role-relevant assessments and review candidate work with consistent, evidence-linked context."}
          </p>
          <div className="story-card">
            <span>
              <Icon name={role === "candidate" ? "code" : "report"} />
            </span>
            <div>
              <strong>
                {role === "candidate" ? "Your process matters" : "Clarity for every review"}
              </strong>
              <p>
                {role === "candidate"
                  ? "Planning, iteration, testing, and debugging are all part of the story."
                  : "Move beyond pass/fail results with structured skill evidence."}
              </p>
            </div>
          </div>
        </div>
        <div className="login-card">
          <button className="back-link" onClick={() => navigate("/roles")}>
            ← Back to role selection
          </button>
          <div>
            <span className={`role-icon ${role}`}>
              <Icon name={role === "candidate" ? "user" : "briefcase"} />
            </span>
            <h2>
              {isSignUp
                ? `Create ${role === "candidate" ? "Candidate" : "Recruiter"} Account`
                : `Welcome back, ${role === "candidate" ? "Candidate" : "Recruiter"}.`}
            </h2>
            <p>
              {isSignUp
                ? "Enter your details to create an account."
                : "Sign in to continue to your workspace."}
            </p>
          </div>
          <form onSubmit={submit} noValidate>
            {errors.form && (
              <div className="form-alert">
                <Icon name="activity" />
                {errors.form}
              </div>
            )}
            {isSignUp && (
              <Field
                label="Full name"
                value={fullName}
                onChange={(value) => {
                  setFullName(value);
                  setErrors({});
                }}
                placeholder="Your name"
                type="text"
                error={errors.fullName}
                required
              />
            )}
            <Field
              label="Email address"
              value={email}
              onChange={(value) => {
                setEmail(value);
                setErrors({});
              }}
              placeholder="you@example.com"
              type="email"
              error={errors.email}
              required
            />
            <Field
              label="Password"
              value={password}
              onChange={(value) => {
                setPassword(value);
                setErrors({});
              }}
              placeholder="Enter your password"
              type={showPassword ? "text" : "password"}
              error={errors.password}
              required
            >
              <button
                className="password-toggle"
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <Icon name="eye" />
              </button>
            </Field>
            <Button type="submit" disabled={submitting} className="full">
              {submitting
                ? isSignUp
                  ? "Creating account…"
                  : "Signing in…"
                : isSignUp
                  ? "Create account"
                  : "Sign in"}{" "}
              {!submitting && <Icon name="arrow" />}
            </Button>
          </form>
          <p className="auth-switch">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrors({});
              }}
            >
              {isSignUp ? "Sign in" : "Sign up"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function PageHeader({
  eyebrow,
  title,
  copy,
  action,
}: {
  eyebrow?: string;
  title: string;
  copy: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <span>{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{copy}</p>
      </div>
      {action}
    </div>
  );
}

function CandidateDashboardV2({
  session,

  candidateAssignments,
}: {
  session: AssessmentSession | null;

  candidateAssignments: CandidateAssignment[];
}) {
  return (
    <>
      <PageHeader
        eyebrow="Candidate workspace"
        title="Welcome back, Alex."
        copy="Review your assigned company challenges and continue from your actual demo session state."
        action={<DemoTag />}
      />
      <section className="dashboard-assignment-section">
        <div className="card-heading dashboard-section-heading">
          <div>
            <h2>Assigned assessments</h2>
            <p>Company names and invitations below are illustrative demo data.</p>
          </div>
          <Button variant="ghost" onClick={() => navigate("/candidate/assessments")}>
            View all <Icon name="arrow" />
          </Button>
        </div>
        <CandidateAssignmentCards session={session} compact assignments={candidateAssignments} />
      </section>
      <article className="card dashboard-practice-v2">
        <span className="feature-icon">
          <Icon name="test" />
        </span>
        <div>
          <Badge tone="success">Practice anytime</Badge>
          <h2>Sharpen skills without affecting assessment results.</h2>
          <p>Work through focused coding tasks in the existing Practice Lab.</p>
        </div>
        <Button variant="secondary" onClick={() => navigate("/candidate/practice")}>
          Explore Practice Lab <Icon name="arrow" />
        </Button>
      </article>
      <section className="three-column">
        <article className="card">
          <div className="card-heading">
            <div>
              <h2>Recent activity</h2>
              <p>Your latest demo workspace updates</p>
            </div>
            <Icon name="activity" />
          </div>
          <div className="activity-list">
            {(
              session?.activity
                .slice(-3)
                .reverse()
                .map((event) => [
                  event.type === "test_run" ? "test" : "code",
                  event.detail,
                  new Date(event.timestamp).toLocaleString(),
                ]) ?? [
                ["assessment", "New NovaTech assessment assigned", "Demo data"],
                ["learning", "Reviewed feedback on debugging", "Yesterday"],
              ]
            ).map(([icon, text, date]) => (
              <div key={`${text}-${date}`}>
                <span className="activity-icon">
                  <Icon name={icon as IconName} />
                </span>
                <p>
                  <strong>{text}</strong>
                  <small>{date}</small>
                </p>
              </div>
            ))}
          </div>
        </article>
        <article className="card skills-card">
          <div className="card-heading">
            <div>
              <h2>Workspace readiness</h2>
              <p>Phase 2 supported capabilities</p>
            </div>
            <DemoTag />
          </div>
          {[
            ["Task planning", 75],
            ["Code editing", 100],
            ["Deterministic checks", session?.testRuns.length ? 100 : 30],
            ["AI coach context", session?.coachMessages.length ? 100 : 30],
          ].map(([skill, score]) => (
            <div className="skill-bar" key={skill}>
              <div>
                <span>{skill}</span>
                <strong>{score}%</strong>
              </div>
              <i>
                <em style={{ width: `${score}%` }} />
              </i>
            </div>
          ))}
        </article>
        <article className="card feedback-card">
          <div className="card-heading">
            <div>
              <h2>Assessment guidance</h2>
              <p>Before beginning</p>
            </div>
            <span className="feature-icon small">
              <Icon name="shield" />
            </span>
          </div>
          <Badge tone="info">Transparent workflow</Badge>
          <h3>Read the activity disclosure</h3>
          <p>
            The timer starts only after acknowledgement. Supported actions and snapshots are stored
            locally in this browser.
          </p>
          <Button
            variant="secondary"
            onClick={() => navigate("/candidate/assessments/novatech-task-manager")}
          >
            View assessment details <Icon name="arrow" />
          </Button>
        </article>
      </section>
    </>
  );
}

function CandidatePractice({
  path,
  practiceSession,
  practiceAttempts,
  persistPracticeSession,
  setPracticeAttempts,
}: {
  path: string;
  practiceSession: PracticeSession | null;
  practiceAttempts: Record<string, number>;
  persistPracticeSession: (session: PracticeSession) => boolean;
  setPracticeAttempts: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}) {
  if (path !== "/candidate/practice") {
    const taskMatch = path.match(/^\/candidate\/practice\/([^/]+)$/);
    if (taskMatch) {
      const taskId = taskMatch[1];
      const task = practiceTasks.find((t) => t.id === taskId);
      if (task) {
        const attempts = practiceAttempts[taskId] ?? 0;
        const isFree = attempts < FREE_PRACTICE_ATTEMPTS;
        const sessionForTask = practiceSession?.taskId === taskId ? practiceSession : null;
        const status = sessionForTask?.completedAt
          ? "Completed"
          : sessionForTask
            ? "In Progress"
            : "Ready";
        return (
          <div className="intro-page">
            <button className="back-link" onClick={() => navigate("/candidate/practice")}>
              ← Back to Practice Lab
            </button>
            <div className="intro-card">
              <div className="intro-hero">
                <span className="role-icon candidate">
                  <Icon name="code" size={25} />
                </span>
                <Badge tone="info">Practice Task</Badge>
                <h1>{task.title}</h1>
                <p>{task.description}</p>
              </div>
              <div className="intro-details">
                <div>
                  <small>Estimated time</small>
                  <strong>{task.duration} minutes</strong>
                </div>
                <div>
                  <small>Difficulty</small>
                  <strong>{task.difficulty}</strong>
                </div>
                <div>
                  <small>Attempts used</small>
                  <strong>
                    {attempts} / {FREE_PRACTICE_ATTEMPTS} free
                  </strong>
                </div>
              </div>
              <div className="phase-notice">
                <Icon name="spark" />
                <div>
                  <strong>Practice mode — no assessment pressure</strong>
                  <p>
                    Your first {FREE_PRACTICE_ATTEMPTS} attempts are free. Additional practice
                    requires a subscription.
                  </p>
                </div>
              </div>
              <h2>What you'll practice</h2>
              <div className="check-grid">
                {task.skills.map((skill) => (
                  <span key={skill}>
                    <Icon name="check" />
                    {skill}
                  </span>
                ))}
              </div>
              {sessionForTask && !sessionForTask.completedAt ? (
                <Button onClick={() => navigate(`/candidate/practice/${taskId}/workspace`)}>
                  Resume Practice <Icon name="arrow" />
                </Button>
              ) : (
                <Button
                  disabled={!isFree && attempts >= FREE_PRACTICE_ATTEMPTS}
                  onClick={() => {
                    if (!isFree) return;
                    const nextAttempts = {
                      ...practiceAttempts,
                      [taskId]: attempts + 1,
                    };
                    setPracticeAttempts(nextAttempts);
                    localStorage.setItem(
                      "devforge-practice-attempts",
                      JSON.stringify(nextAttempts),
                    );
                    const now = new Date().toISOString();
                    const newSession: PracticeSession = {
                      sessionId: `practice-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                      taskId,
                      candidateId: "alex-morgan",
                      startedAt: now,
                      durationMinutes: task.duration,
                      currentFile: task.starterFiles[0]?.path ?? "src/index.js",
                      files: structuredClone(task.starterFiles),
                      savedFiles: structuredClone(task.starterFiles),
                      unsaved: false,
                      revisions: [
                        {
                          id: "revision-0",
                          timestamp: now,
                          files: structuredClone(task.starterFiles),
                        },
                      ],
                      runHistory: [],
                      testRuns: [],
                      activity: [
                        {
                          id: `event-${Date.now()}`,
                          type: "assessment_started",
                          timestamp: now,
                          detail: `Started practice task: ${task.title}`,
                          provenance: "candidate_action",
                        },
                        {
                          id: `event-${Date.now() + 1}`,
                          type: "file_opened",
                          timestamp: now,
                          file: task.starterFiles[0]?.path,
                          detail: `Opened ${task.starterFiles[0]?.path}`,
                          provenance: "system_generated",
                        },
                      ],
                      attemptNumber: attempts + 1,
                    };
                    if (persistPracticeSession(newSession)) {
                      navigate(`/candidate/practice/${taskId}/workspace`);
                    }
                  }}
                >
                  {sessionForTask && !sessionForTask.completedAt
                    ? "Resume Practice"
                    : isFree
                      ? "Start Practice"
                      : "Upgrade for more attempts"}{" "}
                  <Icon name="arrow" />
                </Button>
              )}
              {!isFree && attempts >= FREE_PRACTICE_ATTEMPTS && (
                <p className="upgrade-notice">
                  Free practice attempts used. Subscribe to continue practicing.
                </p>
              )}
            </div>
          </div>
        );
      }
    }
    return <IntroPlaceholder type="practice" />;
  }
  const totalAttempts = Object.values(practiceAttempts).reduce((a, b) => a + b, 0);
  const remainingFree = Math.max(0, FREE_PRACTICE_ATTEMPTS - totalAttempts);
  return (
    <>
      <PageHeader
        eyebrow="Practice Lab"
        title="Build skills through deliberate practice."
        copy="Focused demo tasks help you prepare without affecting assigned assessment outcomes."
        action={
          <>
            <Badge tone={remainingFree > 0 ? "success" : "warning"}>
              {remainingFree} free attempt{remainingFree !== 1 ? "s" : ""} remaining
            </Badge>
            <DemoTag />
          </>
        }
      />
      <div className="filters">
        <div className="search">
          <Icon name="search" />
          <input aria-label="Search practice tasks" placeholder="Search practice tasks" />
        </div>
        <select aria-label="Filter difficulty">
          <option>All difficulties</option>
          <option>Beginner</option>
          <option>Intermediate</option>
          <option>Advanced</option>
        </select>
      </div>
      <div className="card-grid">
        {practiceTasks.map((task) => {
          const attempts = practiceAttempts[task.id] ?? 0;
          const isFree = attempts < FREE_PRACTICE_ATTEMPTS;
          const sessionForTask = practiceSession?.taskId === task.id ? practiceSession : null;
          const status = sessionForTask?.completedAt
            ? "Completed"
            : sessionForTask
              ? "In Progress"
              : "Ready";
          return (
            <article className="card task-card" key={task.id}>
              <div>
                <span className="feature-icon">
                  <Icon name={task.difficulty === "Advanced" ? "test" : "code"} />
                </span>
                <Badge
                  tone={
                    task.difficulty === "Advanced"
                      ? "warning"
                      : task.difficulty === "Beginner"
                        ? "success"
                        : "info"
                  }
                >
                  {task.difficulty}
                </Badge>
              </div>
              <h2>{task.title}</h2>
              <p>{task.description}</p>
              <div className="task-skills">
                {task.skills.map((skill) => (
                  <span key={skill}>{skill}</span>
                ))}
              </div>
              <div className="task-footer">
                <span>
                  {task.duration} min · Attempt {attempts + 1}
                </span>
                <Button
                  variant="secondary"
                  disabled={!isFree && attempts >= FREE_PRACTICE_ATTEMPTS && !sessionForTask}
                  onClick={() => {
                    if (!isFree && attempts >= FREE_PRACTICE_ATTEMPTS && !sessionForTask) return;
                    navigate(`/candidate/practice/${task.id}`);
                  }}
                >
                  {sessionForTask && !sessionForTask.completedAt
                    ? "Resume"
                    : isFree
                      ? "Start"
                      : "Upgrade"}{" "}
                  <Icon name="arrow" />
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function IntroPlaceholder({ type = "assessment" }: { type?: "assessment" | "practice" }) {
  const assessment = type === "assessment";
  return (
    <div className="intro-page">
      <button
        className="back-link"
        onClick={() => navigate(assessment ? "/candidate/assessments" : "/candidate/practice")}
      >
        ← Back to {assessment ? "assessments" : "Practice Lab"}
      </button>
      <div className="intro-card">
        <div className="intro-hero">
          <span className="role-icon candidate">
            <Icon name={assessment ? "assessment" : "code"} size={25} />
          </span>
          <Badge tone="info">Phase 1 introduction</Badge>
          <h1>{assessment ? "Build a Team Task Manager" : "Practice task introduction"}</h1>
          <p>
            {assessment
              ? "Create a responsive team task manager, connect task updates to a provided API, and verify the workflow through meaningful tests."
              : "This practice task will provide a focused prompt, starter files, and a safe place to experiment."}
          </p>
        </div>
        <div className="intro-details">
          <div>
            <small>Estimated time</small>
            <strong>{assessment ? "45 minutes" : "25 minutes"}</strong>
          </div>
          <div>
            <small>Difficulty</small>
            <strong>Intermediate</strong>
          </div>
          <div>
            <small>Environment</small>
            <strong>React + JavaScript</strong>
          </div>
        </div>
        <div className="phase-notice">
          <Icon name="spark" />
          <div>
            <strong>The interactive coding workspace arrives in Phase 2.</strong>
            <p>
              This introduction is functional, but no editor, AI coach, code runner, hidden tests,
              or evidence capture is active in this phase.
            </p>
          </div>
        </div>
        <h2>What you’ll demonstrate</h2>
        <div className="check-grid">
          {[
            "Plan a clear component structure",
            "Implement core interactions",
            "Test important user flows",
            "Debug and explain decisions",
          ].map((item) => (
            <span key={item}>
              <Icon name="check" />
              {item}
            </span>
          ))}
        </div>
        <Button disabled>Launch workspace in Phase 2</Button>
      </div>
    </div>
  );
}

function AssignedAssessments() {
  return (
    <>
      <PageHeader
        eyebrow="Candidate workspace"
        title="Assigned assessments"
        copy="Review upcoming and submitted demo assessments in one place."
        action={<DemoTag />}
      />
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Assessment</th>
                <th>Skill focus</th>
                <th>Duration</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {candidateAssessments.map((item, index) => (
                <tr key={item.title}>
                  <td>
                    <strong>{item.title}</strong>
                    <small>
                      {index === 0 ? "Due May 30" : index === 1 ? "Due Jun 4" : "Submitted May 18"}
                    </small>
                  </td>
                  <td>{item.skills}</td>
                  <td>{item.duration}</td>
                  <td>
                    <Badge
                      tone={
                        item.status === "Submitted"
                          ? "success"
                          : item.status === "Ready"
                            ? "info"
                            : "warning"
                      }
                    >
                      {item.status}
                    </Badge>
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      onClick={() => navigate("/candidate/assessments/team-task-manager")}
                    >
                      {item.status === "Submitted" ? "View" : "Open"} <Icon name="arrow" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function CandidateHistory() {
  return (
    <>
      <PageHeader
        eyebrow="Candidate workspace"
        title="Assessment history"
        copy="A record of illustrative activity from the DevForge.ai demo."
        action={<DemoTag />}
      />
      <div className="card">
        <div className="list-head">
          <h2>Past activity</h2>
          <Badge tone="neutral">2 demo records</Badge>
        </div>
        <div className="history-list">
          {[
            ["Debug a Data Dashboard", "May 18, 2025", "Submitted", "Awaiting illustrative review"],
            ["JavaScript Fundamentals", "May 6, 2025", "Completed", "Demo feedback available"],
          ].map(([title, date, status, detail]) => (
            <div key={title}>
              <span className="activity-icon">
                <Icon name="history" />
              </span>
              <div>
                <strong>{title}</strong>
                <small>
                  {date} · {detail}
                </small>
              </div>
              <Badge tone={status === "Completed" ? "success" : "info"}>{status}</Badge>
            </div>
          ))}
        </div>
        <div className="info-strip">
          <Icon name="shield" />
          <p>
            These records are illustrative. DevForge.ai has not generated verified outcomes or
            credentials in this Phase 1 demo.
          </p>
        </div>
      </div>
    </>
  );
}

function SkillPassport() {
  return (
    <>
      <PageHeader
        eyebrow="Candidate workspace"
        title="Skill Passport"
        copy="A preview of how evidence-backed skill records could be presented in a future phase."
        action={<DemoTag />}
      />
      <div className="passport-grid">
        <article className="card passport-profile">
          <span className="avatar xl">AM</span>
          <h2>Alex Morgan</h2>
          <p>Frontend developer · Demo profile</p>
          <div className="passport-status">
            <Icon name="shield" />
            <div>
              <strong>Preview only</strong>
              <small>No verified credential has been issued.</small>
            </div>
          </div>
        </article>
        <article className="card passport-skills">
          <div className="card-heading">
            <div>
              <h2>Skill profile preview</h2>
              <p>Illustrative signals based on sample data</p>
            </div>
          </div>
          {[
            "Problem solving",
            "JavaScript",
            "Testing & debugging",
            "Code quality",
            "AI collaboration",
          ].map((skill, index) => (
            <div key={skill}>
              <span className="feature-icon small">
                <Icon name={index === 2 ? "test" : "check"} />
              </span>
              <p>
                <strong>{skill}</strong>
                <small>{index % 2 ? "Developing signal" : "Consistent signal"} · Demo only</small>
              </p>
              <Icon name="chevron" />
            </div>
          ))}
        </article>
      </div>
      <div className="phase-notice standalone">
        <Icon name="spark" />
        <div>
          <strong>Verified skill records are planned for a later phase.</strong>
          <p>
            Future versions will link each signal to assessment evidence, rubric criteria, and
            review status.
          </p>
        </div>
      </div>
    </>
  );
}

function LearningPage() {
  return (
    <>
      <PageHeader
        eyebrow="Candidate workspace"
        title="Feedback & Learning"
        copy="Turn illustrative assessment feedback into a focused practice plan."
        action={<DemoTag />}
      />
      <div className="learning-grid">
        <article className="card">
          <div className="card-heading">
            <div>
              <h2>Current learning plan</h2>
              <p>3 recommended focus areas</p>
            </div>
            <Badge tone="info">Demo plan</Badge>
          </div>
          {[
            [
              "Boundary-first testing",
              "Practice",
              "Identify edge cases before implementation begins.",
              40,
            ],
            [
              "Explain technical tradeoffs",
              "Reflect",
              "Compare two valid approaches and document the choice.",
              15,
            ],
            [
              "Verify AI suggestions",
              "Practice",
              "Review generated code for assumptions and failure states.",
              60,
            ],
          ].map(([title, kind, copy, progress]) => (
            <div className="learning-item" key={title}>
              <span className="activity-icon">
                <Icon name={kind === "Practice" ? "test" : "learning"} />
              </span>
              <div>
                <Badge tone="neutral">{kind}</Badge>
                <h3>{title}</h3>
                <p>{copy}</p>
                <i>
                  <em style={{ width: `${progress}%` }} />
                </i>
              </div>
              <strong>{progress}%</strong>
            </div>
          ))}
        </article>
        <aside className="card focus-panel">
          <Badge tone="warning">Recent feedback</Badge>
          <h2>Good debugging discipline</h2>
          <p>
            Your sample activity shows a structured approach to isolating failures. Next, document
            why the fix addresses the root cause.
          </p>
          <div>
            <small>Suggested next action</small>
            <strong>Complete “Fix an Async Search Race”</strong>
          </div>
          <Button onClick={() => navigate("/candidate/practice")}>
            Open Practice Lab <Icon name="arrow" />
          </Button>
        </aside>
      </div>
    </>
  );
}

function MetricCard({
  label,
  value,
  change,
  icon,
}: {
  label: string;
  value: string;
  change: string;
  icon: IconName;
}) {
  return (
    <article className="card metric-card">
      <div>
        <span className="feature-icon small">
          <Icon name={icon} />
        </span>
        <DemoTag />
      </div>
      <p>{label}</p>
      <strong>{value}</strong>
      <small>{change}</small>
    </article>
  );
}

function RecruiterDashboard({
  assessments,
  evaluation,
}: {
  assessments: Assessment[];
  evaluation: EvaluationRecord | null;
}) {
  const recent = assessments.slice(0, 3);
  return (
    <>
      <PageHeader
        eyebrow="Hiring workspace"
        title="Recruiter Overview"
        copy="Manage assessments and review candidate progress from one place."
        action={
          <Button onClick={() => navigate("/recruiter/assessments/new")} icon="plus">
            Create Assessment
          </Button>
        }
      />
      <div className="metrics">
        <MetricCard
          label="Active Assessments"
          value={String(assessments.filter((a) => a.status !== "Draft").length + 2)}
          change="Illustrative portfolio"
          icon="assessment"
        />
        <MetricCard label="Candidates in Progress" value="18" change="+3 this week" icon="people" />
        <MetricCard label="Submissions Received" value="12" change="+5 this week" icon="file" />
        <MetricCard label="Reviews Pending" value="5" change="2 high priority" icon="activity" />
      </div>
      {evaluation && (
        <article className="card dashboard-report-entry">
          <span className="feature-icon">
            <Icon name="report" />
          </span>
          <div>
            <small>Latest actual submission</small>
            <strong>
              {evaluation.candidateName} · {evaluation.assessmentTitle}
            </strong>
            <p>
              {new Date(evaluation.submissionTimestamp).toLocaleString()} ·{" "}
              {evaluation.evaluationStatus} · Human review {evaluation.reviewerStatus.toLowerCase()}
            </p>
          </div>
          <Button onClick={() => navigate(`/recruiter/reports/${evaluation.id}`)}>
            View Assessment Report <Icon name="arrow" />
          </Button>
        </article>
      )}
      <div className="recruiter-grid">
        <article className="card wide">
          <div className="card-heading">
            <div>
              <h2>Recent assessments</h2>
              <p>Latest activity across your demo assessment library</p>
            </div>
            <Button variant="ghost" onClick={() => navigate("/recruiter/assessments")}>
              View all <Icon name="arrow" />
            </Button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Assessment</th>
                  <th>Role</th>
                  <th>Candidates</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recent.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.title}</strong>
                    </td>
                    <td>{item.role}</td>
                    <td>{item.candidates}</td>
                    <td>
                      <Badge
                        tone={
                          item.status === "Published"
                            ? "success"
                            : item.status === "Draft"
                              ? "neutral"
                              : "warning"
                        }
                      >
                        {item.status}
                      </Badge>
                    </td>
                    <td>{item.updated}</td>
                    <td>
                      <Button
                        variant="ghost"
                        onClick={() => navigate(`/recruiter/assessments/${item.id}/edit`)}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
        <aside className="card">
          <div className="card-heading">
            <div>
              <h2>Quick actions</h2>
              <p>Common hiring workflows</p>
            </div>
          </div>
          <div className="quick-actions">
            <button onClick={() => navigate("/recruiter/assessments/new")}>
              <span>
                <Icon name="plus" />
              </span>
              <div>
                <strong>Create assessment</strong>
                <small>Start from a focused task</small>
              </div>
              <Icon name="chevron" />
            </button>
            <button onClick={() => navigate("/recruiter/candidates")}>
              <span>
                <Icon name="people" />
              </span>
              <div>
                <strong>View candidates</strong>
                <small>Track candidate activity</small>
              </div>
              <Icon name="chevron" />
            </button>
            <button onClick={() => navigate("/recruiter/review")}>
              <span>
                <Icon name="activity" />
              </span>
              <div>
                <strong>Open review queue</strong>
                <small>5 reviews are pending</small>
              </div>
              <Icon name="chevron" />
            </button>
          </div>
        </aside>
        <article className="card wide">
          <div className="card-heading">
            <div>
              <h2>Recent candidate activity</h2>
              <p>Illustrative events from your workspace</p>
            </div>
            <DemoTag />
          </div>
          <div className="activity-list horizontal">
            {[
              ["Maya Chen submitted Frontend Developer Evaluation", "2 hours ago"],
              ["Sam Rivera started Full-Stack API Challenge", "5 hours ago"],
              ["Priya Shah's report is ready for review", "Yesterday"],
            ].map(([text, date], index) => (
              <div key={text}>
                <span className="activity-icon">
                  <Icon name={index === 2 ? "report" : "user"} />
                </span>
                <p>
                  <strong>{text}</strong>
                  <small>{date}</small>
                </p>
              </div>
            ))}
          </div>
        </article>
      </div>
    </>
  );
}

type AssessmentFormState = {
  title: string;
  role: string;
  description: string;
  skills: string;
  duration: string;
  difficulty: string;
};
const blankAssessment: AssessmentFormState = {
  title: "",
  role: "",
  description: "",
  skills: "",
  duration: "45",
  difficulty: "",
};

function AssessmentForm({
  existing,
  onSave,
}: {
  existing?: Assessment;
  onSave: (form: AssessmentFormState, status: "Draft" | "Published", id?: string) => void;
}) {
  const [form, setForm] = useState<AssessmentFormState>(
    existing
      ? {
          title: existing.title,
          role: existing.role,
          description: existing.description,
          skills: existing.skills,
          duration: String(existing.duration),
          difficulty: existing.difficulty,
        }
      : blankAssessment,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const update = (key: keyof AssessmentFormState, value: string) =>
    setForm({ ...form, [key]: value });
  const save = (status: "Draft" | "Published") => {
    const next: Record<string, string> = {};
    if (!form.title.trim()) next.title = "Assessment title is required.";
    if (!form.role) next.role = "Select a target role.";
    if (!form.description.trim()) next.description = "Add a task description.";
    if (!form.skills.trim()) next.skills = "Add at least one skill.";
    if (!form.duration || Number(form.duration) < 10 || Number(form.duration) > 240)
      next.duration = "Duration must be between 10 and 240 minutes.";
    if (!form.difficulty) next.difficulty = "Select a difficulty.";
    setErrors(next);
    if (!Object.keys(next).length) onSave(form, status, existing?.id);
  };
  return (
    <>
      <PageHeader
        eyebrow={existing ? "Edit assessment" : "New assessment"}
        title={existing ? existing.title : "Create an assessment"}
        copy="Define a focused demo assessment. Publishing is simulated and does not invite real candidates."
      />
      <div className="form-layout">
        <form className="card assessment-form" onSubmit={(event) => event.preventDefault()}>
          <div className="form-section">
            <h2>Assessment details</h2>
            <p>Give candidates clear context about the task and expected focus.</p>
            <div className="two-fields">
              <Field
                label="Assessment title"
                value={form.title}
                onChange={(v) => update("title", v)}
                placeholder="e.g. Frontend workflow challenge"
                error={errors.title}
                required
              />
              <SelectField
                label="Target role"
                value={form.role}
                onChange={(v) => update("role", v)}
                options={[
                  "Frontend Engineer",
                  "Backend Engineer",
                  "Full-Stack Engineer",
                  "Software Engineer",
                ]}
                required
              />
            </div>
            {errors.role && <small className="standalone-error">{errors.role}</small>}
            <TextAreaField
              label="Task description"
              value={form.description}
              onChange={(v) => update("description", v)}
              placeholder="Describe what the candidate should build or debug…"
              error={errors.description}
              required
            />
            <Field
              label="Skills assessed"
              value={form.skills}
              onChange={(v) => update("skills", v)}
              placeholder="React, testing, debugging"
              error={errors.skills}
              required
            />
          </div>
          <div className="form-section">
            <h2>Configuration</h2>
            <p>Set practical boundaries for this demo assessment.</p>
            <div className="two-fields">
              <Field
                label="Duration (minutes)"
                value={form.duration}
                onChange={(v) => update("duration", v)}
                type="number"
                error={errors.duration}
                required
              />
              <SelectField
                label="Difficulty"
                value={form.difficulty}
                onChange={(v) => update("difficulty", v)}
                options={["Beginner", "Intermediate", "Advanced"]}
                required
              />
            </div>
            {errors.difficulty && <small className="standalone-error">{errors.difficulty}</small>}
          </div>
          <div className="form-actions">
            <Button variant="ghost" onClick={() => navigate("/recruiter/assessments")}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={() => save("Draft")}>
              Save Draft
            </Button>
            <Button onClick={() => save("Published")}>Publish Demo Assessment</Button>
          </div>
        </form>
        <aside className="card form-help">
          <span className="feature-icon">
            <Icon name="spark" />
          </span>
          <h2>Phase 1 demo behavior</h2>
          <p>
            Drafts and published records are stored in this browser. Publishing does not send
            invitations or create a live coding workspace.
          </p>
          <ul>
            <li>
              <Icon name="check" /> Required fields are validated
            </li>
            <li>
              <Icon name="check" /> Changes persist on refresh
            </li>
            <li>
              <Icon name="check" /> Drafts can be edited or deleted
            </li>
          </ul>
        </aside>
      </div>
    </>
  );
}

function AssessmentsPage({
  assessments,

  onDelete,

  evaluation,

  candidateAssignments,

  onAssign,

  organizationId,

  organizationName,
}: {
  assessments: Assessment[];

  onDelete: (id: string) => void;

  evaluation: EvaluationRecord | null;

  candidateAssignments: CandidateAssignment[];

  organizationId: string;

  organizationName: string;

  onAssign: (
    assessment: Assessment,
    companyId: string,
    companyName: string,
    deadline: string,
  ) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All statuses");
  const filtered = assessments.filter(
    (item) =>
      item.title.toLowerCase().includes(search.toLowerCase()) &&
      (status === "All statuses" || item.status === status),
  );
  return (
    <>
      <PageHeader
        eyebrow="Assessment management"
        title="Assessments"
        copy="Create, organize, and update role-relevant demo assessments."
        action={
          <Button onClick={() => navigate("/recruiter/assessments/new")} icon="plus">
            Create Assessment
          </Button>
        }
      />
      <div className="filters">
        <div className="search">
          <Icon name="search" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search assessments"
            placeholder="Search assessments"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter status"
        >
          <option>All statuses</option>
          <option>Published</option>
          <option>Draft</option>
          <option>In progress</option>
        </select>
        <DemoTag />
      </div>
      {evaluation && (
        <article className="card assessment-report-entry">
          <span className="feature-icon">
            <Icon name="report" />
          </span>
          <div>
            <small>Submitted assessment</small>
            <strong>{evaluation.assessmentTitle}</strong>
            <p>
              {evaluation.candidateName} · {evaluation.evaluationStatus} ·{" "}
              {new Date(evaluation.submissionTimestamp).toLocaleString()}
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => navigate(`/recruiter/reports/${evaluation.id}`)}
          >
            View Report <Icon name="arrow" />
          </Button>
        </article>
      )}
      <div className="card">
        {filtered.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Assessment</th>
                  <th>Target role</th>
                  <th>Duration</th>
                  <th>Candidates</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.title}</strong>
                      <small>{item.skills}</small>
                    </td>
                    <td>{item.role}</td>
                    <td>{item.duration} min</td>
                    <td>{item.candidates}</td>
                    <td>
                      <Badge
                        tone={
                          item.status === "Published"
                            ? "success"
                            : item.status === "Draft"
                              ? "neutral"
                              : "warning"
                        }
                      >
                        {item.status}
                      </Badge>
                    </td>
                    <td>{item.updated}</td>
                    <td>
                      <div className="row-actions">
                        <Button
                          variant="ghost"
                          onClick={() => navigate(`/recruiter/assessments/${item.id}/edit`)}
                        >
                          Edit
                        </Button>
                        {item.status === "Published" && (
                          <Button
                            variant="secondary"
                            onClick={() => {
                              const deadline = new Date(
                                Date.now() + 30 * 24 * 60 * 60 * 1000,
                              ).toLocaleDateString();

                              onAssign(item, organizationId, organizationName, deadline);
                            }}
                          >
                            Assign
                          </Button>
                        )}
                        {item.status === "Draft" && (
                          <Button variant="danger" onClick={() => onDelete(item.id)}>
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No assessments found"
            copy="Try a different search or status filter."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch("");
                  setStatus("All statuses");
                }}
              >
                Clear filters
              </Button>
            }
          />
        )}
      </div>
    </>
  );
}

function CandidatesPage({
  path,
  evaluation,
}: {
  path: string;
  evaluation: EvaluationRecord | null;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All statuses");
  if (path !== "/recruiter/candidates") {
    if (path.endsWith("/alex-morgan") && evaluation) {
      return (
        <>
          <button className="back-link" onClick={() => navigate("/recruiter/candidates")}>
            ← Back to candidates
          </button>
          <PageHeader
            eyebrow={`${evaluation.companyName} · Candidate profile`}
            title={evaluation.candidateName}
            copy={`${evaluation.assessmentTitle} — ${evaluation.taskTitle}`}
            action={
              <Button onClick={() => navigate(`/recruiter/reports/${evaluation.id}`)} icon="report">
                View Assessment Report
              </Button>
            }
          />
          <div className="card candidate-report-profile">
            <div>
              <small>Submission</small>
              <strong>{new Date(evaluation.submissionTimestamp).toLocaleString()}</strong>
            </div>
            <div>
              <small>Evaluation status</small>
              <strong>{evaluation.evaluationStatus}</strong>
            </div>
            <div>
              <small>Human review</small>
              <strong>{evaluation.reviewerStatus}</strong>
            </div>
            <div>
              <small>Evidence coverage</small>
              <strong>{evaluation.evidenceCoverage}%</strong>
            </div>
          </div>
        </>
      );
    }
    const candidate = candidates.find((item) => path.includes(item.id)) ?? candidates[0];
    return (
      <DetailPreview
        kind="candidate"
        title={candidate.name}
        subtitle={candidate.assessment}
        back="/recruiter/candidates"
      />
    );
  }
  const filtered = candidates.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "All statuses" || item.status === filter),
  );
  return (
    <>
      <PageHeader
        eyebrow="Talent pipeline"
        title="Candidates"
        copy="Track illustrative candidate progress and review status."
        action={<DemoTag />}
      />
      <div className="filters">
        <div className="search">
          <Icon name="search" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search candidates"
            placeholder="Search candidates"
          />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option>All statuses</option>
          <option>Submitted</option>
          <option>In progress</option>
          <option>Invited</option>
        </select>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Assessment</th>
                <th>Status</th>
                <th>Submission date</th>
                <th>Review status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {evaluation && (
                <tr>
                  <td>
                    <div className="person-cell">
                      <span className="avatar small-avatar">AM</span>
                      <strong>{evaluation.candidateName}</strong>
                    </div>
                  </td>
                  <td>{evaluation.assessmentTitle}</td>
                  <td>
                    <Badge tone="success">Submitted</Badge>
                  </td>
                  <td>{new Date(evaluation.submissionTimestamp).toLocaleDateString()}</td>
                  <td>{evaluation.reviewerStatus}</td>
                  <td>
                    <Button
                      variant="ghost"
                      onClick={() => navigate("/recruiter/candidates/alex-morgan")}
                    >
                      View <Icon name="arrow" />
                    </Button>
                  </td>
                </tr>
              )}
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="person-cell">
                      <span className="avatar small-avatar">
                        {item.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </span>
                      <strong>{item.name}</strong>
                    </div>
                  </td>
                  <td>{item.assessment}</td>
                  <td>
                    <Badge
                      tone={
                        item.status === "Submitted"
                          ? "success"
                          : item.status === "In progress"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {item.status}
                    </Badge>
                  </td>
                  <td>{item.date}</td>
                  <td>{item.review}</td>
                  <td>
                    <Button
                      variant="ghost"
                      onClick={() => navigate(`/recruiter/candidates/${item.id}`)}
                    >
                      View <Icon name="arrow" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function ReportsPage({ path }: { path: string }) {
  if (path !== "/recruiter/reports") {
    const report = reports.find((item) => path.includes(item.id)) ?? reports[0];
    return (
      <DetailPreview
        kind="report"
        title={`${report.candidate} · Report preview`}
        subtitle={report.assessment}
        back="/recruiter/reports"
      />
    );
  }
  return (
    <>
      <PageHeader
        eyebrow="Evidence reports"
        title="Reports"
        copy="Review demo assessment summaries and illustrative evidence status."
        action={<DemoTag />}
      />
      <div className="report-summary">
        <article className="card">
          <span className="feature-icon">
            <Icon name="report" />
          </span>
          <div>
            <small>Reports ready</small>
            <strong>3</strong>
            <p>Illustrative records available for preview</p>
          </div>
        </article>
        <article className="card">
          <span className="feature-icon">
            <Icon name="activity" />
          </span>
          <div>
            <small>In review</small>
            <strong>2</strong>
            <p>Awaiting demo reviewer activity</p>
          </div>
        </article>
        <article className="card">
          <span className="feature-icon">
            <Icon name="shield" />
          </span>
          <div>
            <small>Evidence coverage</small>
            <strong>Preview</strong>
            <p>No verified evidence has been generated</p>
          </div>
        </article>
      </div>
      <div className="card">
        <div className="card-heading">
          <div>
            <h2>Assessment reports</h2>
            <p>All content below is sample data.</p>
          </div>
        </div>
        <div className="report-list">
          {reports.map((item) => (
            <div key={item.id}>
              <span className="activity-icon">
                <Icon name="report" />
              </span>
              <div>
                <strong>{item.candidate}</strong>
                <small>
                  {item.assessment} · Updated {item.updated}
                </small>
              </div>
              <Badge tone={item.status === "Ready" ? "success" : "warning"}>{item.status}</Badge>
              <Button variant="secondary" onClick={() => navigate(`/recruiter/reports/${item.id}`)}>
                Preview report
              </Button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function DetailPreview({
  kind,
  title,
  subtitle,
  back,
}: {
  kind: "candidate" | "report" | "review";
  title: string;
  subtitle: string;
  back: string;
}) {
  return (
    <div className="detail-page">
      <button className="back-link" onClick={() => navigate(back)}>
        ← Back to{" "}
        {kind === "candidate" ? "candidates" : kind === "report" ? "reports" : "review queue"}
      </button>
      <PageHeader
        eyebrow={`${kind} preview · Demo data`}
        title={title}
        copy={subtitle}
        action={<DemoTag />}
      />
      <div className="detail-grid">
        <article className="card">
          <div className="card-heading">
            <div>
              <h2>{kind === "review" ? "Submission overview" : "Illustrative summary"}</h2>
              <p>Sample information for the Phase 1 workflow.</p>
            </div>
            <Badge tone="warning">Not verified</Badge>
          </div>
          <div className="summary-score">
            <span>
              <Icon name={kind === "candidate" ? "user" : "report"} size={28} />
            </span>
            <div>
              <small>Current status</small>
              <strong>{kind === "review" ? "Awaiting review" : "Preview available"}</strong>
            </div>
          </div>
          <div className="evidence-list">
            {[
              "Planning and approach",
              "Implementation activity",
              "Testing and debugging",
              "AI collaboration",
            ].map((item, index) => (
              <div key={item}>
                <Icon name={index < 2 ? "check" : "activity"} />
                <span>
                  <strong>{item}</strong>
                  <small>
                    {index < 2
                      ? "Illustrative activity captured"
                      : "Detailed evidence arrives in a later phase"}
                  </small>
                </span>
                <Badge tone={index < 2 ? "success" : "neutral"}>
                  {index < 2 ? "Sample" : "Planned"}
                </Badge>
              </div>
            ))}
          </div>
        </article>
        <aside className="card form-help">
          <span className="feature-icon">
            <Icon name="shield" />
          </span>
          <h2>Phase 1 boundary</h2>
          <p>
            The detailed evidence explorer, event timeline, reviewer decisions, and final evaluation
            engine are intentionally not implemented yet.
          </p>
          <Button variant="secondary" onClick={() => navigate(back)}>
            Return to list
          </Button>
        </aside>
      </div>
    </div>
  );
}

function TasksPage({ rubrics, onAdd }: { rubrics: Rubric[]; onAdd: (item: Rubric) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    category: "",
    description: "",
    points: "20",
  });
  const [error, setError] = useState("");
  const save = () => {
    if (
      !form.title.trim() ||
      !form.category ||
      !form.description.trim() ||
      Number(form.points) < 1 ||
      Number(form.points) > 100
    ) {
      setError("Complete every field and use a point value between 1 and 100.");
      return;
    }
    onAdd({ ...form, points: Number(form.points), id: `rubric-${Date.now()}` });
    setForm({ title: "", category: "", description: "", points: "20" });
    setError("");
    setShowForm(false);
  };
  return (
    <>
      <PageHeader
        eyebrow="Assessment library"
        title="Tasks & Rubrics"
        copy="Create consistent demo criteria for role-relevant assessments."
        action={
          <Button icon="plus" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Close form" : "Create Rubric"}
          </Button>
        }
      />
      {showForm && (
        <div className="card inline-form">
          <div className="card-heading">
            <div>
              <h2>Create rubric category</h2>
              <p>New records are saved in this browser as demo content.</p>
            </div>
          </div>
          {error && (
            <div className="form-alert">
              <Icon name="activity" />
              {error}
            </div>
          )}
          <div className="two-fields">
            <Field
              label="Rubric title"
              value={form.title}
              onChange={(v) => setForm({ ...form, title: v })}
              placeholder="e.g. Solution design"
              required
            />
            <SelectField
              label="Category"
              value={form.category}
              onChange={(v) => setForm({ ...form, category: v })}
              options={["Reasoning", "Implementation", "Verification", "AI usage"]}
              required
            />
          </div>
          <TextAreaField
            label="Criteria description"
            value={form.description}
            onChange={(v) => setForm({ ...form, description: v })}
            placeholder="Describe what strong evidence looks like…"
            required
          />
          <Field
            label="Maximum points"
            value={form.points}
            onChange={(v) => setForm({ ...form, points: v })}
            type="number"
            required
          />
          <div className="form-actions">
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Save Demo Rubric</Button>
          </div>
        </div>
      )}
      <div className="card-grid rubric-grid">
        {rubrics.map((rubric) => (
          <article className="card task-card" key={rubric.id}>
            <div>
              <span className="feature-icon">
                <Icon name="target" />
              </span>
              <Badge tone="neutral">{rubric.category}</Badge>
            </div>
            <h2>{rubric.title}</h2>
            <p>{rubric.description}</p>
            <div className="task-footer">
              <span>{rubric.points} points</span>
              <DemoTag />
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function ReviewPage({ path }: { path: string }) {
  if (path !== "/recruiter/review") {
    const review = reviewQueue.find((item) => path.includes(item.id)) ?? reviewQueue[0];
    return (
      <DetailPreview
        kind="review"
        title={review.candidate}
        subtitle={review.assessment}
        back="/recruiter/review"
      />
    );
  }
  return (
    <>
      <PageHeader
        eyebrow="Reviewer workspace"
        title="Review Queue"
        copy="Prioritize illustrative submissions awaiting a human review."
        action={<DemoTag />}
      />
      <div className="card queue-card">
        <div className="queue-head">
          <div>
            <h2>Pending reviews</h2>
            <p>5 demo submissions are awaiting action</p>
          </div>
          <Badge tone="warning">2 high priority</Badge>
        </div>
        {reviewQueue.map((item) => (
          <div className="queue-row" key={item.id}>
            <span className="avatar">
              {item.candidate
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </span>
            <div>
              <strong>{item.candidate}</strong>
              <small>{item.assessment}</small>
            </div>
            <span>
              <small>Submitted</small>
              <strong>{item.submitted}</strong>
            </span>
            <Badge tone={item.priority === "High" ? "danger" : "neutral"}>{item.priority}</Badge>
            <Button variant="secondary" onClick={() => navigate(`/recruiter/review/${item.id}`)}>
              View Submission
            </Button>
          </div>
        ))}
      </div>
      <div className="phase-notice standalone">
        <Icon name="spark" />
        <div>
          <strong>Detailed evidence review arrives in a later phase.</strong>
          <p>
            Phase 1 provides the queue and navigation flow without pretending that evaluation or
            evidence inspection is active.
          </p>
        </div>
      </div>
    </>
  );
}

function AppInner() {
  const { session: supabaseSession, user, loading, signOut, getAccessToken } = useAuth();
  const [path, setPath] = useState(window.location.pathname);

  const [session, setSession] = useState<Session | null>(() => {
    try {
      return JSON.parse(localStorage.getItem("code-apex-session") ?? "null");
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!loading && supabaseSession?.user) {
      const role = (supabaseSession.user.user_metadata?.role as Role) || "candidate";
      const name =
        supabaseSession.user.user_metadata?.full_name ||
        supabaseSession.user.email?.split("@")[0] ||
        "User";
      const email = supabaseSession.user.email || "";
      setSession({ role, name, email });
      localStorage.setItem("code-apex-session", JSON.stringify({ role, name, email }));
    } else if (!loading && !supabaseSession) {
      setSession(null);
      localStorage.removeItem("code-apex-session");
    }
  }, [supabaseSession, loading]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [rubrics, setRubrics] = useState<Rubric[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("code-apex-rubrics") ?? "null") ?? seedRubrics;
    } catch {
      return seedRubrics;
    }
  });

  const [organizations, setOrganizations] = useState<OrganizationWithRole[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [orgsLoaded, setOrgsLoaded] = useState(false);
  const [orgsError, setOrgsError] = useState("");

  const [candidateAssignmentsState, setCandidateAssignmentsState] = useState<CandidateAssignment[]>(
    () => {
      try {
        return (
          JSON.parse(localStorage.getItem("devforge-candidate-assignments") ?? "null") ??
          initialCandidateAssignments
        );
      } catch {
        return initialCandidateAssignments;
      }
    },
  );

  const [assessmentSession, setAssessmentSession] = useState<AssessmentSession | null>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem("devforge-assessment-session") ?? "null");
      return parsed &&
        typeof parsed.sessionId === "string" &&
        Array.isArray(parsed.files) &&
        Array.isArray(parsed.activity)
        ? parsed
        : null;
    } catch {
      return null;
    }
  });
  const [practiceSession, setPracticeSession] = useState<PracticeSession | null>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem("devforge-practice-session") ?? "null");
      return parsed &&
        typeof parsed.sessionId === "string" &&
        Array.isArray(parsed.files) &&
        Array.isArray(parsed.activity)
        ? parsed
        : null;
    } catch {
      return null;
    }
  });
  const [practiceAttempts, setPracticeAttempts] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem("devforge-practice-attempts") ?? "{}");
    } catch {
      return {};
    }
  });
  const [evaluation, setEvaluation] = useState<EvaluationRecord | null>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem("devforge-evaluation-record") ?? "null");
      return parsed &&
        typeof parsed.id === "string" &&
        Array.isArray(parsed.criteria) &&
        Array.isArray(parsed.evidence)
        ? parsed
        : null;
    } catch {
      return null;
    }
  });
  const [toast, setToast] = useState("");
  useEffect(() => {
    const sync = () => setPath(window.location.pathname);
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const loadOrganizations = useCallback(async () => {
    const response = await organizationsApi.list();
    const orgs = response.data;
    setOrganizations(orgs);
    setSelectedOrganizationId((prev) => {
      if (prev && orgs.some((org) => org.id === prev)) return prev;
      // Only auto-select when unambiguous. With multiple orgs the user must
      // choose explicitly rather than silently defaulting to the first one.
      return resolveInitialOrganizationId(orgs);
    });
    return orgs;
  }, []);

  useEffect(() => {
    if (!supabaseSession?.user) return;
    let cancelled = false;
    setOrgsLoaded(false);
    (async () => {
      try {
        // Restore the application profile, then load the organization context.
        await authApi.upsertProfile();
        await loadOrganizations();
        if (cancelled) return;
        setOrgsError("");
      } catch (error) {
        if (!cancelled) setOrgsError(getErrorMessage(error));
      } finally {
        if (!cancelled) setOrgsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabaseSession?.user?.id, loadOrganizations]);

  useEffect(() => {
    if (!supabaseSession?.user || session?.role !== "recruiter") return;
    if (!selectedOrganizationId) {
      setAssessments([]);
      return;
    }
    let cancelled = false;
    assessmentsApi
      .list({ page: 1, limit: 100, sortOrder: "desc", organizationId: selectedOrganizationId })
      .then((response) => {
        if (cancelled) return;
        setAssessments(response.data.items.map(apiAssessmentToUi));
      })
      .catch((error) => {
        if (!cancelled) setToast(getErrorMessage(error));
      });
    return () => {
      cancelled = true;
    };
  }, [supabaseSession, session?.role, selectedOrganizationId]);
  useEffect(() => {
    localStorage.setItem("code-apex-rubrics", JSON.stringify(rubrics));
  }, [rubrics]);

  useEffect(() => {
    localStorage.setItem(
      "devforge-candidate-assignments",
      JSON.stringify(candidateAssignmentsState),
    );
  }, [candidateAssignmentsState]);

  useEffect(() => {
    if (!assessmentSession?.submittedAt) return;
    const submissionRevisionId = assessmentSession.revisions.at(-1)?.id ?? "revision-0";
    const expectedRubricVersion = rubrics.length
      ? `${EVALUATION_RUBRIC_VERSION}-custom-${rubrics.length}`
      : EVALUATION_RUBRIC_VERSION;
    if (
      evaluation?.sessionId === assessmentSession.sessionId &&
      evaluation.submissionRevisionId === submissionRevisionId &&
      evaluation.rubricVersion === expectedRubricVersion &&
      evaluation.evaluatorVersion === EVALUATOR_VERSION
    )
      return;
    if (evaluation?.sessionId === assessmentSession.sessionId) {
      try {
        const history = JSON.parse(localStorage.getItem("devforge-evaluation-history") ?? "[]");
        if (Array.isArray(history) && !history.some((item) => item.id === evaluation.id))
          localStorage.setItem(
            "devforge-evaluation-history",
            JSON.stringify([...history, evaluation]),
          );
      } catch {
        localStorage.setItem("devforge-evaluation-history", JSON.stringify([evaluation]));
      }
    }
    const next = createEvaluation(
      assessmentSession,
      evaluation?.sessionId === assessmentSession.sessionId ? evaluation : null,
      rubrics,
    );
    localStorage.setItem("devforge-evaluation-record", JSON.stringify(next));
    setEvaluation(next);
  }, [assessmentSession, evaluation]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const login = async (email: string, password: string, role: Role) => {
    const { supabase } = await import("./lib/supabase");
    if (!supabase) {
      console.error("Supabase not configured");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      console.error("Login error:", error);
      throw error;
    }
    const roleMeta = (await supabase.auth.getUser()).data.user?.user_metadata?.role as Role;
    const finalRole = roleMeta || role;
    const name =
      (await supabase.auth.getUser()).data.user?.user_metadata?.full_name || email.split("@")[0];
    const userSession = { role: finalRole, name, email };
    localStorage.setItem("code-apex-session", JSON.stringify(userSession));
    setSession(userSession);
    navigate(`/${finalRole}/dashboard`);
  };
  const signUp = async (email: string, password: string, role: Role, fullName: string) => {
    const { supabase } = await import("./lib/supabase");
    if (!supabase) {
      console.error("Supabase not configured");
      return;
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role,
          full_name: fullName,
        },
      },
    });
    if (error) {
      console.error("Sign up error:", error);
      throw error;
    }
    // Note: User needs to verify email before they can sign in
    // For now, we'll navigate to login page
    throw new Error("Account created! Please check your email to verify, then sign in.");
  };
  const logout = async () => {
    await signOut();
    localStorage.removeItem("code-apex-session");
    setSession(null);
    navigate("/");
  };
  const persistAssessmentSession = (next: AssessmentSession) => {
    try {
      localStorage.setItem("devforge-assessment-session", JSON.stringify(next));
      setAssessmentSession(next);
      return true;
    } catch {
      return false;
    }
  };
  const persistEvaluation = (next: EvaluationRecord) => {
    try {
      localStorage.setItem("devforge-evaluation-record", JSON.stringify(next));
      setEvaluation(next);
      return true;
    } catch {
      return false;
    }
  };
  const persistPracticeSession = (next: PracticeSession) => {
    try {
      localStorage.setItem("devforge-practice-session", JSON.stringify(next));
      setPracticeSession(next);
      return true;
    } catch {
      return false;
    }
  };
  const createOrganization = async (data: CreateOrganizationRequest) => {
    const response = await organizationsApi.create(data);
    const created = response.data;
    setOrganizations((prev) => [...prev, created]);
    setSelectedOrganizationId(created.id);
    return created;
  };

  const route = useMemo(() => {
    if (path === "/") return <Landing />;
    if (path === "/roles") return session ? null : <RoleSelection />;
    if (path === "/login/candidate")
      return session ? null : <Login role="candidate" onLogin={login} onSignUp={signUp} />;
    if (path === "/login/recruiter")
      return session ? null : <Login role="recruiter" onLogin={login} onSignUp={signUp} />;
    if (!session) return <RoleSelection />;
    if (path.startsWith("/candidate") && session.role !== "candidate") return null;
    if (path.startsWith("/recruiter") && session.role !== "recruiter") return null;
    // Recruiters must resolve an organization context before any hiring screen
    // renders. Candidates are never gated by organization membership.
    if (session.role === "recruiter") {
      if (!orgsLoaded) {
        return (
          <AppShell session={session} path={path} logout={logout}>
            <EmptyState title="Loading workspace" copy="Restoring your organization context…" />
          </AppShell>
        );
      }
      if (orgsError) {
        return (
          <AppShell session={session} path={path} logout={logout}>
            <EmptyState
              title="Could not load your workspace"
              copy={orgsError}
              action={<Button onClick={() => void loadOrganizations()}>Retry</Button>}
            />
          </AppShell>
        );
      }
      if (organizations.length === 0 || !selectedOrganizationId) {
        return (
          <AppShell session={session} path={path} logout={logout}>
            <OrganizationOnboarding
              organizations={organizations}
              selectedOrganizationId={selectedOrganizationId}
              onSelect={setSelectedOrganizationId}
              onCreate={createOrganization}
            />
          </AppShell>
        );
      }
    }
    const candidateAssessmentRoute = path.match(
      /^\/candidate\/assessments\/([^/]+)(?:\/(onboarding|workspace|submission))?$/,
    );
    if (
      candidateAssessmentRoute?.[2] === "workspace" &&
      assessmentSession?.assignmentId === candidateAssessmentRoute[1] &&
      !assessmentSession.submittedAt
    )
      return <IdeWorkspace session={assessmentSession} persist={persistAssessmentSession} />;
    const practiceTaskRoute = path.match(/^\/candidate\/practice\/([^/]+)(?:\/(workspace))?$/);

    const practicePersist = (session: AssessmentSession) => {
      if (!practiceSession) return false;

      const practiceSessionUpdate: PracticeSession = {
        ...practiceSession,

        sessionId: session.sessionId,

        candidateId: session.candidateId,

        startedAt: session.startedAt,

        durationMinutes: session.durationMinutes,

        currentFile: session.currentFile,

        files: session.files,

        savedFiles: session.savedFiles,

        unsaved: session.unsaved,

        revisions: session.revisions,

        runHistory: session.runHistory,

        testRuns: session.testRuns,

        activity: session.activity,

        completedAt: session.submittedAt,

        attemptNumber: practiceSession.attemptNumber,

        taskId: practiceSession.taskId,
      };

      return persistPracticeSession(practiceSessionUpdate);
    };

    if (
      practiceTaskRoute?.[2] === "workspace" &&
      practiceSession?.taskId === practiceTaskRoute[1] &&
      !practiceSession.completedAt
    )
      return (
        <IdeWorkspace
          session={{
            ...practiceSession,

            assignmentId: practiceSession.taskId,

            assessmentId: `practice-${practiceSession.taskId}`,

            companyId: "practice",

            candidateId: practiceSession.candidateId,

            submittedAt: practiceSession.completedAt,

            durationMinutes: practiceSession.durationMinutes,

            coachMessages: [],
          }}
          persist={practicePersist}
        />
      );
    let page: ReactNode;

    if (path === "/candidate/dashboard")
      page = (
        <CandidateDashboardV2
          session={assessmentSession}
          candidateAssignments={candidateAssignmentsState}
        />
      );
    else if (path.startsWith("/candidate/practice"))
      page = (
        <CandidatePractice
          path={path}
          practiceSession={practiceSession}
          practiceAttempts={practiceAttempts}
          persistPracticeSession={persistPracticeSession}
          setPracticeAttempts={setPracticeAttempts}
        />
      );
    else if (path === "/candidate/assessments")
      page = (
        <AssignedAssessmentsV2
          session={assessmentSession}
          assignments={candidateAssignmentsState}
        />
      );
    else if (candidateAssessmentRoute) {
      const assignment = getAssignment(candidateAssessmentRoute[1]);
      const mode = candidateAssessmentRoute[2];
      if (!assignment)
        page = (
          <EmptyState
            title="Assessment not found"
            copy="This demo assignment does not exist."
            action={
              <Button onClick={() => navigate("/candidate/assessments")}>
                Back to assigned assessments
              </Button>
            }
          />
        );
      else if (mode === "onboarding" && assignment.implemented)
        page = (
          <AssessmentOnboarding
            assignment={assignment}
            session={assessmentSession?.assignmentId === assignment.id ? assessmentSession : null}
            persist={persistAssessmentSession}
          />
        );
      else if (
        mode === "submission" &&
        assessmentSession?.assignmentId === assignment.id &&
        assessmentSession.submittedAt
      )
        page = <SubmissionConfirmation session={assessmentSession} />;
      else
        page = (
          <AssessmentDetails
            assignment={assignment}
            session={assessmentSession?.assignmentId === assignment.id ? assessmentSession : null}
          />
        );
    } else if (path === "/candidate/history")
      page = <CandidateHistoryV2 session={assessmentSession} />;
    else if (path === "/candidate/passport") page = <SkillPassport />;
    else if (path === "/candidate/learning")
      page = <CandidateFeedbackPage session={assessmentSession} evaluation={evaluation} />;
    else if (path === "/recruiter/dashboard")
      page = <RecruiterDashboard assessments={assessments} evaluation={evaluation} />;
    else if (path === "/recruiter/assessments")
      page = (
        <AssessmentsPage
          assessments={assessments}
          evaluation={evaluation}
          candidateAssignments={candidateAssignmentsState}
          organizationId={selectedOrganizationId ?? ""}
          organizationName={
            organizations.find((org) => org.id === selectedOrganizationId)?.name ??
            "Your organization"
          }
          onDelete={async (id) => {
            try {
              await assessmentsApi.delete(id);
              setAssessments((prev) => prev.filter((a) => a.id !== id));
              setToast("Assessment deleted.");
            } catch (error) {
              setToast(getErrorMessage(error));
            }
          }}
          onAssign={(assessment, companyId, companyName, deadline) => {
            const assignment: CandidateAssignment = {
              id: `assignment-${Date.now()}`,

              companyId,

              company: companyName,

              assessment: assessment.title,

              task: assessment.title,

              description: assessment.description,

              duration: assessment.duration,

              deadline,

              difficulty: assessment.difficulty,

              skills: assessment.skills.split(", ").map((s) => s.trim()),

              implemented: true,
            };

            setCandidateAssignmentsState([...candidateAssignmentsState, assignment]);

            setToast(`Assigned "${assessment.title}" to ${companyName}`);
          }}
        />
      );
    else if (path === "/recruiter/assessments/new")
      page = (
        <AssessmentForm
          onSave={async (form, status) => {
            if (!selectedOrganizationId) {
              setToast("Select an organization before creating an assessment.");
              return;
            }
            try {
              const created = (
                await assessmentsApi.create(toCreateAssessmentRequest(form, selectedOrganizationId))
              ).data;
              const saved =
                status === "Published" ? (await assessmentsApi.publish(created.id)).data : created;
              setAssessments((prev) => [apiAssessmentToUi(saved), ...prev]);
              setToast(
                status === "Draft" ? "Assessment saved as a draft." : "Assessment published.",
              );
              navigate("/recruiter/assessments");
            } catch (error) {
              setToast(getErrorMessage(error));
            }
          }}
        />
      );
    else if (/^\/recruiter\/assessments\/[^/]+\/edit$/.test(path)) {
      const id = path.split("/")[3];
      const existing = assessments.find((item) => item.id === id);
      page = existing ? (
        <AssessmentForm
          existing={existing}
          onSave={async (form, status, itemId) => {
            if (!itemId) return;
            try {
              let saved = (await assessmentsApi.update(itemId, toUpdateAssessmentRequest(form)))
                .data;
              if (status === "Published" && existing.status !== "Published") {
                saved = (await assessmentsApi.publish(itemId)).data;
              }
              const mapped = apiAssessmentToUi(saved);
              setAssessments((prev) => prev.map((a) => (a.id === itemId ? mapped : a)));
              setToast("Assessment changes saved.");
              navigate("/recruiter/assessments");
            } catch (error) {
              setToast(getErrorMessage(error));
            }
          }}
        />
      ) : (
        <EmptyState
          title="Assessment not found"
          copy="This demo assessment may have been deleted."
          action={
            <Button onClick={() => navigate("/recruiter/assessments")}>Back to assessments</Button>
          }
        />
      );
    } else if (path.startsWith("/recruiter/candidates"))
      page = <CandidatesPage path={path} evaluation={evaluation} />;
    else if (path.startsWith("/recruiter/reports"))
      page = (
        <RecruiterReportsPage
          path={path}
          session={assessmentSession}
          evaluation={evaluation}
          persist={persistEvaluation}
        />
      );
    else if (path === "/recruiter/tasks")
      page = (
        <TasksPage
          rubrics={rubrics}
          onAdd={(item) => {
            setRubrics([item, ...rubrics]);
            setToast("Demo rubric saved.");
          }}
        />
      );
    else if (path.startsWith("/recruiter/review"))
      page = (
        <RecruiterReviewQueuePage path={path} session={assessmentSession} evaluation={evaluation} />
      );
    else
      page = (
        <EmptyState
          title="Page not found"
          copy="This route is not part of the Phase 1 demo."
          action={
            <Button onClick={() => navigate(`/${session.role}/dashboard`)}>
              Return to dashboard
            </Button>
          }
        />
      );
    return (
      <AppShell
        session={session}
        path={path}
        logout={logout}
        organizations={organizations}
        selectedOrganizationId={selectedOrganizationId}
        onSelectOrganization={setSelectedOrganizationId}
      >
        {page}
      </AppShell>
    );
  }, [
    path,
    session,
    assessments,
    rubrics,
    assessmentSession,
    evaluation,
    organizations,
    selectedOrganizationId,
    orgsLoaded,
    orgsError,
    loadOrganizations,
  ]);

  useEffect(() => {
    if (session && (path === "/roles" || path.startsWith("/login/")))
      navigate(`/${session.role}/dashboard`);
    else if (session?.role === "candidate" && path.startsWith("/recruiter"))
      navigate("/candidate/dashboard");
    else if (session?.role === "recruiter" && path.startsWith("/candidate"))
      navigate("/recruiter/dashboard");
    else if (!session && (path.startsWith("/candidate") || path.startsWith("/recruiter")))
      navigate("/roles");
  }, [path, session]);

  return (
    <>
      {route}
      {toast && (
        <div className="toast">
          <Icon name="check" />
          {toast}
        </div>
      )}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

export default App;
