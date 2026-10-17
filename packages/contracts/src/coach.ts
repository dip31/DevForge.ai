import type { AiCoachContext, AiSuggestion } from "./ai";

// Rule-based coach intents. These describe what the candidate is asking for so
// the deterministic preview can respond contextually instead of routing every
// unrecognized message into a single debugging instruction. No external LLM is
// involved: matches are deterministic and priority-ordered below.
export type CoachAction = "hint" | "explain" | "debug" | "prompt";

export type CoachIntent =
  | "greeting"
  | "theme"
  | "hint"
  | "debug"
  | "test-failure"
  | "explain"
  | "filter"
  | "empty-state"
  | "general"
  | "unknown";

export type CoachIntentConfidence = "high" | "low";

export type CoachIntentMatch = {
  intent: CoachIntent;
  confidence: CoachIntentConfidence;
};

export type CoachEngineResult = {
  content: string;
  explanation: string;
  suggestion?: AiSuggestion;
};

const GREETING_PATTERN =
  /^(?:hi+|hey+|hello+|heya|hiya|howdy|yo|sup|greetings|hola|good\s+(?:morning|afternoon|evening|day))(?:\s+(?:there|coach|again|all|everyone|everybody|folks))?[!,. ]*$/i;

const THEME_PATTERN =
  /\b(?:theme|dark\s*mode|light\s*mode|dark\s*theme|editor\s+theme|color\s*scheme|colour\s*scheme|appearance)\b/i;

const HINT_PATTERN =
  /\b(?:hint|nudge|get\s+started|get\s+going|starting\s+out|where\s+do\s+i\s+(?:start|begin)|how\s+do\s+i\s+(?:start|begin)|point\s+me|guide\s+me)\b/i;

const DEBUG_PATTERN =
  /\b(?:debug|debugging|stack\s*trace|exception|not\s+working|doesn'?t\s+work|broken|error|why\s+(?:is|does|do|did)\b[^?.!]*\b(?:fail|error|break|not\s+work|throw))/i;

const TEST_PATTERN =
  /\b(?:tests?|tested|testing|failing|failure|failed|acceptance\s+criteri(?:a|on)|criteri(?:a|on)|checks?)\b/i;

const EXPLAIN_PATTERN =
  /\b(?:explain|walk\s+me\s+through|help\s+me\s+understand)\b|what\s+does\s+(?:this|the|it|that|my)\b|how\s+does\s+(?:this|the|it|that|my)\b|what\s+is\s+(?:this|it)\b/i;

const FILTER_PATTERN = /\bfilter(?:s|ed|ing)?\b/i;

const EMPTY_PATTERN = /\bempty(?:\s+state|\s+list|\s+result)?\b/i;

const GENERAL_PATTERN =
  /\b(?:what\s+can\s+you\s+do|what\s+do\s+you\s+do|what\s+are\s+you|who\s+are\s+you|how\s+do\s+you\s+work|your\s+capabilities|your\s+limitations)\b/i;

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

function firstFailed(context: AiCoachContext) {
  return (context.testResults ?? []).find((result) => result.status === "failed");
}

function activeFile(context: AiCoachContext) {
  return (context.files ?? []).find((file) => file.path === context.currentFile);
}

function firstRequirement(context: AiCoachContext) {
  return (context.requirements ?? []).find((item) => item.trim().length > 0);
}

// Deterministic, priority-ordered classification. Specific request intents are
// checked before generic conversational ones (for example greeting), and a
// greeting only matches when the message is a greeting and nothing else.
export function classifyCoachIntent(prompt: string): CoachIntentMatch {
  const text = (prompt ?? "").trim();
  if (!text) return { intent: "unknown", confidence: "low" };

  if (THEME_PATTERN.test(text)) return { intent: "theme", confidence: "high" };
  if (HINT_PATTERN.test(text)) return { intent: "hint", confidence: "high" };
  if (DEBUG_PATTERN.test(text)) return { intent: "debug", confidence: "high" };
  if (TEST_PATTERN.test(text)) return { intent: "test-failure", confidence: "high" };
  if (EXPLAIN_PATTERN.test(text)) return { intent: "explain", confidence: "high" };
  if (FILTER_PATTERN.test(text)) return { intent: "filter", confidence: "high" };
  if (EMPTY_PATTERN.test(text)) return { intent: "empty-state", confidence: "high" };
  if (GREETING_PATTERN.test(text)) return { intent: "greeting", confidence: "high" };
  if (GENERAL_PATTERN.test(text) || text.toLowerCase() === "help")
    return { intent: "general", confidence: "high" };
  return { intent: "unknown", confidence: "low" };
}

export function hintResponse(context: AiCoachContext): CoachEngineResult {
  const failed = firstFailed(context);
  if (failed) {
    return {
      content: `Start with “${failed.name}.” ${failed.diagnostic} Make the smallest change, then save and rerun the supported checks.`,
      explanation:
        "I reviewed the latest deterministic test result and selected the first actionable gap.",
    };
  }
  const requirement = firstRequirement(context);
  if (requirement) {
    return {
      content: `Your task lists “${requirement}” as an acceptance criterion. Take that one, connect it to a single small function, save the revision, and run the public checks to see what still fails.`,
      explanation:
        "No failing check is stored yet, so I referenced the task requirements you can access instead of inventing a requirement.",
    };
  }
  return {
    content:
      "Start by connecting one acceptance criterion to one small function. Save the revision, run the public checks, and use the first concrete failure to guide the next change.",
    explanation:
      "No failing checks or task requirements were available, so this is general guidance rather than a claim about your code.",
  };
}

export function explainResponse(context: AiCoachContext): CoachEngineResult {
  const active = activeFile(context);
  if (!active) {
    return {
      content:
        "I don't have a file to explain yet. Tell me which file or function you want explained, or open a file in the workspace so it becomes the active file.",
      explanation: "No active file content was included in the coach context.",
    };
  }
  return {
    content: `${active.path} currently contains ${active.content.split("\n").length} lines. The starter separates UI state in App.jsx from task transformations in taskUtils.js, which makes the supported behaviors easier to test independently.`,
    explanation:
      "I used the active filename, source length, and starter-project architecture. No hidden reasoning or remote model was used.",
  };
}

export function debugResponse(context: AiCoachContext): CoachEngineResult {
  const failed = firstFailed(context);
  if (failed) {
    return {
      content: `The latest failure is “${failed.name}.” The runner reports: ${failed.diagnostic}`,
      explanation: "I inspected the most recent locally stored test result.",
      suggestion: failed.id === "filter" ? FILTER_SUGGESTION : undefined,
    };
  }
  return {
    content:
      "There is no failed supported check yet. Run Tests first so I can respond to a concrete diagnostic.",
    explanation:
      "No stored diagnostic was available, so I did not guess at a cause or claim to have inspected code that was not provided.",
  };
}

export function themeResponse(): CoachEngineResult {
  return {
    content:
      "I can't change the theme. This preview has no dark-mode setting or theme switcher, and the coach can only read the workspace context you provide (active file, workspace files, and the latest supported test run). I won't claim to have applied a change that didn't happen. If theme control is added later it would use the app's own preferences, not this preview.",
    explanation:
      "I checked the available context for a theme action; none exists for the rule-based coach in this phase.",
  };
}

export function greetingResponse(): CoachEngineResult {
  return {
    content:
      "Hi! I'm the rule-based AI Coach preview — there's no external language model connected. I can give focused hints, explain the active file, help debug a supported failure, or point you to the latest supported test result. What would you like to look at?",
    explanation:
      "This is a fixed greeting from the rule-based preview, not a generated model response.",
  };
}

export function testFailureResponse(context: AiCoachContext): CoachEngineResult {
  const failed = firstFailed(context);
  if (failed) {
    return {
      content: `Your latest supported failure is “${failed.name}.” ${failed.diagnostic}`,
      explanation:
        "I used the most recent stored test result only; I have not run any tests myself.",
    };
  }
  return {
    content:
      "I don't have any stored test results to reference yet. Run the supported checks (or paste the failing output), and I'll help interpret exactly what you provide instead of inventing results.",
    explanation: "No test output was available, so I did not fabricate any test results.",
  };
}

export function filterResponse(): CoachEngineResult {
  return {
    content:
      "Keep filtering as a pure transformation: return active tasks when the filter is active, completed tasks when it is completed, and the original collection for all. Then run the deterministic checks.",
    explanation:
      "This maps to the supported filtering acceptance criterion and does not generate a full solution.",
    suggestion: FILTER_SUGGESTION_SHORT,
  };
}

export function emptyStateResponse(): CoachEngineResult {
  return {
    content:
      "Treat an empty task list and an empty filtered result as valid UI states. Render a short message where the list would normally appear, rather than treating it as an execution error.",
    explanation:
      "This maps to the supported empty-state acceptance criterion and does not generate a full solution.",
  };
}

export function generalResponse(): CoachEngineResult {
  return {
    content:
      "This is a rule-based preview, so I can't answer arbitrary general questions. I can help with focused hints, explaining the active file, debugging a supported failure, or reporting the latest supported test result. Tell me which file, function, or failing behavior you mean.",
    explanation:
      "The preview supports a fixed set of intents and does not understand free-form questions.",
  };
}

export function unknownResponse(): CoachEngineResult {
  return {
    content:
      "I'm not sure what you'd like help with. Tell me which file, function, or failing behavior you want to inspect — or use Hint, Explain Code, or Debug Error. I'm a rule-based preview, so I can only respond to supported requests.",
    explanation:
      "The request did not match a supported intent, so I asked for clarification instead of guessing.",
  };
}

// Response for a free-text prompt after deterministic intent classification.
export function promptResponse(prompt: string, context: AiCoachContext = {}): CoachEngineResult {
  const { intent } = classifyCoachIntent(prompt);
  switch (intent) {
    case "greeting":
      return greetingResponse();
    case "theme":
      return themeResponse();
    case "hint":
      return hintResponse(context);
    case "debug":
      return debugResponse(context);
    case "test-failure":
      return testFailureResponse(context);
    case "explain":
      return explainResponse(context);
    case "filter":
      return filterResponse();
    case "empty-state":
      return emptyStateResponse();
    case "general":
      return generalResponse();
    default:
      return unknownResponse();
  }
}

// Single entry point used by both the API service and the web fallback so the
// preview behaves identically whether or not the backend is reachable.
export function generateCoachResponse(
  action: CoachAction,
  prompt: string,
  context: AiCoachContext = {},
): CoachEngineResult {
  if (action === "hint") return hintResponse(context);
  if (action === "explain") return explainResponse(context);
  if (action === "debug") return debugResponse(context);
  return promptResponse(prompt, context);
}
