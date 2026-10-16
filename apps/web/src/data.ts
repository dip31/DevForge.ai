export type Role = "candidate" | "recruiter";

export type Session = {
  role: Role;
  name: string;
  email: string;
};

export type Assessment = {
  id: string;
  title: string;
  role: string;
  description: string;
  skills: string;
  duration: number;
  difficulty: string;
  status: "Draft" | "Published" | "In progress";
  candidates: number;
  updated: string;
};

export type Rubric = {
  id: string;
  title: string;
  category: string;
  description: string;
  points: number;
};

export type CandidateAssignment = {
  id: string;
  companyId: string;
  company: string;
  assessment: string;
  task: string;
  description: string;
  duration: number;
  deadline?: string;
  difficulty: string;
  skills: string[];
  implemented: boolean;
};

export type WorkspaceFile = {
  path: string;
  language: string;
  content: string;
  readOnly?: boolean;
};

export type ActivityEvent = {
  id: string;
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
    | "assessment_submitted";
  timestamp: string;
  file?: string;
  revisionId?: string;
  resultId?: string;
  terminalId?: string;
  detail: string;
  provenance: "candidate_action" | "system_generated" | "unknown";
};

export type CoachMessage = {
  id: string;
  role: "candidate" | "coach";
  content: string;
  timestamp: string;
  explanation?: string;
  suggestion?: {
    file: string;
    content: string;
    label: string;
  };
};

export type CodeRevision = {
  id: string;
  timestamp: string;
  files: WorkspaceFile[];
};

export type RunRecord = {
  id: string;
  timestamp: string;
  revisionId: string;
  status: "success" | "error";
  message: string;
};

export type TestResult = {
  id: string;
  name: string;
  status: "passed" | "failed" | "pending";
  diagnostic: string;
  criterion: string;
};

export type TestRunRecord = {
  id: string;
  timestamp: string;
  revisionId: string;
  results: TestResult[];
};

export type AssessmentSession = {
  sessionId: string;
  candidateId: string;
  companyId: string;
  assignmentId: string;
  assessmentId: string;
  startedAt: string;
  durationMinutes: number;
  currentFile: string;
  files: WorkspaceFile[];
  savedFiles: WorkspaceFile[];
  unsaved: boolean;
  revisions: CodeRevision[];
  coachMessages: CoachMessage[];
  runHistory: RunRecord[];
  testRuns: TestRunRecord[];
  activity: ActivityEvent[];
  submittedAt?: string;
};

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
} as const;

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
];

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
    description: "Evaluates test selection, diagnosis, and correction strategy.",
    points: 25,
  },
  {
    id: "ai-collaboration",
    title: "Responsible AI collaboration",
    category: "AI usage",
    description: "Evaluates prompting, verification, and independent understanding.",
    points: 20,
  },
];

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
];

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
    description: "Build an interface that consumes, handles, and displays structured API data.",
    duration: 60,
    difficulty: "Intermediate",
    skills: ["API integration", "Error handling", "State management", "Testing"],
    implemented: false,
  },
];

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
];

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
];

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
];

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
];

export type PracticeTask = {
  id: string;
  title: string;
  description: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  skills: string[];
  duration: number;
  starterFiles: WorkspaceFile[];
  testPatterns: Array<{
    id: string;
    name: string;
    pattern: RegExp;
    criterion: string;
    diagnostic: string;
  }>;
};

export const practiceTasks: PracticeTask[] = [
  {
    id: "async-search-race",
    title: "Fix an Async Search Race",
    description:
      "Fix a race condition in an async search implementation that causes stale results to overwrite newer ones.",
    difficulty: "Intermediate",
    skills: ["JavaScript", "Debugging", "Async"],
    duration: 25,
    starterFiles: [
      {
        path: "src/search.js",
        language: "javascript",
        content: `let latestRequestId = 0;

export async function search(query, signal) {
  const requestId = ++latestRequestId;
  const response = await fetch(\`/api/search?q=\${encodeURIComponent(query)}\`, { signal });
  const data = await response.json();
  // BUG: Missing check for stale requests
  return data.results;
}`,
      },
      {
        path: "tests/search.test.js",
        language: "javascript",
        readOnly: true,
        content: `import { search } from "../src/search";

describe("search", () => {
  it("returns only the latest request results", async () => {});
  it("cancels previous requests on new query", async () => {});
  it("handles AbortSignal correctly", async () => {});
});`,
      },
      {
        path: "package.json",
        language: "json",
        readOnly: true,
        content: `{
  "name": "async-search-fix",
  "private": true,
  "scripts": { "test": "devforge-demo-test" }
}`,
      },
    ],
    testPatterns: [
      {
        id: "stale",
        name: "Prevents stale results",
        pattern: /latestRequestId/,
        criterion: "Race condition handling",
        diagnostic: "Check that stale request results are discarded.",
      },
      {
        id: "abort",
        name: "Handles abort signal",
        pattern: /signal/,
        criterion: "Async cancellation",
        diagnostic: "Verify AbortSignal is used for cancellation.",
      },
      {
        id: "cleanup",
        name: "Cleans up on unmount",
        pattern: /cleanup|return.*\(/,
        criterion: "Resource management",
        diagnostic: "Ensure proper cleanup of pending requests.",
      },
    ],
  },
  {
    id: "accessible-modal",
    title: "Build an Accessible Modal",
    description:
      "Implement a fully accessible modal dialog with focus trapping, keyboard navigation, and ARIA attributes.",
    difficulty: "Beginner",
    skills: ["React", "Accessibility", "DOM"],
    duration: 20,
    starterFiles: [
      {
        path: "src/Modal.jsx",
        language: "jsx",
        content: `import { useEffect, useRef } from "react";

export default function Modal({ isOpen, onClose, children, title }) {
  const overlayRef = useRef(null);
  const titleId = \`modal-title-\${Math.random().toString(36).slice(2)}\`;

  // TODO: Implement focus trap
  // TODO: Handle Escape key
  // TODO: Set proper ARIA attributes

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" ref={overlayRef} onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 id={titleId}>{title}</h2>
        <button onClick={onClose}>×</button>
        {children}
      </div>
    </div>
  );
}`,
      },
      {
        path: "tests/Modal.test.jsx",
        language: "jsx",
        readOnly: true,
        content: `import { render, screen, fireEvent } from "@testing-library/react";
import Modal from "../src/Modal";

describe("Modal", () => {
  it("traps focus inside modal", () => {});
  it("closes on Escape key", () => {});
  it("has proper ARIA attributes", () => {});
  it("restores focus on close", () => {});
});`,
      },
      {
        path: "package.json",
        language: "json",
        readOnly: true,
        content: `{
  "name": "accessible-modal",
  "private": true,
  "scripts": { "test": "devforge-demo-test" }
}`,
      },
    ],
    testPatterns: [
      {
        id: "focus-trap",
        name: "Traps focus",
        pattern: /focus.*trap|tabIndex/,
        criterion: "Focus management",
        diagnostic: "Verify focus is trapped within modal.",
      },
      {
        id: "escape",
        name: "Closes on Escape",
        pattern: /Escape|Escape|keydown/,
        criterion: "Keyboard navigation",
        diagnostic: "Check Escape key closes modal.",
      },
      {
        id: "aria",
        name: "Proper ARIA",
        pattern: /aria-|role=/,
        criterion: "ARIA attributes",
        diagnostic: "Ensure modal has proper ARIA roles and labels.",
      },
    ],
  },
  {
    id: "pricing-calculator",
    title: "Test a Pricing Calculator",
    description:
      "Write comprehensive tests for a pricing calculator that handles discounts, taxes, and edge cases.",
    difficulty: "Intermediate",
    skills: ["Testing", "Edge cases", "JavaScript"],
    duration: 30,
    starterFiles: [
      {
        path: "src/pricing.js",
        language: "javascript",
        content: `export function calculatePrice(basePrice, options = {}) {
  const { discount = 0, taxRate = 0.1, quantity = 1 } = options;
  
  if (basePrice < 0) throw new Error("Price cannot be negative");
  if (discount < 0 || discount > 1) throw new Error("Discount must be 0-1");
  if (taxRate < 0) throw new Error("Tax rate cannot be negative");
  if (quantity < 1 || !Number.isInteger(quantity)) throw new Error("Quantity must be positive integer");
  
  const discounted = basePrice * (1 - discount);
  const withTax = discounted * (1 + taxRate);
  return Math.round(withTax * quantity * 100) / 100;
}`,
      },
      {
        path: "tests/pricing.test.js",
        language: "javascript",
        readOnly: true,
        content: `import { calculatePrice } from "../src/pricing";

describe("calculatePrice", () => {
  it("calculates base price", () => {});
  it("applies discount correctly", () => {});
  it("applies tax correctly", () => {});
  it("handles quantity", () => {});
  it("rejects negative price", () => {});
  it("rejects invalid discount", () => {});
  it("rejects invalid tax rate", () => {});
  it("rejects invalid quantity", () => {});
  it("handles zero discount", () => {});
  it("handles zero tax", () => {});
});`,
      },
      {
        path: "package.json",
        language: "json",
        readOnly: true,
        content: `{
  "name": "pricing-calculator",
  "private": true,
  "scripts": { "test": "devforge-demo-test" }
}`,
      },
    ],
    testPatterns: [
      {
        id: "base",
        name: "Base price calculation",
        pattern: /basePrice/,
        criterion: "Core calculation",
        diagnostic: "Verify base price is calculated correctly.",
      },
      {
        id: "discount",
        name: "Discount application",
        pattern: /discount/,
        criterion: "Discount logic",
        diagnostic: "Check discount is applied before tax.",
      },
      {
        id: "tax",
        name: "Tax calculation",
        pattern: /taxRate/,
        criterion: "Tax logic",
        diagnostic: "Verify tax is applied after discount.",
      },
      {
        id: "validation",
        name: "Input validation",
        pattern: /throw.*Error/,
        criterion: "Error handling",
        diagnostic: "Ensure invalid inputs throw descriptive errors.",
      },
    ],
  },
  {
    id: "data-pipeline",
    title: "Refactor a Data Pipeline",
    description:
      "Refactor a messy data processing pipeline into clean, composable functions with proper error handling.",
    difficulty: "Advanced",
    skills: ["JavaScript", "Code quality", "Functional programming"],
    duration: 40,
    starterFiles: [
      {
        path: "src/pipeline.js",
        language: "javascript",
        content: `// MESSY PIPELINE - REFACTOR THIS
export function processData(rawData) {
  const results = [];
  for (let i = 0; i < rawData.length; i++) {
    const item = rawData[i];
    if (!item || !item.id) continue;
    let value = item.value;
    if (typeof value === "string") value = parseFloat(value);
    if (isNaN(value)) value = 0;
    if (value < 0) value = 0;
    if (value > 1000) value = 1000;
    const processed = { id: item.id, value: value * 1.1, timestamp: Date.now() };
    results.push(processed);
  }
  return results;
}

export function aggregate(data) {
  let sum = 0;
  for (const item of data) sum += item.value;
  return { count: data.length, total: sum, average: sum / data.length || 0 };
}`,
      },
      {
        path: "tests/pipeline.test.js",
        language: "javascript",
        readOnly: true,
        content: `import { processData, aggregate } from "../src/pipeline";

describe("Data pipeline", () => {
  it("filters invalid items", () => {});
  it("parses string numbers", () => {});
  it("clamps values to range", () => {});
  it("applies transformation", () => {});
  it("aggregates correctly", () => {});
  it("handles empty input", () => {});
  it("uses pure functions", () => {});
  it("separates concerns", () => {});
});`,
      },
      {
        path: "package.json",
        language: "json",
        readOnly: true,
        content: `{
  "name": "data-pipeline",
  "private": true,
  "scripts": { "test": "devforge-demo-test" }
}`,
      },
    ],
    testPatterns: [
      {
        id: "filter",
        name: "Filters invalid items",
        pattern: /continue|filter/,
        criterion: "Data validation",
        diagnostic: "Check invalid items are filtered out.",
      },
      {
        id: "parse",
        name: "Parses strings",
        pattern: /parseFloat|Number\(/,
        criterion: "Type handling",
        diagnostic: "Verify string numbers are parsed.",
      },
      {
        id: "clamp",
        name: "Clamps values",
        pattern: /Math\.min|Math\.max|clamp/,
        criterion: "Range bounds",
        diagnostic: "Ensure values are clamped to valid range.",
      },
      {
        id: "pure",
        name: "Uses pure functions",
        pattern: /export function/,
        criterion: "Functional style",
        diagnostic: "Verify pipeline uses composable pure functions.",
      },
    ],
  },
];

export type PracticeSession = {
  sessionId: string;
  taskId: string;
  candidateId: string;
  startedAt: string;
  durationMinutes: number;
  currentFile: string;
  files: WorkspaceFile[];
  savedFiles: WorkspaceFile[];
  unsaved: boolean;
  revisions: CodeRevision[];
  runHistory: RunRecord[];
  testRuns: TestRunRecord[];
  activity: ActivityEvent[];
  completedAt?: string;
  attemptNumber: number;
};

export const FREE_PRACTICE_ATTEMPTS = 3;
