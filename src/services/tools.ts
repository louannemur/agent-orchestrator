import { exec } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { promisify } from "util";

import type { AgentTool, ToolResult } from "@/types";

import { coordinatorService } from "./coordinator-service";

const execAsync = promisify(exec);

// ============================================================================
// Execution Context
// ============================================================================

export interface ToolExecutionContext {
  workingDir: string;
  agentId?: string;
  taskId?: string;
}

// ============================================================================
// Tool Definitions for Claude API
// ============================================================================

export const AGENT_TOOLS: AgentTool[] = [
  {
    name: "read_file",
    description: "Read the contents of a file",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The path to the file to read",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description:
      "Write content to a file. Will create the file if it doesn't exist.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The path to the file to write",
        },
        content: {
          type: "string",
          description: "The content to write to the file",
        },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "edit_file",
    description: "Edit a file by replacing a specific string with new content",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The path to the file to edit",
        },
        old_content: {
          type: "string",
          description: "The exact content to find and replace",
        },
        new_content: {
          type: "string",
          description: "The new content to replace with",
        },
      },
      required: ["path", "old_content", "new_content"],
    },
  },
  {
    name: "list_files",
    description: "List files and directories at a path",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The directory path to list",
        },
        recursive: {
          type: "boolean",
          description: "Whether to list files recursively",
          default: false,
        },
      },
      required: ["path"],
    },
  },
  {
    name: "search_code",
    description: "Search for a pattern in files using grep",
    input_schema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "The search pattern (regex supported)",
        },
        path: {
          type: "string",
          description: "The directory to search in",
          default: ".",
        },
        file_pattern: {
          type: "string",
          description: "File pattern to filter (e.g., '*.ts', '*.js')",
        },
      },
      required: ["pattern"],
    },
  },
  {
    name: "run_command",
    description:
      "Run a shell command. Use for running tests, installing packages, etc.",
    input_schema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The shell command to run",
        },
        timeout_seconds: {
          type: "number",
          description: "Timeout in seconds (default 30)",
          default: 30,
        },
      },
      required: ["command"],
    },
  },
  {
    name: "task_complete",
    description:
      "Mark the current task as complete. Call this when you've finished the task.",
    input_schema: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "A summary of what was accomplished",
        },
      },
      required: ["summary"],
    },
  },
  {
    name: "task_failed",
    description: "Mark the task as failed if you cannot complete it.",
    input_schema: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "The reason why the task cannot be completed",
        },
      },
      required: ["reason"],
    },
  },
];

// ============================================================================
// Path Sanitization
// ============================================================================

function sanitizePath(inputPath: string, workingDir: string): string {
  // Resolve the path relative to working directory
  const resolved = path.resolve(workingDir, inputPath);

  // Ensure the resolved path is within the working directory
  const normalizedWorkingDir = path.normalize(workingDir);
  const normalizedResolved = path.normalize(resolved);

  if (!normalizedResolved.startsWith(normalizedWorkingDir)) {
    throw new Error(
      `Path traversal detected: ${inputPath} resolves outside working directory`
    );
  }

  return resolved;
}

// ============================================================================
// Tool Implementations
// ============================================================================

async function readFile(
  input: { path: string },
  workingDir: string
): Promise<ToolResult> {
  try {
    const safePath = sanitizePath(input.path, workingDir);
    const content = await fs.readFile(safePath, "utf-8");
    return { success: true, output: content };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, output: "", error: `Failed to read file: ${message}` };
  }
}

async function writeFile(
  input: { path: string; content: string },
  context: ToolExecutionContext
): Promise<ToolResult> {
  try {
    const safePath = sanitizePath(input.path, context.workingDir);

    // Acquire lock if agent context is provided
    if (context.agentId && context.taskId) {
      const lockAcquired = await coordinatorService.acquireLock(
        context.agentId,
        context.taskId,
        safePath
      );

      if (!lockAcquired) {
        return {
          success: false,
          output: "",
          error: `File is locked by another agent: ${input.path}`,
        };
      }
    }

    // Create directory if it doesn't exist
    const dir = path.dirname(safePath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(safePath, input.content, "utf-8");
    return { success: true, output: `Successfully wrote to ${input.path}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, output: "", error: `Failed to write file: ${message}` };
  }
}

async function editFile(
  input: { path: string; old_content: string; new_content: string },
  context: ToolExecutionContext
): Promise<ToolResult> {
  try {
    const safePath = sanitizePath(input.path, context.workingDir);

    // Acquire lock if agent context is provided
    if (context.agentId && context.taskId) {
      const lockAcquired = await coordinatorService.acquireLock(
        context.agentId,
        context.taskId,
        safePath
      );

      if (!lockAcquired) {
        return {
          success: false,
          output: "",
          error: `File is locked by another agent: ${input.path}`,
        };
      }
    }

    const content = await fs.readFile(safePath, "utf-8");

    // Count occurrences
    const occurrences = content.split(input.old_content).length - 1;

    if (occurrences === 0) {
      return {
        success: false,
        output: "",
        error: "old_content not found in file",
      };
    }

    if (occurrences > 1) {
      return {
        success: false,
        output: "",
        error: `old_content found ${occurrences} times. Please provide more specific content to replace.`,
      };
    }

    const newContent = content.replace(input.old_content, input.new_content);
    await fs.writeFile(safePath, newContent, "utf-8");

    return { success: true, output: `Successfully edited ${input.path}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, output: "", error: `Failed to edit file: ${message}` };
  }
}

async function listFiles(
  input: { path: string; recursive?: boolean },
  workingDir: string
): Promise<ToolResult> {
  try {
    const safePath = sanitizePath(input.path, workingDir);
    const recursive = input.recursive ?? false;

    const entries = await fs.readdir(safePath, { withFileTypes: true });
    const results: string[] = [];

    const processDirectory = async (
      dirPath: string,
      prefix: string = ""
    ): Promise<void> => {
      const items = await fs.readdir(dirPath, { withFileTypes: true });

      for (const item of items) {
        const isLast = items.indexOf(item) === items.length - 1;
        const marker = isLast ? "└── " : "├── ";
        const line = prefix + marker + item.name + (item.isDirectory() ? "/" : "");
        results.push(line);

        if (recursive && item.isDirectory()) {
          const newPrefix = prefix + (isLast ? "    " : "│   ");
          await processDirectory(path.join(dirPath, item.name), newPrefix);
        }
      }
    };

    if (recursive) {
      await processDirectory(safePath);
    } else {
      for (const entry of entries) {
        results.push(entry.name + (entry.isDirectory() ? "/" : ""));
      }
    }

    return { success: true, output: results.join("\n") || "(empty directory)" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, output: "", error: `Failed to list files: ${message}` };
  }
}

async function searchCode(
  input: { pattern: string; path?: string; file_pattern?: string },
  workingDir: string
): Promise<ToolResult> {
  try {
    const searchPath = sanitizePath(input.path ?? ".", workingDir);

    // Build grep command
    let command = `grep -rn --color=never`;

    if (input.file_pattern) {
      command += ` --include="${input.file_pattern}"`;
    }

    // Exclude common directories
    command += ` --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next`;

    // Add pattern and path
    command += ` "${input.pattern.replace(/"/g, '\\"')}" "${searchPath}"`;

    const { stdout } = await execAsync(command, {
      cwd: workingDir,
      maxBuffer: 1024 * 1024, // 1MB buffer
    });

    // Limit output to prevent overwhelming results
    const lines = stdout.split("\n").slice(0, 100);
    const output =
      lines.length === 100
        ? lines.join("\n") + "\n... (truncated, more results available)"
        : lines.join("\n");

    return { success: true, output: output || "No matches found" };
  } catch (error) {
    // grep returns exit code 1 when no matches found
    if (error instanceof Error && "code" in error && error.code === 1) {
      return { success: true, output: "No matches found" };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, output: "", error: `Search failed: ${message}` };
  }
}

async function runCommand(
  input: { command: string; timeout_seconds?: number },
  workingDir: string
): Promise<ToolResult> {
  const timeoutMs = (input.timeout_seconds ?? 30) * 1000;

  // Block dangerous commands
  const dangerousPatterns = [
    /rm\s+-rf\s+[\/~]/,
    />\s*\/dev\/sd/,
    /mkfs\./,
    /dd\s+if=/,
    /:(){ :|:& };:/,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(input.command)) {
      return {
        success: false,
        output: "",
        error: "Command blocked: potentially dangerous operation",
      };
    }
  }

  try {
    const { stdout, stderr } = await execAsync(input.command, {
      cwd: workingDir,
      timeout: timeoutMs,
      maxBuffer: 5 * 1024 * 1024, // 5MB buffer
      env: { ...process.env, FORCE_COLOR: "0" },
    });

    const output = stdout + (stderr ? `\nstderr:\n${stderr}` : "");
    return { success: true, output: output || "(no output)" };
  } catch (error) {
    if (error instanceof Error) {
      // Check for timeout
      if ("killed" in error && error.killed) {
        return {
          success: false,
          output: "",
          error: `Command timed out after ${input.timeout_seconds ?? 30} seconds`,
        };
      }

      // Include stderr in error if available
      const execError = error as Error & { stdout?: string; stderr?: string };
      const errorOutput = [
        execError.message,
        execError.stdout ? `stdout: ${execError.stdout}` : "",
        execError.stderr ? `stderr: ${execError.stderr}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      return { success: false, output: "", error: errorOutput };
    }
    return { success: false, output: "", error: String(error) };
  }
}

function taskComplete(input: { summary: string }): ToolResult {
  return {
    success: true,
    output: JSON.stringify({ complete: true, summary: input.summary }),
  };
}

function taskFailed(input: { reason: string }): ToolResult {
  return {
    success: true,
    output: JSON.stringify({ failed: true, reason: input.reason }),
  };
}

// ============================================================================
// Tool Executor
// ============================================================================

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  workingDir: string,
  agentId?: string,
  taskId?: string
): Promise<ToolResult> {
  const context: ToolExecutionContext = { workingDir, agentId, taskId };

  switch (name) {
    case "read_file":
      return readFile(input as { path: string }, workingDir);

    case "write_file":
      return writeFile(
        input as { path: string; content: string },
        context
      );

    case "edit_file":
      return editFile(
        input as { path: string; old_content: string; new_content: string },
        context
      );

    case "list_files":
      return listFiles(
        input as { path: string; recursive?: boolean },
        workingDir
      );

    case "search_code":
      return searchCode(
        input as { pattern: string; path?: string; file_pattern?: string },
        workingDir
      );

    case "run_command":
      return runCommand(
        input as { command: string; timeout_seconds?: number },
        workingDir
      );

    case "task_complete":
      return taskComplete(input as { summary: string });

    case "task_failed":
      return taskFailed(input as { reason: string });

    default:
      return {
        success: false,
        output: "",
        error: `Unknown tool: ${name}`,
      };
  }
}

// ============================================================================
// Helper to check if a tool result indicates task completion
// ============================================================================

export interface TaskCompletionResult {
  complete: boolean;
  failed: boolean;
  summary?: string;
  reason?: string;
}

export function parseTaskCompletion(result: ToolResult): TaskCompletionResult | null {
  if (!result.success) return null;

  try {
    const parsed = JSON.parse(result.output);
    if (parsed.complete || parsed.failed) {
      return {
        complete: !!parsed.complete,
        failed: !!parsed.failed,
        summary: parsed.summary,
        reason: parsed.reason,
      };
    }
  } catch {
    // Not a task completion result
  }

  return null;
}
