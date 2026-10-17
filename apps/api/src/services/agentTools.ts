import { randomUUID } from "node:crypto";
import { z } from "zod";
import type {
  AgentOperation,
  AgentToolCall,
  AgentToolResult,
  AgentToolName,
} from "@contracts/agent";
import type { GroqTool } from "./groqProvider";
import {
  MAX_FILE_BYTES,
  buildListing,
  computeDiff,
  languageFromPath,
  validateWorkspacePath,
  type WorkspaceStore,
} from "./workspaceService";

// The closed set of workspace tools the model may request. The JSON schemas are
// what the model sees; the Zod schemas below are what the server enforces. A
// model can never invent a tool outside this set, and every argument is
// re-validated server-side before anything runs.

export const AGENT_TOOL_DEFINITIONS: GroqTool[] = [
  {
    type: "function",
    function: {
      name: "list_workspace_files",
      description: "List every file and folder in the candidate's workspace.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "read_workspace_file",
      description: "Read the full contents of one workspace file by path.",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "Workspace-relative path." } },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_workspace_files",
      description: "Search file paths and contents for a text query.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Text to search for." } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_task_context",
      description: "Get the assessment task instructions, acceptance criteria, and AI policy.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "create_workspace_file",
      description: "Create a new workspace file. Fails if the path already exists.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Workspace-relative path of the new file." },
          content: { type: "string", description: "Full contents of the new file." },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_workspace_file",
      description: "Replace the full contents of an existing workspace file.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Workspace-relative path of the file to edit." },
          content: { type: "string", description: "The new full contents of the file." },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_workspace_directory",
      description: "Create a folder (records it so it appears in listings).",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "Workspace-relative folder path." } },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_workspace_file",
      description:
        "Delete a workspace file. This is destructive and requires the candidate's approval before it is applied.",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "Workspace-relative path to delete." } },
        required: ["path"],
      },
    },
  },
];

export const AGENT_TOOL_NAMES: AgentToolName[] = AGENT_TOOL_DEFINITIONS.map(
  (tool) => tool.function.name as AgentToolName,
);

const listArgs = z.object({});
const readArgs = z.object({ path: z.string().min(1).max(500) });
const searchArgs = z.object({ query: z.string().min(1).max(500) });
const createArgs = z.object({
  path: z.string().min(1).max(500),
  content: z.string().max(MAX_FILE_BYTES),
});
const editArgs = createArgs;
const dirArgs = z.object({ path: z.string().min(1).max(500) });
const deleteArgs = z.object({ path: z.string().min(1).max(500) });

export type AgentTaskContext = {
  instructions: string | null;
  requirements: string[];
  aiPolicy: string | null;
};

export type ExecuteToolInput = {
  store: WorkspaceStore;
  call: AgentToolCall;
  context: AgentTaskContext;
};

function ok(partial: Partial<AgentToolResult>): AgentToolResult {
  return { tool: partial.tool!, ok: true, ...partial };
}

function fail(tool: AgentToolName, error: string): AgentToolResult {
  return { tool, ok: false, error };
}

/**
 * Execute one validated tool call against the authorized workspace. Read tools
 * return real data. Create/edit/directory tools are applied immediately through
 * the persistence layer and reported as applied operations (with a diff). Delete
 * is staged as a pending operation and is never applied here — it must be
 * explicitly approved by the candidate through the apply endpoint.
 */
export async function executeAgentTool(input: ExecuteToolInput): Promise<AgentToolResult> {
  const { store, call, context } = input;
  const name = call.name;

  switch (name) {
    case "list_workspace_files": {
      if (!listArgs.safeParse(call.arguments).success) return fail(name, "Invalid arguments.");
      const files = await store.list();
      const listing = buildListing(files);
      return ok({
        tool: name,
        files: listing,
        message: `${listing.length} workspace entries.`,
      });
    }

    case "read_workspace_file": {
      const parsed = readArgs.safeParse(call.arguments);
      if (!parsed.success) return fail(name, "Invalid arguments.");
      const validated = validateWorkspacePath(parsed.data.path);
      if (!validated.ok) return fail(name, validated.error);
      const file = await store.read(validated.path);
      if (!file) return fail(name, `File not found: ${validated.path}`);
      return ok({ tool: name, content: file.content, message: `Read ${file.path}` });
    }

    case "search_workspace_files": {
      const parsed = searchArgs.safeParse(call.arguments);
      if (!parsed.success) return fail(name, "Invalid arguments.");
      const results = await store.search(parsed.data.query);
      return ok({
        tool: name,
        files: results.map((r) => ({ path: r.path, type: "file" as const })),
        content: results.map((r) => `${r.path}${r.preview ? ` — ${r.preview}` : ""}`).join("\n"),
        message: `${results.length} matches.`,
      });
    }

    case "get_task_context": {
      if (!listArgs.safeParse(call.arguments).success) return fail(name, "Invalid arguments.");
      const parts: string[] = [];
      if (context.instructions) parts.push(`Instructions:\n${context.instructions}`);
      if (context.requirements.length > 0) {
        parts.push(`Acceptance criteria:\n${context.requirements.map((r) => `- ${r}`).join("\n")}`);
      }
      if (context.aiPolicy) parts.push(`AI policy:\n${context.aiPolicy}`);
      const content = parts.join("\n\n") || "No task context is available for this session.";
      return ok({ tool: name, content, message: "Task context returned." });
    }

    case "create_workspace_file": {
      const parsed = createArgs.safeParse(call.arguments);
      if (!parsed.success) return fail(name, "Invalid arguments.");
      const validated = validateWorkspacePath(parsed.data.path);
      if (!validated.ok) return fail(name, validated.error);
      const existing = await store.read(validated.path);
      if (existing) {
        return fail(
          name,
          `File already exists: ${validated.path}. Use edit_workspace_file to change it.`,
        );
      }
      const record = await store.write(validated.path, parsed.data.content);
      const diff = computeDiff(null, parsed.data.content);
      return ok({
        tool: name,
        message: `Created ${record.path} (+${diff.added} lines).`,
        operation: buildOperation("create_file", record.path, parsed.data.content, null, diff),
      });
    }

    case "edit_workspace_file": {
      const parsed = editArgs.safeParse(call.arguments);
      if (!parsed.success) return fail(name, "Invalid arguments.");
      const validated = validateWorkspacePath(parsed.data.path);
      if (!validated.ok) return fail(name, validated.error);
      const existing = await store.read(validated.path);
      if (!existing) {
        return fail(name, `File not found: ${validated.path}. Use create_workspace_file instead.`);
      }
      if (existing.isReadOnly) {
        return fail(name, `File is read-only: ${validated.path}`);
      }
      const previous = existing.content;
      const record = await store.write(validated.path, parsed.data.content);
      const diff = computeDiff(previous, parsed.data.content);
      return ok({
        tool: name,
        message: `Edited ${record.path} (+${diff.added}/-${diff.removed} lines).`,
        operation: buildOperation("edit_file", record.path, parsed.data.content, previous, diff),
      });
    }

    case "create_workspace_directory": {
      const parsed = dirArgs.safeParse(call.arguments);
      if (!parsed.success) return fail(name, "Invalid arguments.");
      const validated = validateWorkspacePath(parsed.data.path);
      if (!validated.ok) return fail(name, validated.error);
      const markerPath = `${validated.path}/.gitkeep`;
      await store.write(markerPath, "", { isReadOnly: false });
      return ok({
        tool: name,
        message: `Created folder ${validated.path}.`,
        operation: buildOperation("create_directory", validated.path, "", null, {
          added: 0,
          removed: 0,
          unified: "",
        }),
      });
    }

    case "delete_workspace_file": {
      const parsed = deleteArgs.safeParse(call.arguments);
      if (!parsed.success) return fail(name, "Invalid arguments.");
      const validated = validateWorkspacePath(parsed.data.path);
      if (!validated.ok) return fail(name, validated.error);
      const existing = await store.read(validated.path);
      if (!existing) return fail(name, `File not found: ${validated.path}`);
      if (existing.isReadOnly) return fail(name, `File is read-only: ${validated.path}`);
      // Staged only. Not applied until the candidate explicitly approves it.
      const diff = computeDiff(existing.content, null);
      const operation = buildOperation("delete_file", validated.path, null, existing.content, diff);
      return ok({
        tool: name,
        message: `Deletion of ${validated.path} staged. It will only be applied after the candidate approves it.`,
        operation,
      });
    }

    default:
      return fail(name as AgentToolName, `Unknown tool: ${name}`);
  }
}

function buildOperation(
  kind: AgentOperation["kind"],
  path: string,
  content: string | null,
  previous: string | null,
  diff: { added: number; removed: number; unified: string },
): AgentOperation {
  const isDelete = kind === "delete_file";
  const isDirectory = kind === "create_directory";
  return {
    id: `op_${randomUUID()}`,
    kind,
    path,
    content,
    expectedPreviousContent: previous,
    language: isDirectory ? undefined : languageFromPath(path),
    // Deletes are destructive and always need explicit approval; creates and
    // edits are applied immediately (create cannot overwrite; edit is diffed).
    requiresApproval: isDelete,
    status: isDelete ? "pending" : "applied",
    diff: {
      path,
      previous,
      next: content,
    },
    appliedAt: isDelete ? null : new Date().toISOString(),
    error: null,
  };
}
