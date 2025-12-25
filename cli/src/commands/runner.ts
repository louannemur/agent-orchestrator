import chalk from "chalk";
import ora from "ora";
import Anthropic from "@anthropic-ai/sdk";
import { exec } from "child_process";
import { promises as fs } from "fs";
import * as path from "path";
import { promisify } from "util";

import {
  loadConfig,
  getRunnerConfig,
  setRunnerConfig,
  isRunnerConfigured,
} from "../config.js";
import { getApiClient } from "../api-client.js";

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

interface TaskInfo {
  id: string;
  title: string;
  description: string;
  priority: number;
  riskLevel: string;
  filesHint: string[];
}

interface AgentInfo {
  id: string;
  branchName: string | null;
}

interface LogEntry {
  logType: "THINKING" | "TOOL_CALL" | "TOOL_RESULT" | "ERROR" | "INFO" | "STATUS_CHANGE";
  content: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

// ============================================================================
// Runner API Client
// ============================================================================

class RunnerApiClient {
  private baseUrl: string;
  private runnerToken: string;

  constructor(baseUrl: string, runnerToken: string) {
    this.baseUrl = baseUrl;
    this.runnerToken = runnerToken;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = await response.json() as { data?: T; message?: string; error?: string };

    if (!response.ok) {
      throw new Error(json.message || json.error || "Request failed");
    }

    return json.data as T;
  }

  async register(name: string, workingDir: string): Promise<{ session: { id: string; token: string } }> {
    return this.request("POST", "/api/runner/status", { name, workingDir });
  }

  async getStatus(): Promise<{ availableTasks: { count: number } }> {
    const token = encodeURIComponent(this.runnerToken);
    return this.request("GET", `/api/runner/status?runnerToken=${token}`);
  }

  async claimTask(workingDir: string): Promise<{ task: TaskInfo; agent: AgentInfo } | null> {
    const result = await this.request<{ task: TaskInfo | null; agent: AgentInfo | null }>(
      "POST",
      "/api/runner/claim",
      { runnerToken: this.runnerToken, workingDir }
    );
    if (!result.task) return null;
    return result as { task: TaskInfo; agent: AgentInfo };
  }

  async sendHeartbeat(agentId: string, taskId?: string, tokensUsed?: number): Promise<void> {
    await this.request("POST", "/api/runner/heartbeat", {
      runnerToken: this.runnerToken,
      agentId,
      taskId,
      tokensUsed,
    });
  }

  async sendLogs(agentId: string, taskId: string, logs: LogEntry[]): Promise<void> {
    await this.request("POST", "/api/runner/logs", {
      runnerToken: this.runnerToken,
      agentId,
      taskId,
      logs,
    });
  }

  async completeTask(
    agentId: string,
    taskId: string,
    success: boolean,
    options: { summary?: string; error?: string } = {}
  ): Promise<void> {
    await this.request("POST", "/api/runner/complete", {
      runnerToken: this.runnerToken,
      agentId,
      taskId,
      success,
      ...options,
    });
  }
}

// ============================================================================
// Tool Definitions
// ============================================================================

const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: "read_file",
    description: "Read the contents of a file",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "The path to the file to read" },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write content to a file. Will create the file if it doesn't exist.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "The path to the file to write" },
        content: { type: "string", description: "The content to write to the file" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "edit_file",
    description: "Edit a file by replacing a specific string with new content",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "The path to the file to edit" },
        old_content: { type: "string", description: "The exact content to find and replace" },
        new_content: { type: "string", description: "The new content to replace with" },
      },
      required: ["path", "old_content", "new_content"],
    },
  },
  {
    name: "list_files",
    description: "List files and directories at a path",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "The directory path to list" },
        recursive: { type: "boolean", description: "Whether to list files recursively" },
      },
      required: ["path"],
    },
  },
  {
    name: "search_code",
    description: "Search for a pattern in files using grep",
    input_schema: {
      type: "object" as const,
      properties: {
        pattern: { type: "string", description: "The search pattern (regex supported)" },
        path: { type: "string", description: "The directory to search in" },
        file_pattern: { type: "string", description: "File pattern to filter (e.g., '*.ts')" },
      },
      required: ["pattern"],
    },
  },
  {
    name: "run_command",
    description: "Run a shell command. Use for running tests, installing packages, etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        command: { type: "string", description: "The shell command to run" },
        timeout_seconds: { type: "number", description: "Timeout in seconds (default 30)" },
      },
      required: ["command"],
    },
  },
  {
    name: "task_complete",
    description: "Mark the current task as complete. Call this when you've finished the task.",
    input_schema: {
      type: "object" as const,
      properties: {
        summary: { type: "string", description: "A summary of what was accomplished" },
      },
      required: ["summary"],
    },
  },
  {
    name: "task_failed",
    description: "Mark the task as failed if you cannot complete it.",
    input_schema: {
      type: "object" as const,
      properties: {
        reason: { type: "string", description: "The reason why the task cannot be completed" },
      },
      required: ["reason"],
    },
  },
];

// ============================================================================
// Tool Execution
// ============================================================================

function sanitizePath(inputPath: string, workingDir: string): string {
  const resolved = path.resolve(workingDir, inputPath);
  const normalizedWorkingDir = path.normalize(workingDir);
  const normalizedResolved = path.normalize(resolved);

  if (!normalizedResolved.startsWith(normalizedWorkingDir)) {
    throw new Error(`Path traversal detected: ${inputPath} resolves outside working directory`);
  }

  return resolved;
}

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  workingDir: string
): Promise<ToolResult> {
  try {
    switch (name) {
      case "read_file": {
        const safePath = sanitizePath(input.path as string, workingDir);
        const content = await fs.readFile(safePath, "utf-8");
        return { success: true, output: content };
      }

      case "write_file": {
        const safePath = sanitizePath(input.path as string, workingDir);
        const dir = path.dirname(safePath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(safePath, input.content as string, "utf-8");
        return { success: true, output: `Successfully wrote to ${input.path}` };
      }

      case "edit_file": {
        const safePath = sanitizePath(input.path as string, workingDir);
        const content = await fs.readFile(safePath, "utf-8");
        const oldContent = input.old_content as string;
        const newContent = input.new_content as string;

        const occurrences = content.split(oldContent).length - 1;
        if (occurrences === 0) {
          return { success: false, output: "", error: "old_content not found in file" };
        }
        if (occurrences > 1) {
          return {
            success: false,
            output: "",
            error: `old_content found ${occurrences} times. Please provide more specific content.`,
          };
        }

        const updated = content.replace(oldContent, newContent);
        await fs.writeFile(safePath, updated, "utf-8");
        return { success: true, output: `Successfully edited ${input.path}` };
      }

      case "list_files": {
        const safePath = sanitizePath(input.path as string, workingDir);
        const entries = await fs.readdir(safePath, { withFileTypes: true });
        const results = entries.map((e) => e.name + (e.isDirectory() ? "/" : ""));
        return { success: true, output: results.join("\n") || "(empty directory)" };
      }

      case "search_code": {
        const searchPath = sanitizePath((input.path as string) || ".", workingDir);
        let command = `grep -rn --color=never`;
        if (input.file_pattern) {
          command += ` --include="${input.file_pattern}"`;
        }
        command += ` --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next`;
        command += ` "${(input.pattern as string).replace(/"/g, '\\"')}" "${searchPath}"`;

        try {
          const { stdout } = await execAsync(command, { cwd: workingDir, maxBuffer: 1024 * 1024 });
          const lines = stdout.split("\n").slice(0, 100);
          return { success: true, output: lines.join("\n") || "No matches found" };
        } catch (error) {
          if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "1") {
            return { success: true, output: "No matches found" };
          }
          throw error;
        }
      }

      case "run_command": {
        const timeoutMs = ((input.timeout_seconds as number) || 30) * 1000;
        const { stdout, stderr } = await execAsync(input.command as string, {
          cwd: workingDir,
          timeout: timeoutMs,
          maxBuffer: 5 * 1024 * 1024,
        });
        return { success: true, output: stdout + (stderr ? `\nstderr:\n${stderr}` : "") };
      }

      case "task_complete":
        return {
          success: true,
          output: JSON.stringify({ complete: true, summary: input.summary }),
        };

      case "task_failed":
        return {
          success: true,
          output: JSON.stringify({ failed: true, reason: input.reason }),
        };

      default:
        return { success: false, output: "", error: `Unknown tool: ${name}` };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, output: "", error: message };
  }
}

// ============================================================================
// Local Agent Executor
// ============================================================================

async function executeTask(
  task: TaskInfo,
  agent: AgentInfo,
  workingDir: string,
  apiClient: RunnerApiClient,
  anthropic: Anthropic,
  maxIterations: number
): Promise<{ success: boolean; summary?: string; error?: string }> {
  const conversationHistory: Anthropic.MessageParam[] = [];
  let totalTokens = 0;
  const logBuffer: LogEntry[] = [];

  const flushLogs = async () => {
    if (logBuffer.length > 0) {
      try {
        await apiClient.sendLogs(agent.id, task.id, [...logBuffer]);
        logBuffer.length = 0;
      } catch (error) {
        console.error(chalk.dim("  Failed to send logs:", error));
      }
    }
  };

  const addLog = (logType: LogEntry["logType"], content: string, metadata?: Record<string, unknown>) => {
    logBuffer.push({ logType, content: content.slice(0, 50000), metadata, timestamp: new Date().toISOString() });
    if (logBuffer.length >= 10) {
      flushLogs();
    }
  };

  const systemPrompt = `You are an AI software engineering agent working on a specific task.

## Task
**Title:** ${task.title}

**Description:**
${task.description}

## Working Environment
- Working directory: ${workingDir}
- Branch: ${agent.branchName || "main"}
${task.filesHint?.length ? `\nRelevant files:\n${task.filesHint.map((f) => `- ${f}`).join("\n")}` : ""}

## Instructions
1. Focus ONLY on this specific task.
2. Use the available tools to explore the codebase and make changes.
3. Always read relevant files before modifying them.
4. When done, call the \`task_complete\` tool with a summary.
5. If you cannot complete the task, call the \`task_failed\` tool.`;

  addLog("STATUS_CHANGE", `Started working on task: ${task.title}`);

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    // Send heartbeat
    try {
      await apiClient.sendHeartbeat(agent.id, task.id, totalTokens);
    } catch {
      // Ignore heartbeat errors
    }

    // Call Claude API
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8096,
      system: systemPrompt,
      messages: conversationHistory.length > 0
        ? conversationHistory
        : [{ role: "user", content: "Begin working on the task." }],
      tools: AGENT_TOOLS,
    });

    totalTokens += response.usage.input_tokens + response.usage.output_tokens;

    // Process response
    const assistantContent: Anthropic.ContentBlock[] = [];
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      assistantContent.push(block);

      if (block.type === "text") {
        addLog("THINKING", block.text);
        console.log(chalk.dim("  Agent thinking..."));
      } else if (block.type === "tool_use") {
        addLog("TOOL_CALL", `Calling ${block.name}`, { tool: block.name, input: block.input });
        console.log(chalk.cyan(`  Tool: ${block.name}`));

        const toolResult = await executeTool(
          block.name,
          block.input as Record<string, unknown>,
          workingDir
        );

        addLog(
          toolResult.success ? "TOOL_RESULT" : "ERROR",
          toolResult.success ? toolResult.output : toolResult.error || "Unknown error",
          { tool: block.name, success: toolResult.success }
        );

        // Check for task completion
        try {
          const parsed = JSON.parse(toolResult.output);
          if (parsed.complete) {
            await flushLogs();
            addLog("STATUS_CHANGE", `Task completed: ${parsed.summary}`);
            await flushLogs();
            return { success: true, summary: parsed.summary };
          }
          if (parsed.failed) {
            await flushLogs();
            addLog("STATUS_CHANGE", `Task failed: ${parsed.reason}`);
            await flushLogs();
            return { success: false, error: parsed.reason };
          }
        } catch {
          // Not a completion result
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: toolResult.success ? toolResult.output : `Error: ${toolResult.error}`,
        });
      }
    }

    conversationHistory.push({ role: "assistant", content: assistantContent });

    if (toolResults.length > 0) {
      conversationHistory.push({ role: "user", content: toolResults });
    } else if (response.stop_reason === "end_turn") {
      conversationHistory.push({
        role: "user",
        content: "Please continue working on the task. If complete, call task_complete. If stuck, call task_failed.",
      });
    }

    // Flush logs periodically
    if (iteration % 5 === 0) {
      await flushLogs();
    }
  }

  await flushLogs();
  return { success: false, error: `Reached maximum iterations (${maxIterations})` };
}

// ============================================================================
// Runner Commands
// ============================================================================

export interface RunnerRegisterOptions {
  name?: string;
}

export async function runnerRegisterCommand(options: RunnerRegisterOptions): Promise<void> {
  const config = loadConfig();
  const spinner = ora("Registering runner with cloud...").start();

  try {
    const name = options.name || `runner-${Date.now()}`;
    const workingDir = config.defaultWorkingDir || process.cwd();

    const client = new RunnerApiClient(config.apiUrl, "");
    const result = await client.register(name, workingDir);

    setRunnerConfig({
      runnerToken: result.session.token,
      runnerName: name,
    });

    spinner.succeed("Runner registered successfully");
    console.log();
    console.log(chalk.green(`  Runner Name: ${name}`));
    console.log(chalk.dim(`  Token saved to config`));
    console.log();
    console.log(chalk.dim("  Start the runner with:"));
    console.log(chalk.cyan("    swarm runner start --dir /path/to/project"));
    console.log();
  } catch (error) {
    spinner.fail("Failed to register runner");
    if (error instanceof Error) {
      console.error(chalk.red(`\n  ${error.message}\n`));
    }
    process.exit(1);
  }
}

// ============================================================================
// Claude Code Executor
// ============================================================================

async function checkClaudeCodeAvailable(): Promise<boolean> {
  try {
    await execAsync("claude --version", { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function executeTaskWithClaudeCode(
  task: TaskInfo,
  agent: AgentInfo,
  workingDir: string,
  apiClient: RunnerApiClient
): Promise<{ success: boolean; summary?: string; error?: string }> {
  const prompt = `You are working on a software task. Here are the details:

**Task:** ${task.title}

**Description:**
${task.description}

**Working Directory:** ${workingDir}
${task.filesHint?.length ? `\n**Relevant files:**\n${task.filesHint.map((f) => `- ${f}`).join("\n")}` : ""}

Please complete this task. When done, provide a brief summary of what you accomplished.`;

  // Send initial log
  try {
    await apiClient.sendLogs(agent.id, task.id, [{
      logType: "STATUS_CHANGE",
      content: `Starting task with Claude Code: ${task.title}`,
      timestamp: new Date().toISOString(),
    }]);
  } catch {
    // Ignore log errors
  }

  // Send heartbeat periodically
  const heartbeatInterval = setInterval(async () => {
    try {
      await apiClient.sendHeartbeat(agent.id, task.id);
    } catch {
      // Ignore heartbeat errors
    }
  }, 30000);

  try {
    console.log(chalk.dim("  Running Claude Code..."));

    // Run Claude Code with the prompt
    const { stdout, stderr } = await execAsync(
      `claude --print "${prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`,
      {
        cwd: workingDir,
        timeout: 10 * 60 * 1000, // 10 minute timeout
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      }
    );

    clearInterval(heartbeatInterval);

    const output = stdout + (stderr ? `\nStderr: ${stderr}` : "");

    // Log the result
    try {
      await apiClient.sendLogs(agent.id, task.id, [{
        logType: "INFO",
        content: output.slice(0, 50000),
        timestamp: new Date().toISOString(),
      }]);
    } catch {
      // Ignore log errors
    }

    // Extract summary from output (last paragraph or truncated)
    const lines = output.trim().split("\n");
    const summary = lines.slice(-5).join(" ").slice(0, 500) || "Task completed";

    return { success: true, summary };
  } catch (error) {
    clearInterval(heartbeatInterval);

    const errorMessage = error instanceof Error ? error.message : String(error);

    // Log the error
    try {
      await apiClient.sendLogs(agent.id, task.id, [{
        logType: "ERROR",
        content: errorMessage,
        timestamp: new Date().toISOString(),
      }]);
    } catch {
      // Ignore log errors
    }

    return { success: false, error: errorMessage };
  }
}

// ============================================================================
// Runner Commands
// ============================================================================

export interface RunnerStartOptions {
  dir?: string;
  once?: boolean;
  useClaudeCode?: boolean;
}

export async function runnerStartCommand(options: RunnerStartOptions): Promise<void> {
  if (!isRunnerConfigured()) {
    console.log(chalk.yellow("\n  Runner not registered. Run 'swarm runner register' first.\n"));
    process.exit(1);
  }

  const config = loadConfig();
  const runnerCfg = getRunnerConfig();
  const workingDir = options.dir || config.defaultWorkingDir || process.cwd();

  // Verify working directory exists
  try {
    await fs.access(workingDir);
  } catch {
    console.log(chalk.red(`\n  Working directory does not exist: ${workingDir}\n`));
    process.exit(1);
  }

  // Check for Claude Code mode
  const useClaudeCode = options.useClaudeCode ?? false;
  let anthropic: Anthropic | null = null;

  if (useClaudeCode) {
    // Check if Claude Code is available
    const isAvailable = await checkClaudeCodeAvailable();
    if (!isAvailable) {
      console.log(chalk.red("\n  Claude Code CLI not found."));
      console.log(chalk.dim("  Install it from: https://claude.ai/download"));
      console.log(chalk.dim("  Or run without --use-claude-code to use API key instead.\n"));
      process.exit(1);
    }
    console.log(chalk.green("  ✓ Using Claude Code (no API key required)\n"));
  } else {
    // Initialize Anthropic client (check config first, then env var)
    const anthropicApiKey = runnerCfg.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      console.log(chalk.red("\n  Anthropic API key is required."));
      console.log(chalk.dim("  Set it with: swarm init"));
      console.log(chalk.dim("  Or use --use-claude-code to use Claude Code instead.\n"));
      process.exit(1);
    }
    anthropic = new Anthropic({ apiKey: anthropicApiKey });
  }

  const apiClient = new RunnerApiClient(config.apiUrl, runnerCfg.runnerToken);

  console.log(chalk.bold("\n  Local Agent Runner\n"));
  console.log(chalk.dim(`  Working directory: ${workingDir}`));
  console.log(chalk.dim(`  API URL: ${config.apiUrl}`));
  console.log(chalk.dim(`  Mode: ${useClaudeCode ? "Claude Code" : "Anthropic API"}`));
  console.log(chalk.dim(`  Poll interval: ${runnerCfg.pollInterval}s`));
  console.log();

  let running = true;

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log(chalk.yellow("\n  Shutting down runner..."));
    running = false;
  });

  while (running) {
    try {
      // Check for available tasks
      const spinner = ora("Checking for tasks...").start();
      const status = await apiClient.getStatus();

      if (status.availableTasks.count === 0) {
        spinner.info("No tasks available");
        if (options.once) break;
        await new Promise((resolve) => setTimeout(resolve, runnerCfg.pollInterval * 1000));
        continue;
      }

      // Claim a task
      spinner.text = "Claiming task...";
      const claimed = await apiClient.claimTask(workingDir);

      if (!claimed) {
        spinner.info("No tasks to claim");
        if (options.once) break;
        await new Promise((resolve) => setTimeout(resolve, runnerCfg.pollInterval * 1000));
        continue;
      }

      spinner.succeed(`Claimed task: ${claimed.task.title}`);
      console.log(chalk.dim(`  Task ID: ${claimed.task.id}`));
      console.log(chalk.dim(`  Agent ID: ${claimed.agent.id}`));
      console.log();

      // Execute the task (use Claude Code or Anthropic API based on mode)
      const result = useClaudeCode
        ? await executeTaskWithClaudeCode(
            claimed.task,
            claimed.agent,
            workingDir,
            apiClient
          )
        : await executeTask(
            claimed.task,
            claimed.agent,
            workingDir,
            apiClient,
            anthropic!,
            runnerCfg.maxIterations
          );

      // Report completion
      await apiClient.completeTask(
        claimed.agent.id,
        claimed.task.id,
        result.success,
        { summary: result.summary, error: result.error }
      );

      if (result.success) {
        console.log(chalk.green(`\n  Task completed: ${result.summary}\n`));
      } else {
        console.log(chalk.red(`\n  Task failed: ${result.error}\n`));
      }

      if (options.once) break;
    } catch (error) {
      if (error instanceof Error) {
        console.error(chalk.red(`\n  Error: ${error.message}\n`));
      }
      if (options.once) break;
      await new Promise((resolve) => setTimeout(resolve, runnerCfg.pollInterval * 1000));
    }
  }

  console.log(chalk.dim("\n  Runner stopped.\n"));
}

export async function runnerStatusCommand(): Promise<void> {
  if (!isRunnerConfigured()) {
    console.log(chalk.yellow("\n  Runner not registered. Run 'swarm runner register' first.\n"));
    return;
  }

  const config = loadConfig();
  const runnerCfg = getRunnerConfig();

  const spinner = ora("Fetching runner status...").start();

  try {
    const apiClient = new RunnerApiClient(config.apiUrl, runnerCfg.runnerToken);
    const status = await apiClient.getStatus();

    spinner.stop();

    console.log(chalk.bold("\n  Local Runner Status\n"));
    console.log(`  Runner Name:    ${chalk.cyan(runnerCfg.runnerName)}`);
    console.log(`  API URL:        ${chalk.dim(config.apiUrl)}`);
    console.log(`  Available Tasks: ${chalk.cyan(status.availableTasks.count)}`);
    console.log();
  } catch (error) {
    spinner.fail("Failed to fetch status");
    if (error instanceof Error) {
      console.error(chalk.red(`\n  ${error.message}\n`));
    }
  }
}
