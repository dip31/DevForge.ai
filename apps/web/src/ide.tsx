import { FormEvent, KeyboardEvent, ReactNode, useEffect, useRef, useState } from "react";
import {
  ActivityEvent,
  AssessmentSession,
  candidateAssignments,
  CodeRevision,
  WorkspaceFile,
} from "./data";
import { analyzeTests, CoachPanel, LivePreview, Timer, UpdateSession, WIcon } from "./assessment";
import { sessionsApi } from "./lib/api-endpoints";

type PersistSession = (session: AssessmentSession) => boolean;
type ActivityId = "explorer" | "task" | "search" | "source" | "run" | "extensions";
type BottomTab = "terminal" | "output" | "problems" | "tests" | "activity";

type TerminalLine = {
  id: string;
  kind: "command" | "output" | "error" | "system";
  text: string;
};

type TerminalSession = {
  id: string;
  name: string;
  lines: TerminalLine[];
  commands: string[];
};

type WorkspaceUiState = {
  sidebarOpen: boolean;
  activeActivity: ActivityId | null;
  previewOpen: boolean;
  agentOpen: boolean;
  bottomOpen: boolean;
  bottomTab: BottomTab;
  openTabs: string[];
  expandedFolders: string[];
  terminals: TerminalSession[];
  activeTerminalId: string;
};

const now = () => new Date().toISOString();
const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function terminalOne(): TerminalSession {
  return {
    id: "terminal-1",
    name: "Terminal 1",
    commands: [],
    lines: [
      {
        id: "welcome",
        kind: "system",
        text: "DevForge Demo Terminal · Type “help” for supported commands.",
      },
    ],
  };
}

function defaultUiState(session?: AssessmentSession): WorkspaceUiState {
  const initialFile = session?.files.length
    ? session.files.some((f) => f.path === session.currentFile)
      ? session.currentFile
      : session.files[0].path
    : "";
  return {
    sidebarOpen: false,
    activeActivity: null,
    previewOpen: false,
    agentOpen: false,
    bottomOpen: false,
    bottomTab: "terminal",
    openTabs: initialFile ? [initialFile] : [],
    expandedFolders: ["root", "src"],
    terminals: [terminalOne()],
    activeTerminalId: "terminal-1",
  };
}

function normalizeSessionFiles(session: AssessmentSession) {
  // Preserve legitimate starter files for this specific assessment without cross-bleeding.
  return session;
}

function loadUiState(session: AssessmentSession): WorkspaceUiState {
  const defaults = defaultUiState(session);
  try {
    const parsed = JSON.parse(localStorage.getItem(`devforge-workspace-ui:${session.sessionId}`) ?? "null");
    if (
      parsed &&
      Array.isArray(parsed.openTabs) &&
      Array.isArray(parsed.terminals) &&
      typeof parsed.bottomOpen === "boolean"
    ) {
      const validTabs = parsed.openTabs.filter((tab: string) => session.files.some((f) => f.path === tab));
      return {
        ...defaults,
        ...parsed,
        openTabs: validTabs.length ? validTabs : defaults.openTabs,
      };
    }
  } catch {
    // Invalid workspace UI state falls back to safe defaults.
  }
  return defaults;
}

function fileLabel(path: string) {
  return path.split("/").at(-1) ?? path;
}

function fileKind(path: string) {
  const extension = path.split(".").at(-1)?.toLowerCase();
  if (extension === "jsx") return "JSX";
  if (extension === "js") return "JS";
  if (extension === "css") return "CSS";
  if (extension === "json") return "{}";
  if (extension === "md") return "MD";
  if (extension === "svg") return "SVG";
  return "TXT";
}

function isModified(file: WorkspaceFile, session: AssessmentSession) {
  return session.savedFiles.find((saved) => saved.path === file.path)?.content !== file.content;
}

function IdeButton({
  children,
  onClick,
  title,
  active = false,
  disabled = false,
  className = "",
}: {
  children: ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      className={`${className} ${active ? "active" : ""}`}
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function ActivityBar({
  ui,
  toggleActivity,
  togglePreview,
  resetLayout,
  candidateName,
}: {
  ui: WorkspaceUiState;
  toggleActivity: (activity: ActivityId) => void;
  togglePreview: () => void;
  resetLayout: () => void;
  candidateName?: string;
}) {
  const items: Array<[ActivityId, string, ReactNode]> = [
    ["explorer", "Explorer", <WIcon name="folder" />],
    ["task", "Task Details", <WIcon name="info" />],
    ["search", "Search", <WIcon name="search" />],
    ["source", "Source Control", <WIcon name="branch" />],
    ["run", "Run and Tests", <WIcon name="play" />],
    ["extensions", "Extensions", <WIcon name="extensions" />],
  ];
  return (
    <nav className="ide-activity-bar" aria-label="Workspace tools">
      <div>
        {items.map(([id, label, icon]) => (
          <IdeButton
            key={id}
            title={label}
            active={ui.sidebarOpen && ui.activeActivity === id}
            onClick={() => toggleActivity(id)}
          >
            {icon}
          </IdeButton>
        ))}
        <IdeButton
          title={ui.previewOpen ? "Close Preview" : "Open Preview"}
          active={ui.previewOpen}
          onClick={togglePreview}
        >
          <WIcon name="eye" />
        </IdeButton>
      </div>
      <div>
        <div
          className="activity-account"
          title={`Assessment session: ${candidateName || "Candidate"}`}
          aria-label={`Assessment session: ${candidateName || "Candidate"}`}
        >
          <WIcon name="account" />
        </div>
        <IdeButton title="Restore Default Layout" onClick={resetLayout}>
          <WIcon name="settings" />
        </IdeButton>
      </div>
    </nav>
  );
}

function FileTree({
  session,
  ui,
  setUi,
  openFile,
}: {
  session: AssessmentSession;
  ui: WorkspaceUiState;
  setUi: React.Dispatch<React.SetStateAction<WorkspaceUiState>>;
  openFile: (path: string) => void;
}) {
  const toggle = (folderPath: string) =>
    setUi((current) => ({
      ...current,
      expandedFolders: current.expandedFolders.includes(folderPath)
        ? current.expandedFolders.filter((item) => item !== folderPath)
        : [...current.expandedFolders, folderPath],
    }));

  const folder = (name: string, path: string, children: WorkspaceFile[]) => (
    <div className="tree-group" key={path}>
      <button
        className="tree-folder"
        onClick={() => toggle(path)}
        title={`${ui.expandedFolders.includes(path) ? "Collapse" : "Expand"} ${name}`}
      >
        <WIcon name="chevron" />
        <WIcon name="folder" />
        <span>{name}</span>
      </button>
      {ui.expandedFolders.includes(path) && (
        <div className="tree-children">
          {children.map((file) => (
            <button
              className={`tree-file ${session.currentFile === file.path ? "active" : ""}`}
              onClick={() => openFile(file.path)}
              title={file.path}
              key={file.path}
            >
              <span className={`file-kind kind-${fileKind(file.path).toLowerCase()}`}>
                {fileKind(file.path)}
              </span>
              <span>{fileLabel(file.path)}</span>
              {isModified(file, session) && <i title="Modified"></i>}
              {file.readOnly && <small title="Read only">RO</small>}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const topFolders = Array.from(
    new Set(
      session.files
        .filter((file) => file.path.includes("/"))
        .map((file) => file.path.split("/")[0]),
    ),
  ).sort();
  const rootFiles = session.files.filter((file) => !file.path.includes("/"));

  return (
    <div className="explorer-view">
      <div className="sidebar-toolbar">
        <span>DEVFORGE-ASSESSMENT</span>
        <div>
          <button
            onClick={() =>
              setUi((current) => ({
                ...current,
                expandedFolders: ["root", ...topFolders],
              }))
            }
            title="Refresh tree"
          >
            <WIcon name="refresh" />
          </button>
          <button
            onClick={() =>
              setUi((current) => ({
                ...current,
                expandedFolders: ["root"],
              }))
            }
            title="Collapse all"
          >
            <WIcon name="chevron" />
          </button>
        </div>
      </div>
      <button className="tree-root" onClick={() => toggle("root")} title="Toggle project root">
        <WIcon name="chevron" />
        <strong>DevForge-Assessment</strong>
      </button>
      {ui.expandedFolders.includes("root") && (
        <div className="tree-root-content">
          {session.files.length === 0 ? (
            <div className="sidebar-empty">
              <WIcon name="info" />
              <p>No starter files configured for this assessment.</p>
            </div>
          ) : (
            <>
              {topFolders.map((dirName) =>
                folder(
                  dirName,
                  dirName,
                  session.files.filter((file) => file.path.startsWith(`${dirName}/`)),
                ),
              )}
              {rootFiles.map((file) => (
                <button
                  className={`tree-file root-file ${session.currentFile === file.path ? "active" : ""}`}
                  onClick={() => openFile(file.path)}
                  title={file.path}
                  key={file.path}
                >
                  <span className={`file-kind kind-${fileKind(file.path).toLowerCase()}`}>
                    {fileKind(file.path)}
                  </span>
                  <span>{file.path}</span>
                  {isModified(file, session) && <i title="Modified"></i>}
                  {file.readOnly && <small title="Read only">RO</small>}
                </button>
              ))}
            </>
          )}
        </div>
      )}
      <div className="virtual-project-note">
        <WIcon name="info" />
        <span>Virtual assessment files stored in this browser.</span>
      </div>
    </div>
  );
}

function SearchView({
  session,
  openFile,
}: {
  session: AssessmentSession;
  openFile: (path: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const matches = query
    ? session.files.flatMap((file) =>
        file.content
          .split("\n")
          .map((line, index) => ({ file, line, lineNumber: index + 1 }))
          .filter(({ line }) =>
            caseSensitive ? line.includes(query) : line.toLowerCase().includes(query.toLowerCase()),
          ),
      )
    : [];
  return (
    <div className="search-view">
      <div className="search-box">
        <WIcon name="search" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search workspace files"
          aria-label="Search workspace files"
          autoFocus
        />
        <button
          className={caseSensitive ? "active" : ""}
          onClick={() => setCaseSensitive(!caseSensitive)}
          title="Match case"
        >
          Aa
        </button>
        {query && (
          <button onClick={() => setQuery("")} title="Clear search">
            <WIcon name="x" />
          </button>
        )}
      </div>
      <div className="search-summary">
        {query
          ? `${matches.length} match${
              matches.length === 1 ? "" : "es"
            } across ${new Set(matches.map((match) => match.file.path)).size} files`
          : "Search uses current in-memory file contents."}
      </div>
      <div className="search-results">
        {matches.slice(0, 100).map((match) => (
          <button
            key={`${match.file.path}-${match.lineNumber}`}
            onClick={() => openFile(match.file.path)}
          >
            <strong>
              {match.file.path}
              <span>:{match.lineNumber}</span>
            </strong>
            <code>{match.line.trim() || " "}</code>
          </button>
        ))}
        {query && !matches.length && (
          <div className="sidebar-empty">
            <WIcon name="search" />
            <span>No content matches “{query}”.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SourceControlView({
  session,
  save,
  restore,
}: {
  session: AssessmentSession;
  save: () => void;
  restore: (revision: CodeRevision) => void;
}) {
  const modified = session.files.filter((file) => isModified(file, session));
  return (
    <div className="source-view">
      <div className="source-summary">
        <div>
          <WIcon name="branch" />
          <span>
            <strong>Local snapshots</strong>
            <small>Not connected to Git</small>
          </span>
        </div>
        <button onClick={save} disabled={!modified.length || !!session.submittedAt}>
          <WIcon name="save" />
          Save revision
        </button>
      </div>
      <section>
        <header>
          <strong>CHANGES</strong>
          <span>{modified.length}</span>
        </header>
        {modified.length ? (
          modified.map((file) => (
            <div className="source-file" key={file.path}>
              <span className="file-kind">{fileKind(file.path)}</span>
              <span>{file.path}</span>
              <b>M</b>
            </div>
          ))
        ) : (
          <p className="source-empty">No changes since the last saved revision.</p>
        )}
      </section>
      <section>
        <header>
          <strong>REVISION HISTORY</strong>
          <span>{session.revisions.length}</span>
        </header>
        {[...session.revisions].reverse().map((revision, index) => (
          <div className="revision-row" key={revision.id}>
            <WIcon name="history" />
            <div>
              <strong>{revision.id}</strong>
              <small>{new Date(revision.timestamp).toLocaleString()}</small>
            </div>
            {index === 0 ? (
              <span>Current saved</span>
            ) : (
              <button onClick={() => restore(revision)} disabled={!!session.submittedAt}>
                Restore
              </button>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

function RunView({
  session,
  run,
  runTests,
  openBottom,
}: {
  session: AssessmentSession;
  run: () => void;
  runTests: () => void;
  openBottom: (tab: BottomTab) => void;
}) {
  const latestRun = session.runHistory.at(-1);
  const latestTests = session.testRuns.at(-1);
  const failed = latestTests?.results.filter((result) => result.status === "failed");
  return (
    <div className="run-view">
      <div className="run-actions">
        <button onClick={run}>
          <WIcon name="play" />
          <span>
            <strong>Run Application</strong>
            <small>Refresh supported preview adapter</small>
          </span>
        </button>
        <button onClick={runTests}>
          <WIcon name="test" />
          <span>
            <strong>Run Tests</strong>
            <small>Analyze current saved revision</small>
          </span>
        </button>
      </div>
      <div className="run-status-card">
        <span>LATEST RUN</span>
        {latestRun ? (
          <>
            <strong className={latestRun.status}>
              <WIcon name={latestRun.status === "success" ? "check" : "warning"} />
              {latestRun.status}
            </strong>
            <small>{latestRun.revisionId}</small>
          </>
        ) : (
          <p>Application has not been run.</p>
        )}
        <button onClick={() => openBottom("output")}>Open Output</button>
      </div>
      <div className="run-status-card">
        <span>LATEST TESTS</span>
        {latestTests ? (
          <>
            <strong>
              {latestTests.results.filter((result) => result.status === "passed").length}
              /6 passed
            </strong>
            <small>{latestTests.revisionId}</small>
            {failed?.slice(0, 2).map((result) => (
              <p className="failed-test" key={result.id}>
                {result.name}
              </p>
            ))}
          </>
        ) : (
          <p>No supported test run yet.</p>
        )}
        <button onClick={() => openBottom("tests")}>Open Test Results</button>
      </div>
      <p className="adapter-label">
        <WIcon name="info" />
        Deterministic demo adapter. Arbitrary source is not executed.
      </p>
    </div>
  );
}

function ExtensionsView({
  agentOpen,
  toggleAgent,
}: {
  agentOpen: boolean;
  toggleAgent: () => void;
}) {
  return (
    <div className="extensions-view">
      <div className="extension-search">
        <WIcon name="search" />
        <span>Installed workspace extensions</span>
      </div>
      <article className="extension-card">
        <span className="extension-icon">
          <WIcon name="ai" />
        </span>
        <div>
          <h3>DevForge AI Agent</h3>
          <span className="installed-label">Installed · Demo mode</span>
          <p>Context-aware coding guidance, debugging help, and assessment-aware assistance.</p>
          <ul>
            <li>Focused hints</li>
            <li>Active-file explanations</li>
            <li>Supported test diagnostics</li>
          </ul>
          <button onClick={toggleAgent}>{agentOpen ? "Close Agent" : "Open Agent"}</button>
        </div>
      </article>
      <p className="extension-disclaimer">
        Uses deterministic responses served by the API. No external AI model is configured.
      </p>
    </div>
  );
}

function TaskDetailsView({ session }: { session: AssessmentSession }) {
  const fallbackAssignment = candidateAssignments.find((a) => a.id === session.assignmentId);
  const details = session.taskDetails ?? (fallbackAssignment ? {
    title: fallbackAssignment.task,
    role: fallbackAssignment.assessment,
    company: fallbackAssignment.company,
    durationMinutes: fallbackAssignment.duration,
    difficulty: fallbackAssignment.difficulty,
    skills: fallbackAssignment.skills,
    description: fallbackAssignment.taskDetails?.description ?? fallbackAssignment.description,
    instructions: fallbackAssignment.instructions,
    aiPolicy: fallbackAssignment.aiPolicy,
    requirements: fallbackAssignment.taskDetails?.requirements ?? [],
    allowedImports: fallbackAssignment.taskDetails?.allowedImports ?? [],
  } : null);

  if (!details) {
    return (
      <div className="sidebar-empty">
        <WIcon name="info" />
        <p>No task details available for this assessment.</p>
      </div>
    );
  }

  const skillsList: string[] = Array.isArray(details.skills)
    ? details.skills
    : typeof details.skills === "string"
      ? (details.skills as string).split(",").map((s) => s.trim())
      : [];

  return (
    <div className="task-details-view">
      <div className="task-details-header">
        <div className="task-details-meta">
          <span className="task-company">{details.company || "DevForge"}</span>
          {details.role && <span className="task-role">• {details.role}</span>}
        </div>
        <h3 className="task-details-title">{details.title}</h3>
        <div className="task-chips">
          <span className="task-chip duration">
            <WIcon name="timer" size={13} />
            {details.durationMinutes} min
          </span>
          {details.difficulty && (
            <span className={`task-chip difficulty ${details.difficulty}`}>
              {details.difficulty.toUpperCase()}
            </span>
          )}
        </div>
        {skillsList.length > 0 && (
          <div className="task-skills">
            {skillsList.map((skill) => (
              <span key={skill} className="skill-tag">
                {skill}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="task-details-body">
        <section className="task-section">
          <h4>Overview</h4>
          <p>{details.description}</p>
        </section>

        {details.instructions && (
          <section className="task-section">
            <h4>Instructions</h4>
            <div className="task-instructions-content">
              {details.instructions.split("\n\n").map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </section>
        )}

        {details.requirements && details.requirements.length > 0 && (
          <section className="task-section">
            <h4>Requirements &amp; Acceptance Criteria</h4>
            <ul className="task-requirements-list">
              {details.requirements.map((req, i) => (
                <li key={i}>{req}</li>
              ))}
            </ul>
          </section>
        )}

        {details.allowedImports && details.allowedImports.length > 0 && (
          <section className="task-section">
            <h4>Allowed Dependencies</h4>
            <div className="task-imports-list">
              {details.allowedImports.map((imp) => (
                <code key={imp}>{imp}</code>
              ))}
            </div>
          </section>
        )}

        <section className="task-section ai-policy-section">
          <h4>
            <WIcon name="ai" size={13} />
            AI Policy
          </h4>
          <p>
            {details.aiPolicy ??
              "AI assistance is permitted for syntax guidance and debugging. You remain responsible for the correctness, design, and provenance of all submitted work."}
          </p>
        </section>
      </div>
    </div>
  );
}

function WorkspaceSidebar({
  session,
  ui,
  setUi,
  openFile,
  save,
  restore,
  run,
  runTests,
  openBottom,
  agentOpen,
  toggleAgent,
  close,
}: {
  session: AssessmentSession;
  ui: WorkspaceUiState;
  setUi: React.Dispatch<React.SetStateAction<WorkspaceUiState>>;
  openFile: (path: string) => void;
  save: () => void;
  restore: (revision: CodeRevision) => void;
  run: () => void;
  runTests: () => void;
  openBottom: (tab: BottomTab) => void;
  agentOpen: boolean;
  toggleAgent: () => void;
  close: () => void;
}) {
  const titles: Record<ActivityId, string> = {
    explorer: "Explorer",
    task: "Task Details",
    search: "Search",
    source: "Source Control",
    run: "Run and Tests",
    extensions: "Extensions",
  };
  const activity = ui.activeActivity ?? "explorer";
  return (
    <aside className="ide-sidebar">
      <header>
        <strong>{titles[activity]}</strong>
        <button onClick={close} title="Close sidebar">
          <WIcon name="x" />
        </button>
      </header>
      <div className="ide-sidebar-content">
        {activity === "explorer" && (
          <FileTree session={session} ui={ui} setUi={setUi} openFile={openFile} />
        )}
        {activity === "task" && <TaskDetailsView session={session} />}
        {activity === "search" && <SearchView session={session} openFile={openFile} />}
        {activity === "source" && (
          <SourceControlView session={session} save={save} restore={restore} />
        )}
        {activity === "run" && (
          <RunView session={session} run={run} runTests={runTests} openBottom={openBottom} />
        )}
        {activity === "extensions" && (
          <ExtensionsView agentOpen={agentOpen} toggleAgent={toggleAgent} />
        )}
      </div>
    </aside>
  );
}

function IdeEditor({
  session,
  update,
  ui,
  setUi,
  openFile,
  openBottom,
  resetFiles,
}: {
  session: AssessmentSession;
  update: UpdateSession;
  ui: WorkspaceUiState;
  setUi: React.Dispatch<React.SetStateAction<WorkspaceUiState>>;
  openFile: (path: string) => void;
  openBottom: (tab: BottomTab) => void;
  resetFiles: () => void;
}) {
  const active = session.files.find((file) => file.path === session.currentFile);
  const closeTab = (path: string) => {
    const remaining = ui.openTabs.filter((tab) => tab !== path);
    setUi((current) => ({ ...current, openTabs: remaining }));
    if (path === session.currentFile && remaining.length) openFile(remaining.at(-1)!);
  };
  const isReadOnly = !!session.submittedAt || !!session.isReadOnly;
  const change = (content: string) => {
    if (!active || active.readOnly || isReadOnly) return;
    const wasModified = isModified(active, session);
    update({
      ...session,
      unsaved: true,
      files: session.files.map((file) => (file.path === active.path ? { ...file, content } : file)),
      activity: wasModified
        ? session.activity
        : [
            ...session.activity,
            {
              id: uid("event"),
              type: "code_changed",
              timestamp: now(),
              file: active.path,
              detail: `Changed ${active.path}; content provenance is unknown.`,
              provenance: "unknown",
            },
          ],
    });
  };
  const handleKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Tab" || !active || active.readOnly || isReadOnly) return;
    event.preventDefault();
    const target = event.currentTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    change(`${active.content.slice(0, start)}  ${active.content.slice(end)}`);
    window.requestAnimationFrame(() => target.setSelectionRange(start + 2, start + 2));
  };
  return (
    <section className="ide-editor">
      <div className="ide-tabs">
        <div>
          {ui.openTabs.map((path) => {
            const file = session.files.find((item) => item.path === path);
            if (!file) return null;
            return (
              <button
                className={path === session.currentFile ? "active" : ""}
                onClick={() => openFile(path)}
                key={path}
                title={path}
              >
                <span className="file-kind">{fileKind(path)}</span>
                <span>{fileLabel(path)}</span>
                {isModified(file, session) && <i title="Unsaved changes"></i>}
                {(file.readOnly || isReadOnly) && <small>RO</small>}
                <b
                  role="button"
                  tabIndex={0}
                  aria-label={`Close ${fileLabel(path)}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    closeTab(path);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") closeTab(path);
                  }}
                >
                  ×
                </b>
              </button>
            );
          })}
        </div>
        <div className="editor-layout-actions">
          <button onClick={() => openBottom("terminal")} title="Toggle terminal (Ctrl/Cmd+J)">
            <WIcon name="terminal" />
          </button>
          <button
            onClick={() =>
              setUi((current) => ({
                ...current,
                openTabs: current.openTabs.includes(session.currentFile)
                  ? [session.currentFile]
                  : [],
              }))
            }
            title="Close other tabs"
          >
            <WIcon name="split" />
          </button>
          <button
            onClick={() => setUi((current) => ({ ...current, openTabs: [] }))}
            title="Close all tabs"
          >
            <WIcon name="x" />
          </button>
        </div>
      </div>
      {active && ui.openTabs.includes(active.path) ? (
        <>
          <div className="editor-toolbar">
            <span>{active.path}</span>
            <div>
              {(active.readOnly || isReadOnly) && <span className="readonly-label">Read only</span>}
              <span>{active.language}</span>
            </div>
          </div>
          <div className="editor-surface">
            <pre aria-hidden="true">
              {active.content.split("\n").map((_, index) => (
                <span key={index}>{index + 1}</span>
              ))}
            </pre>
            <textarea
              aria-label={`Editing ${active.path}`}
              value={active.content}
              onChange={(event) => change(event.target.value)}
              onKeyDown={handleKey}
              readOnly={active.readOnly || isReadOnly}
              spellCheck={false}
            />
          </div>
          <div className="editor-status">
            <span>
              <i></i>
              {active.language}
            </span>
            <span>{active.content.split("\n").length} lines</span>
            <span>{active.readOnly || isReadOnly ? "Protected assessment file" : "UTF-8"}</span>
            <button
              onClick={resetFiles}
              disabled={isReadOnly}
              title="Reset starter files"
            >
              <WIcon name="refresh" />
              Reset starter
            </button>
          </div>
        </>
      ) : (
        <div className="editor-welcome">
          <span>&lt;/&gt;</span>
          <h2>{session.taskDetails?.title || "DevForge Assessment"}</h2>
          <p>
            {session.files.length === 0
              ? "No starter files configured for this assessment. Review task details in the sidebar to begin."
              : "Open a supported workspace file from Explorer or Search."}
          </p>
          <button
            onClick={() =>
              setUi((current) => ({
                ...current,
                activeActivity: session.files.length === 0 ? "task" : "explorer",
                sidebarOpen: true,
              }))
            }
          >
            {session.files.length === 0 ? "View Task Details" : "Open Explorer"}
          </button>
        </div>
      )}
    </section>
  );
}

function BottomPanel({
  session,
  ui,
  setUi,
  runTests,
  recordTerminalEvent,
  closePanel,
}: {
  session: AssessmentSession;
  ui: WorkspaceUiState;
  setUi: React.Dispatch<React.SetStateAction<WorkspaceUiState>>;
  runTests: () => ReturnType<typeof analyzeTests>;
  recordTerminalEvent: (
    type: "terminal_created" | "terminal_command_entered",
    detail: string,
    terminalId: string,
  ) => void;
  closePanel: () => void;
}) {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [historyIndex, setHistoryIndex] = useState<Record<string, number>>({});
  const activeTerminal =
    ui.terminals.find((terminal) => terminal.id === ui.activeTerminalId) ?? ui.terminals[0];
  const latestRun = session.runHistory.at(-1);
  const latestTests = session.testRuns.at(-1);
  const problems = latestTests?.results.filter((result) => result.status === "failed") ?? [];
  const updateTerminal = (id: string, update: (terminal: TerminalSession) => TerminalSession) =>
    setUi((current) => ({
      ...current,
      terminals: current.terminals.map((terminal) =>
        terminal.id === id ? update(terminal) : terminal,
      ),
    }));
  const append = (terminal: TerminalSession, kind: TerminalLine["kind"], text: string) => ({
    ...terminal,
    lines: [...terminal.lines, { id: uid("line"), kind, text }],
  });
  const commandOutput = (command: string) => {
    if (command === "help")
      return "Supported: help, clear, pwd, ls, npm test, npm run, echo <text>";
    if (command === "pwd") return "/workspace/DevForge-Assessment";
    if (command === "ls") {
      const topItems = Array.from(
        new Set(
          session.files.map((file) =>
            file.path.includes("/") ? `${file.path.split("/")[0]}/` : file.path,
          ),
        ),
      ).sort();
      return topItems.join("  ") || "src/  package.json";
    }
    if (command === "npm run")
      return "Available demo scripts:\n  test  devforge-demo-test\n  run   devforge-demo-preview";
    if (command.startsWith("echo ")) return command.slice(5);
    return null;
  };
  const submitCommand = (event: FormEvent) => {
    event.preventDefault();
    if (!activeTerminal) return;
    const command = (inputs[activeTerminal.id] ?? "").trim();
    if (!command) return;
    setInputs((current) => ({ ...current, [activeTerminal.id]: "" }));
    setHistoryIndex((current) => ({
      ...current,
      [activeTerminal.id]: activeTerminal.commands.length + 1,
    }));
    recordTerminalEvent(
      "terminal_command_entered",
      `Entered supported demo terminal command: ${command}.`,
      activeTerminal.id,
    );
    if (command === "clear") {
      updateTerminal(activeTerminal.id, (terminal) => ({
        ...terminal,
        lines: [],
        commands: [...terminal.commands, command],
      }));
      return;
    }
    let output = commandOutput(command);
    if (command === "npm test") {
      const results = runTests();
      output = `Deterministic test run complete: ${results.filter((result) => result.status === "passed").length}/6 passed. Open the Tests tab for revision-linked details.`;
    }
    updateTerminal(activeTerminal.id, (terminal) => {
      const withCommand = append(terminal, "command", `$ ${command}`);
      const next = append(
        withCommand,
        output === null ? "error" : "output",
        output ??
          `Command not supported by the Demo Terminal: ${command}\nType “help” for available commands.`,
      );
      return { ...next, commands: [...terminal.commands, command] };
    });
  };
  const newTerminal = () => {
    const number = ui.terminals.length + 1;
    const id = uid("terminal");
    const terminal: TerminalSession = {
      id,
      name: `Terminal ${number}`,
      commands: [],
      lines: [
        {
          id: uid("line"),
          kind: "system",
          text: "New independent Demo Terminal session.",
        },
      ],
    };
    setUi((current) => ({
      ...current,
      terminals: [...current.terminals, terminal],
      activeTerminalId: id,
    }));
    recordTerminalEvent("terminal_created", `Created ${terminal.name}.`, id);
  };
  const closeTerminal = (id: string) => {
    if (ui.terminals.length === 1) return;
    const remaining = ui.terminals.filter((terminal) => terminal.id !== id);
    setUi((current) => ({
      ...current,
      terminals: remaining,
      activeTerminalId:
        current.activeTerminalId === id ? remaining[0].id : current.activeTerminalId,
    }));
  };
  const handleHistory = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!activeTerminal || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
    event.preventDefault();
    const commands = activeTerminal.commands;
    if (!commands.length) return;
    const current = historyIndex[activeTerminal.id] ?? commands.length;
    const next =
      event.key === "ArrowUp" ? Math.max(0, current - 1) : Math.min(commands.length, current + 1);
    setHistoryIndex((state) => ({ ...state, [activeTerminal.id]: next }));
    setInputs((state) => ({
      ...state,
      [activeTerminal.id]: next === commands.length ? "" : commands[next],
    }));
  };
  const tabs: Array<[BottomTab, string, number]> = [
    ["terminal", "Terminal", ui.terminals.length],
    ["output", "Output", latestRun ? 1 : 0],
    ["problems", "Problems", problems.length],
    ["tests", "Tests", latestTests?.results.length ?? 0],
    ["activity", "Activity Log", session.activity.length],
  ];
  return (
    <section className="ide-bottom-panel">
      <header>
        <nav>
          {tabs.map(([id, label, count]) => (
            <button
              className={ui.bottomTab === id ? "active" : ""}
              onClick={() => setUi((current) => ({ ...current, bottomTab: id }))}
              key={id}
            >
              {label}
              {count > 0 && <span>{count}</span>}
            </button>
          ))}
        </nav>
        <button className="bottom-close" onClick={closePanel} title="Close panel">
          <WIcon name="x" />
        </button>
      </header>
      <div className="bottom-content">
        {ui.bottomTab === "terminal" && activeTerminal && (
          <div className="terminal-panel">
            <div className="terminal-tabs">
              {ui.terminals.map((terminal) => (
                <button
                  className={terminal.id === activeTerminal.id ? "active" : ""}
                  onClick={() =>
                    setUi((current) => ({
                      ...current,
                      activeTerminalId: terminal.id,
                    }))
                  }
                  key={terminal.id}
                >
                  <WIcon name="terminal" />
                  {terminal.name}
                  {ui.terminals.length > 1 && (
                    <b
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation();
                        closeTerminal(terminal.id);
                      }}
                    >
                      ×
                    </b>
                  )}
                </button>
              ))}
              <button onClick={newTerminal} title="New Terminal">
                <WIcon name="plus" />
              </button>
              <button
                onClick={() =>
                  updateTerminal(activeTerminal.id, (terminal) => ({
                    ...terminal,
                    lines: [],
                  }))
                }
                title="Clear active terminal"
              >
                <WIcon name="trash" />
              </button>
            </div>
            <div className="terminal-output">
              {activeTerminal.lines.map((line) => (
                <pre className={line.kind} key={line.id}>
                  {line.text}
                </pre>
              ))}
            </div>
            <form className="terminal-input" onSubmit={submitCommand}>
              <span>$</span>
              <input
                value={inputs[activeTerminal.id] ?? ""}
                onChange={(event) =>
                  setInputs((current) => ({
                    ...current,
                    [activeTerminal.id]: event.target.value,
                  }))
                }
                onKeyDown={handleHistory}
                aria-label={`${activeTerminal.name} command`}
                placeholder="Enter a supported demo command"
                autoComplete="off"
              />
              <small>Demo Terminal</small>
            </form>
          </div>
        )}
        {ui.bottomTab === "output" &&
          (latestRun ? (
            <div className={`output-line ${latestRun.status}`}>
              <span>{new Date(latestRun.timestamp).toLocaleTimeString()}</span>
              <WIcon name={latestRun.status === "success" ? "check" : "warning"} />
              <p>
                <strong>Supported preview adapter refreshed</strong>
                {latestRun.message}
              </p>
              <code>{latestRun.revisionId}</code>
            </div>
          ) : (
            <div className="execution-empty">No application run yet.</div>
          ))}
        {ui.bottomTab === "problems" &&
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
            <div className="execution-empty">No supported diagnostics.</div>
          ))}
        {ui.bottomTab === "tests" &&
          (latestTests ? (
            <div className="test-results">
              <div className="test-summary">
                <span className="passed">
                  {latestTests.results.filter((result) => result.status === "passed").length} passed
                </span>
                <span className="failed">{problems.length} failed</span>
                <span>{latestTests.revisionId}</span>
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
            <div className="execution-empty">No deterministic test run yet.</div>
          ))}
        {ui.bottomTab === "activity" && (
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
    </section>
  );
}

export default function IdeWorkspace({
  session,
  persist,
}: {
  session: AssessmentSession;
  persist: PersistSession;
}) {
  const initialSession = useRef(normalizeSessionFiles(session));
  const [current, setCurrent] = useState(initialSession.current);
  const currentRef = useRef(initialSession.current);
  const [ui, setUi] = useState<WorkspaceUiState>(() => loadUiState(session));
  const [running, setRunning] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [timerExpired, setTimerExpired] = useState(false);

  const fallbackAssignment = candidateAssignments.find((a) => a.id === session.assignmentId);
  const companyName = session.taskDetails?.company || fallbackAssignment?.company || "DevForge";
  const assessmentTitle =
    session.taskDetails?.role ||
    session.taskDetails?.title ||
    fallbackAssignment?.assessment ||
    fallbackAssignment?.task ||
    "Assessment";

  useEffect(() => {
    const normalized = normalizeSessionFiles(session);
    currentRef.current = normalized;
    setCurrent(normalized);
    if (normalized.files.length !== session.files.length) persist(normalized);
  }, [session, persist]);
  useEffect(() => {
    try {
      localStorage.setItem(`devforge-workspace-ui:${session.sessionId}`, JSON.stringify(ui));
    } catch {
      // UI persistence failure does not invalidate assessment data.
    }
  }, [ui, session.sessionId]);
  useEffect(() => {
    const toggle = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        setUi((currentUi) => ({
          ...currentUi,
          bottomOpen: !currentUi.bottomOpen,
        }));
      }
    };
    window.addEventListener("keydown", toggle);
    return () => window.removeEventListener("keydown", toggle);
  }, []);

  const update: UpdateSession = (next) => {
    const resolved = typeof next === "function" ? next(currentRef.current) : next;
    currentRef.current = resolved;
    setCurrent(resolved);
    persist(resolved);
  };
  const record = (
    type: ActivityEvent["type"],
    detail: string,
    extra: Partial<ActivityEvent> = {},
  ) =>
    update((active) => ({
      ...active,
      activity: [
        ...active.activity,
        {
          id: uid("event"),
          type,
          timestamp: now(),
          detail,
          provenance: "candidate_action",
          ...extra,
        },
      ],
    }));
  const save = (source = currentRef.current) => {
    if (source.submittedAt || !source.unsaved) return source;
    const revisionId = `revision-${source.revisions.length}`;
    const timestamp = now();
    const next: AssessmentSession = {
      ...source,
      unsaved: false,
      savedFiles: structuredClone(source.files),
      revisions: [
        ...source.revisions,
        {
          id: revisionId,
          timestamp,
          files: structuredClone(source.files),
        },
      ],
      activity: [
        ...source.activity,
        {
          id: uid("event"),
          type: "workspace_saved",
          timestamp,
          file: source.currentFile,
          revisionId,
          detail: `Saved workspace as ${revisionId}.`,
          provenance: "candidate_action",
        },
      ],
    };
    update(next);
    return next;
  };
  const ensureRevision = () =>
    currentRef.current.unsaved ? save(currentRef.current) : currentRef.current;
  const openBottom = (tab: BottomTab) => {
    const wasOpen = ui.bottomOpen;
    setUi((state) => ({ ...state, bottomOpen: true, bottomTab: tab }));
    if (!wasOpen) record("panel_opened", `Opened bottom ${tab} panel.`);
  };
  const run = () => {
    const saved = ensureRevision();
    const revisionId = saved.revisions.at(-1)?.id ?? "revision-0";
    setRunning(true);
    window.setTimeout(() => {
      const timestamp = now();
      const resultId = uid("run");
      update((active) => ({
        ...active,
        runHistory: [
          ...active.runHistory,
          {
            id: resultId,
            timestamp,
            revisionId,
            status: "success",
            message: "Supported preview adapter refreshed. Arbitrary source was not executed.",
          },
        ],
        activity: [
          ...active.activity,
          {
            id: uid("event"),
            type: "application_run",
            timestamp,
            revisionId,
            resultId,
            detail: `Ran the supported ${session.taskDetails?.title || fallbackAssignment?.task || "assessment"} preview adapter.`,
            provenance: "candidate_action",
          },
        ],
      }));
      setRunning(false);
      setRunKey((key) => key + 1);
      setUi((state) => ({
        ...state,
        bottomOpen: true,
        bottomTab: "output",
      }));
    }, 450);
  };
  const runTests = () => {
    const saved = ensureRevision();
    const revisionId = saved.revisions.at(-1)?.id ?? "revision-0";
    const results = analyzeTests(saved.savedFiles);
    const timestamp = now();
    const resultId = uid("tests");
    update((active) => ({
      ...active,
      testRuns: [...active.testRuns, { id: resultId, timestamp, revisionId, results }],
      activity: [
        ...active.activity,
        {
          id: uid("event"),
          type: "test_run",
          timestamp,
          revisionId,
          resultId,
          detail: `Ran 6 supported checks: ${results.filter((result) => result.status === "passed").length} passed, ${results.filter((result) => result.status === "failed").length} failed.`,
          provenance: "candidate_action",
        },
      ],
    }));
    setUi((state) => ({
      ...state,
      bottomOpen: true,
      bottomTab: "tests",
    }));
    return results;
  };
  const openFile = (path: string) => {
    const file = currentRef.current.files.find((item) => item.path === path);
    if (!file) return;
    setUi((state) => ({
      ...state,
      openTabs: state.openTabs.includes(path) ? state.openTabs : [...state.openTabs, path],
    }));
    if (currentRef.current.currentFile !== path)
      update((active) => ({
        ...active,
        currentFile: path,
        activity: [
          ...active.activity,
          {
            id: uid("event"),
            type: "file_opened",
            timestamp: now(),
            file: path,
            detail: `Opened ${path}.`,
            provenance: "candidate_action",
          },
        ],
      }));
  };
  const toggleActivity = (activity: ActivityId) => {
    const closing = ui.sidebarOpen && ui.activeActivity === activity;
    setUi((state) => ({
      ...state,
      activeActivity: closing ? null : activity,
      sidebarOpen: !closing,
    }));
    record(
      closing ? "panel_closed" : "panel_opened",
      `${closing ? "Closed" : "Opened"} ${activity} sidebar.`,
    );
  };
  const togglePreview = () => {
    const opening = !ui.previewOpen;
    setUi((state) => ({ ...state, previewOpen: opening }));
    record(
      opening ? "panel_opened" : "panel_closed",
      `${opening ? "Opened" : "Closed"} live preview.`,
    );
  };
  const openAgent = () => {
    if (ui.agentOpen) return;
    setUi((state) => ({ ...state, agentOpen: true }));
    record("ai_agent_opened", "Opened the DevForge AI Agent panel.");
  };
  const closeAgent = () => {
    setUi((state) => ({ ...state, agentOpen: false }));
    record("panel_closed", "Closed the DevForge AI Agent panel.");
  };
  const toggleAgent = () => {
    if (ui.agentOpen) closeAgent();
    else openAgent();
  };
  const restore = (revision: CodeRevision) => {
    if (
      currentRef.current.submittedAt ||
      !window.confirm(`Restore ${revision.id}? Current unsaved workspace content will be replaced.`)
    )
      return;
    const initialStarterFiles = fallbackAssignment?.starterFiles ?? session.files;
    update((active) => ({
      ...active,
      files: [
        ...structuredClone(revision.files),
        ...structuredClone(
          initialStarterFiles.filter(
            (starter) =>
              starter.readOnly && !revision.files.some((file) => file.path === starter.path),
          ),
        ),
      ],
      unsaved: true,
      activity: [
        ...active.activity,
        {
          id: uid("event"),
          type: "code_changed",
          timestamp: now(),
          detail: `Restored local snapshot ${revision.id}; content provenance is unknown.`,
          revisionId: revision.id,
          provenance: "unknown",
        },
      ],
    }));
  };
  const resetLayout = () => {
    const defaultFile = currentRef.current.files[0]?.path ?? "src/App.jsx";
    setUi((state) => ({
      ...defaultUiState(currentRef.current),
      terminals: state.terminals,
      activeTerminalId: state.activeTerminalId,
      openTabs: state.openTabs.length ? state.openTabs : [defaultFile],
    }));
    record("panel_closed", "Restored the default closed-panel workspace layout.");
  };
  const resetFiles = () => setResetOpen(true);
  const confirmReset = () => {
    const initialStarterFiles =
      fallbackAssignment?.starterFiles ?? session.savedFiles ?? session.files;
    const initialDefaultFile = initialStarterFiles[0]?.path ?? "src/App.jsx";
    update((active) => ({
      ...active,
      files: (() => {
        const base = structuredClone(active.revisions[0]?.files ?? initialStarterFiles);
        return [
          ...base,
          ...structuredClone(
            initialStarterFiles.filter(
              (starter) => starter.readOnly && !base.some((file) => file.path === starter.path),
            ),
          ),
        ];
      })(),
      currentFile: initialDefaultFile,
      unsaved: true,
      activity: [
        ...active.activity,
        {
          id: uid("event"),
          type: "code_changed",
          timestamp: now(),
          file: "all files",
          detail: "Candidate confirmed reset to starter files; content provenance is unknown.",
          provenance: "candidate_action",
        },
      ],
    }));
    setUi((state) => ({
      ...state,
      openTabs: [initialDefaultFile],
    }));
    setResetOpen(false);
  };
  const submit = async () => {
    if (timerExpired) {
      setSubmitError("Time has expired. You can no longer submit this assessment.");
      return;
    }
    const saved = currentRef.current.unsaved ? save(currentRef.current) : currentRef.current;
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
    
    // Submit to the backend API
    try {
      await sessionsApi.submit(session.sessionId);
      console.log("Assessment submitted to backend successfully");
    } catch (error) {
      console.error("Failed to submit to backend:", error);
      // Continue anyway - the local submission is saved
    }
    
    currentRef.current = next;
    setCurrent(next);
    window.history.pushState({}, "", `/candidate/assessments/${session.assignmentId}/submission`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };
  const latestTest = current.testRuns.at(-1);
  return (
    <div className="coding-workspace ide-workspace">
      <header className="workspace-header">
        <button
          className="workspace-brand"
          onClick={() => {
            window.history.pushState({}, "", "/candidate/dashboard");
            window.dispatchEvent(new PopStateEvent("popstate"));
          }}
        >
          <span>&lt;/&gt;</span>
          <strong>
            DevForge<span>.ai</span>
          </strong>
        </button>
        <div className="workspace-context">
          <span>{companyName}</span>
          <strong>{assessmentTitle}</strong>
        </div>
        <span
          className={`ide-session-status ${
            session.submittedAt ? "submitted" : session.isReadOnly ? "readonly" : ""
          }`}
        >
          <i></i>
          {session.submittedAt ? "Submitted" : session.isReadOnly ? "Read Only" : "In Progress"}
        </span>
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
          <button onClick={runTests} disabled={!!current.submittedAt}>
            <WIcon name="test" />
            Run Tests
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
            onClick={() => {
              window.history.pushState({}, "", `/candidate/assessments/${session.assignmentId}`);
              window.dispatchEvent(new PopStateEvent("popstate"));
            }}
            title="Exit workspace"
          >
            <WIcon name="x" />
          </button>
        </div>
      </header>
      <div className="ide-shell">
        <ActivityBar
          ui={ui}
          toggleActivity={toggleActivity}
          togglePreview={togglePreview}
          resetLayout={resetLayout}
        />
        {ui.sidebarOpen && (
          <WorkspaceSidebar
            session={current}
            ui={ui}
            setUi={setUi}
            openFile={openFile}
            save={() => save()}
            restore={restore}
            run={run}
            runTests={runTests}
            openBottom={openBottom}
            agentOpen={ui.agentOpen}
            toggleAgent={toggleAgent}
            close={() => toggleActivity(ui.activeActivity ?? "explorer")}
          />
        )}
        <div className="ide-center">
          <div className="ide-main-row">
            <IdeEditor
              session={current}
              update={update}
              ui={ui}
              setUi={setUi}
              openFile={openFile}
              openBottom={(tab) => {
                if (ui.bottomOpen && ui.bottomTab === tab)
                  setUi((state) => ({ ...state, bottomOpen: false }));
                else openBottom(tab);
              }}
              resetFiles={resetFiles}
            />
            {ui.previewOpen && <LivePreview runKey={runKey} running={running} onRun={run} />}
            {ui.agentOpen && <CoachPanel session={current} update={update} onClose={closeAgent} />}
          </div>
          {ui.bottomOpen && (
            <BottomPanel
              session={current}
              ui={ui}
              setUi={setUi}
              runTests={runTests}
              recordTerminalEvent={(type, detail, terminalId) =>
                record(type, detail, { terminalId })
              }
              closePanel={() => {
                setUi((state) => ({ ...state, bottomOpen: false }));
                record("panel_closed", `Closed bottom ${ui.bottomTab} panel.`);
              }}
            />
          )}
        </div>
      </div>
      {submitOpen && (
        <div className="workspace-modal-backdrop">
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
                    ? `${latestTest.results.filter((result) => result.status === "passed").length}/6 passed · ${latestTest.revisionId}`
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
              <input type="checkbox" id="ide-submit-confirm" />
              <span>I understand that I cannot edit this submitted version.</span>
            </label>
            <div className="modal-actions">
              <button className="as-button secondary" onClick={() => setSubmitOpen(false)}>
                Keep working
              </button>
              <button
                className="as-button"
                onClick={() => {
                  const checkbox = document.getElementById(
                    "ide-submit-confirm",
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
              Editable files will return to the initial snapshot. Terminal and coach history are
              preserved.
            </p>
            <div className="modal-actions">
              <button className="as-button secondary" onClick={() => setResetOpen(false)}>
                Cancel
              </button>
              <button className="as-button danger" onClick={confirmReset}>
                Reset files
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
