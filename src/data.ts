export type Role = "candidate" | "recruiter"

export type Session = {
  role: Role
  name: string
  email: string
}

export type Assessment = {
  id: string
  title: string
  role: string
  description: string
  skills: string
  duration: number
  difficulty: string
  status: "Draft" | "Published" | "In progress"
  candidates: number
  updated: string
}

export type Rubric = {
  id: string
  title: string
  category: string
  description: string
  points: number
}

export type CandidateAssignment = {
  id: string
  companyId: string
  company: string
  assessment: string
  task: string
  description: string
  duration: number
  deadline?: string
  difficulty: string
  skills: string[]
  implemented: boolean
}

export type WorkspaceFile = {
  path: string
  language: string
  content: string
  readOnly?: boolean
}

export type ActivityEvent = {
  id: string
  type:
    | "assessment_started"
    | "file_opened"
    | "code_changed"
    | "workspace_saved"
    | "panel_opened"
    | "panel_closed"
    | "terminal_created"
    | "terminal_command_entered"
    | "ai_agent_opened"
    | "ai_coach_prompted"
    | "ai_coach_responded"
    | "application_run"
    | "test_run"
    | "assessment_submitted"
  timestamp: string
  file?: string
  revisionId?: string
  resultId?: string
  terminalId?: string
  detail: string
  provenance: "candidate_action" | "system_generated" | "unknown"
}

export type CoachMessage = {
  id: string
  role: "candidate" | "coach"
  content: string
  timestamp: string
  explanation?: string
  suggestion?: {
    file: string
    content: string
    label: string
  }
}

export type CodeRevision = {
  id: string
  timestamp: string
  files: WorkspaceFile[]
}

export type RunRecord = {
  id: string
  timestamp: string
  revisionId: string
  status: "success" | "error"
  message: string
}

export type TestResult = {
  id: string
  name: string
  status: "passed" | "failed" | "pending"
  diagnostic: string
  criterion: string
}

export type TestRunRecord = {
  id: string
  timestamp: string
  revisionId: string
  results: TestResult[]
}

export type AssessmentSession = {
  sessionId: string
  candidateId: string
  companyId: string
  assignmentId: string
  assessmentId: string
  startedAt: string
  durationMinutes: number
  currentFile: string
  files: WorkspaceFile[]
  savedFiles: WorkspaceFile[]
  unsaved: boolean
  revisions: CodeRevision[]
  coachMessages: CoachMessage[]
  runHistory: RunRecord[]
  testRuns: TestRunRecord[]
  activity: ActivityEvent[]
  submittedAt?: string
}

export const demoAccounts = {
  candidate: {
    name: "Alex Morgan",
    email: "candidate@codeapex.demo",
    password: "Demo123!",
  },
  recruiter: {
    name: "Jordan Lee",
    email: "recruiter@codeapex.demo",
    password: "Demo123!",
  },
} as const

export const seedAssessments: Assessment[] = [
  {
    id: "frontend-evaluation",
    title: "Frontend Developer Evaluation",
    role: "Frontend Engineer",
    description: "Build and debug a responsive customer workflow.",
    skills: "React, JavaScript, Testing",
    duration: 60,
    difficulty: "Intermediate",
    status: "Published",
    candidates: 12,
    updated: "May 24, 2025",
  },
  {
    id: "fullstack-api",
    title: "Full-Stack API Challenge",
    role: "Full-Stack Engineer",
    description: "Design a small API and connect it to a practical interface.",
    skills: "Node.js, APIs, React",
    duration: 75,
    difficulty: "Advanced",
    status: "In progress",
    candidates: 8,
    updated: "May 22, 2025",
  },
  {
    id: "javascript-debugging",
    title: "JavaScript Debugging Assessment",
    role: "Software Engineer",
    description: "Diagnose and resolve realistic application defects.",
    skills: "JavaScript, Debugging, Testing",
    duration: 45,
    difficulty: "Intermediate",
    status: "Draft",
    candidates: 0,
    updated: "May 20, 2025",
  },
]

export const seedRubrics: Rubric[] = [
  {
    id: "problem-solving",
    title: "Problem-solving approach",
    category: "Reasoning",
    description: "Evaluates decomposition, assumptions, and iteration quality.",
    points: 30,
  },
  {
    id: "testing-quality",
    title: "Testing and debugging",
    category: "Verification",
    description:
      "Evaluates test selection, diagnosis, and correction strategy.",
    points: 25,
  },
  {
    id: "ai-collaboration",
    title: "Responsible AI collaboration",
    category: "AI usage",
    description:
      "Evaluates prompting, verification, and independent understanding.",
    points: 20,
  },
]

export const candidateAssessments = [
  {
    title: "Build a Team Task Manager",
    skills: "React, JavaScript, API integration, debugging",
    duration: "45 min",
    status: "In Progress",
  },
  {
    title: "Accessible Checkout Flow",
    skills: "HTML, CSS, accessibility",
    duration: "35 min",
    status: "Ready",
  },
  {
    title: "Debug a Data Dashboard",
    skills: "JavaScript, debugging, testing",
    duration: "40 min",
    status: "Submitted",
  },
]

export const candidateAssignments: CandidateAssignment[] = [
  {
    id: "novatech-task-manager",
    companyId: "novatech-solutions",
    company: "NovaTech Solutions",
    assessment: "Frontend Developer Coding Challenge",
    task: "Build a Team Task Manager",
    description:
      "Build a responsive task workflow with priorities, completion states, filters, and clear empty states.",
    duration: 45,
    deadline: "18 October 2026",
    difficulty: "Intermediate",
    skills: [
      "React",
      "JavaScript",
      "Component design",
      "State management",
      "Testing",
      "Debugging",
      "Responsible AI collaboration",
    ],
    implemented: true,
  },
  {
    id: "vertex-data-functions",
    companyId: "vertex-digital",
    company: "Vertex Digital",
    assessment: "JavaScript Problem-Solving Assessment",
    task: "Implement and test data-processing functions",
    description:
      "Implement reliable transformations for structured data and account for realistic edge cases.",
    duration: 30,
    deadline: "21 October 2026",
    difficulty: "Intermediate",
    skills: ["JavaScript", "Algorithms", "Edge cases", "Debugging"],
    implemented: false,
  },
  {
    id: "novatech-api-integration",
    companyId: "novatech-solutions",
    company: "NovaTech Solutions",
    assessment: "API Integration Challenge",
    task: "Build a structured-data interface",
    description:
      "Build an interface that consumes, handles, and displays structured API data.",
    duration: 60,
    difficulty: "Intermediate",
    skills: [
      "API integration",
      "Error handling",
      "State management",
      "Testing",
    ],
    implemented: false,
  },
]

export const starterWorkspaceFiles: WorkspaceFile[] = [
  {
    path: "src/App.jsx",
    language: "jsx",
    content: `import { useMemo, useState } from "react";
import { addTask, toggleTask, filterTasks } from "./taskUtils";
import "./styles.css";

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState("all");

  const visibleTasks = useMemo(
    () => filterTasks(tasks, filter),
    [tasks, filter]
  );

  function handleAdd(title, priority) {
    setTasks((current) => addTask(current, title, priority));
  }

  return (
    <main className="task-app">
      <h1>Team tasks</h1>
      {/* Build the task form, filters, and list here. */}
    </main>
  );
}`,
  },
  {
    path: "src/styles.css",
    language: "css",
    content: `:root {
  font-family: Inter, system-ui, sans-serif;
  color: #172033;
  background: #f4f7fb;
}

.task-app {
  max-width: 720px;
  margin: 0 auto;
  padding: 32px;
}

.task-item {
  display: flex;
  align-items: center;
  gap: 12px;
}`,
  },
  {
    path: "src/taskUtils.js",
    language: "javascript",
    content: `export function addTask(tasks, title, priority = "medium") {
  const cleanTitle = title.trim();
  if (!cleanTitle) return tasks;

  return [
    ...tasks,
    {
      id: Date.now(),
      title: cleanTitle,
      priority,
      completed: false,
    },
  ];
}

export function toggleTask(tasks, taskId) {
  return tasks.map((task) =>
    task.id === taskId
      ? { ...task, completed: !task.completed }
      : task
  );
}

export function filterTasks(tasks, filter) {
  // TODO: support "active" and "completed" filters.
  return tasks;
}`,
  },
  {
    path: "tests/taskUtils.test.js",
    language: "javascript",
    readOnly: true,
    content: `import { addTask, toggleTask, filterTasks } from "../src/taskUtils";

describe("task utilities", () => {
  it("adds a task", () => {});
  it("rejects an empty title", () => {});
  it("marks a task complete", () => {});
  it("preserves task priority", () => {});
  it("filters tasks by status", () => {});
  it("supports an empty-state result", () => {});
});

// Public demo checks only. Future hidden tests are not included.`,
  },
  {
    path: "public/favicon.svg",
    language: "svg",
    readOnly: true,
    content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#2563eb" />
  <path d="M25 20 13 32l12 12M39 20l12 12-12 12" fill="none" stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
</svg>`,
  },
  {
    path: "package.json",
    language: "json",
    readOnly: true,
    content: `{
  "name": "devforge-assessment",
  "private": true,
  "scripts": {
    "test": "devforge-demo-test",
    "run": "devforge-demo-preview"
  },
  "dependencies": {
    "react": "^19.0.0"
  }
}`,
  },
  {
    path: "README.md",
    language: "markdown",
    readOnly: true,
    content: `# Team Task Manager

Build a responsive task manager that supports:

- Adding tasks with a priority
- Completing tasks
- Filtering all, active, and completed tasks
- A useful empty state
- State preservation during interaction

The Phase 2 runner uses a deterministic source analyzer and preview adapter.
Arbitrary candidate JavaScript is not executed on the host.`,
  },
]

export const candidates = [
  {
    id: "maya-chen",
    name: "Maya Chen",
    assessment: "Frontend Developer Evaluation",
    status: "Submitted",
    date: "May 24, 2025",
    review: "Ready for review",
  },
  {
    id: "sam-rivera",
    name: "Sam Rivera",
    assessment: "Full-Stack API Challenge",
    status: "In progress",
    date: "—",
    review: "Not submitted",
  },
  {
    id: "priya-shah",
    name: "Priya Shah",
    assessment: "JavaScript Debugging Assessment",
    status: "Submitted",
    date: "May 23, 2025",
    review: "Review started",
  },
  {
    id: "noah-williams",
    name: "Noah Williams",
    assessment: "Frontend Developer Evaluation",
    status: "Invited",
    date: "—",
    review: "Not submitted",
  },
]

export const reports = [
  {
    id: "maya-frontend",
    candidate: "Maya Chen",
    assessment: "Frontend Developer Evaluation",
    status: "Ready",
    updated: "May 24, 2025",
  },
  {
    id: "priya-debugging",
    candidate: "Priya Shah",
    assessment: "JavaScript Debugging Assessment",
    status: "In review",
    updated: "May 23, 2025",
  },
  {
    id: "liam-fullstack",
    candidate: "Liam Brooks",
    assessment: "Full-Stack API Challenge",
    status: "Ready",
    updated: "May 21, 2025",
  },
]

export const reviewQueue = [
  {
    id: "maya",
    candidate: "Maya Chen",
    assessment: "Frontend Developer Evaluation",
    submitted: "2 hours ago",
    priority: "High",
  },
  {
    id: "priya",
    candidate: "Priya Shah",
    assessment: "JavaScript Debugging Assessment",
    submitted: "Yesterday",
    priority: "Normal",
  },
  {
    id: "liam",
    candidate: "Liam Brooks",
    assessment: "Full-Stack API Challenge",
    submitted: "2 days ago",
    priority: "Normal",
  },
]
