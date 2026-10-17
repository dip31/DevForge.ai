import type { AiCoachContext, AiSuggestion } from "@contracts/ai";

export type CoachAction = "hint" | "explain" | "debug" | "prompt";

export type CoachEngineResult = {
  content: string;
  explanation: string;
  suggestion?: AiSuggestion;
};

export const COACH_PROVIDER = "local" as const;
export const COACH_MODEL = "deterministic-v1";

const FILTER_SUGGESTION: AiSuggestion = {
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

const FILTER_SUGGESTION_SHORT: AiSuggestion = {
  file: "src/taskUtils.js",
  label: "Insert filter implementation",
  content: `export function filterTasks(tasks, filter) {
  if (filter === "active") return tasks.filter((task) => !task.completed);
  if (filter === "completed") return tasks.filter((task) => task.completed);
  return tasks;
}`,
};

export function generateCoachResponse(
  action: CoachAction,
  prompt: string,
  context: AiCoachContext = {},
): CoachEngineResult {
  const testResults = context.testResults ?? [];
  const latestFailed = testResults.find((result) => result.status === "failed");
  const active = (context.files ?? []).find((file) => file.path === context.currentFile);

  let content: string;
  let explanation: string;
  let suggestion: AiSuggestion | undefined;

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
    if (latestFailed?.id === "filter") suggestion = FILTER_SUGGESTION;
  } else {
    const lower = prompt.toLowerCase();
    if (lower.includes("filter")) {
      content =
        "Keep filtering as a pure transformation: return active tasks when the filter is active, completed tasks when it is completed, and the original collection for all. Then run the deterministic checks.";
      suggestion = FILTER_SUGGESTION_SHORT;
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

  return { content, explanation, suggestion };
}
