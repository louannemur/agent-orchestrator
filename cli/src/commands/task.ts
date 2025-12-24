import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import { table } from "table";

import { getApiClient, handleApiError, type Task } from "../api-client.js";
import { loadConfig } from "../config.js";

// ============================================================================
// Helpers
// ============================================================================

function formatStatus(status: string): string {
  const statusColors: Record<string, (s: string) => string> = {
    QUEUED: chalk.yellow,
    IN_PROGRESS: chalk.blue,
    VERIFYING: chalk.magenta,
    COMPLETED: chalk.green,
    FAILED: chalk.red,
    CANCELLED: chalk.gray,
  };

  const colorFn = statusColors[status] || chalk.white;
  return colorFn(status);
}

function formatDate(dateString: string | null): string {
  if (!dateString) return chalk.dim("-");
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

function getPriorityLabel(priority: number): string {
  const labels: Record<number, string> = {
    0: chalk.red("P0 Urgent"),
    1: chalk.yellow("P1 High"),
    2: chalk.blue("P2 Normal"),
    3: chalk.gray("P3 Low"),
  };
  return labels[priority] || chalk.gray(`P${priority}`);
}

// ============================================================================
// Task Add Command
// ============================================================================

export interface TaskAddOptions {
  description?: string;
  priority?: string;
  risk?: string;
  files?: string;
}

export async function taskAddCommand(
  title: string | undefined,
  options: TaskAddOptions
): Promise<void> {
  let taskTitle = title;
  let description = options.description;
  const priority = parseInt(options.priority || "2", 10);
  const riskLevel = options.risk || "MEDIUM";

  // Interactive prompts if not provided
  if (!taskTitle) {
    const { inputTitle } = await inquirer.prompt([
      {
        type: "input",
        name: "inputTitle",
        message: "Task title:",
        validate: (input: string) =>
          input.trim().length > 0 || "Title is required",
      },
    ]);
    taskTitle = inputTitle;
  }

  if (!description) {
    console.log(chalk.dim("  Enter task description (press Enter twice to finish):"));

    const { inputDescription } = await inquirer.prompt([
      {
        type: "editor",
        name: "inputDescription",
        message: "Task description:",
        default: "## Task\n\nDescribe what needs to be done.\n\n## Requirements\n\n- \n",
      },
    ]);
    description = inputDescription;
  }

  // Parse files hint
  const filesHint = options.files ? options.files.split(",").map((f) => f.trim()) : [];

  // Create the task
  const spinner = ora("Creating task...").start();

  try {
    const api = getApiClient();
    const task = await api.createTask({
      title: taskTitle!,
      description: description || "",
      priority,
      riskLevel,
      filesHint,
    });

    spinner.succeed(`Task created: ${chalk.cyan(task.id.slice(0, 8))}`);
    console.log(chalk.dim(`  Title: ${task.title}`));
    console.log(chalk.dim(`  Priority: ${getPriorityLabel(task.priority)}`));
    console.log(chalk.dim(`\n  Run task: swarm task run ${task.id.slice(0, 8)}\n`));
  } catch (error) {
    spinner.fail("Failed to create task");
    handleApiError(error);
  }
}

// ============================================================================
// Task List Command
// ============================================================================

export interface TaskListOptions {
  status?: string;
  limit?: string;
}

export async function taskListCommand(options: TaskListOptions): Promise<void> {
  const spinner = ora("Fetching tasks...").start();

  try {
    const api = getApiClient();
    let tasks = await api.getTasks();

    // Filter by status
    if (options.status) {
      const filterStatus = options.status.toUpperCase();
      tasks = tasks.filter((t) => t.status === filterStatus);
    }

    // Limit results
    const limit = parseInt(options.limit || "50", 10);
    tasks = tasks.slice(0, limit);

    spinner.stop();

    if (tasks.length === 0) {
      console.log(chalk.yellow("\n  No tasks found.\n"));
      return;
    }

    // Sort by priority then by creation date
    tasks.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const tableConfig = {
      border: {
        topBody: chalk.dim("─"),
        topJoin: chalk.dim("┬"),
        topLeft: chalk.dim("┌"),
        topRight: chalk.dim("┐"),
        bottomBody: chalk.dim("─"),
        bottomJoin: chalk.dim("┴"),
        bottomLeft: chalk.dim("└"),
        bottomRight: chalk.dim("┘"),
        bodyLeft: chalk.dim("│"),
        bodyRight: chalk.dim("│"),
        bodyJoin: chalk.dim("│"),
        joinBody: chalk.dim("─"),
        joinLeft: chalk.dim("├"),
        joinRight: chalk.dim("┤"),
        joinJoin: chalk.dim("┼"),
      },
    };

    const tableData = [
      [
        chalk.cyan("ID"),
        chalk.cyan("Pri"),
        chalk.cyan("Title"),
        chalk.cyan("Status"),
        chalk.cyan("Created"),
      ],
      ...tasks.map((t) => [
        t.id.slice(0, 8),
        `P${t.priority}`,
        truncate(t.title, 35),
        formatStatus(t.status),
        formatDate(t.createdAt),
      ]),
    ];

    console.log();
    console.log(table(tableData, tableConfig));
    console.log(chalk.dim(`  ${tasks.length} task(s)\n`));
  } catch (error) {
    spinner.fail("Failed to fetch tasks");
    handleApiError(error);
  }
}

// ============================================================================
// Task View Command
// ============================================================================

export async function taskViewCommand(taskId: string): Promise<void> {
  const spinner = ora("Fetching task...").start();

  try {
    const api = getApiClient();
    const task = await api.getTask(taskId);

    spinner.stop();

    console.log(chalk.blue(`\n  Task: ${task.title}\n`));
    console.log(chalk.dim("  " + "─".repeat(50)));

    console.log(`  ${chalk.cyan("ID:")}           ${task.id}`);
    console.log(`  ${chalk.cyan("Status:")}       ${formatStatus(task.status)}`);
    console.log(`  ${chalk.cyan("Priority:")}     ${getPriorityLabel(task.priority)}`);
    console.log(`  ${chalk.cyan("Risk Level:")}   ${task.riskLevel}`);
    console.log(`  ${chalk.cyan("Created:")}      ${formatDate(task.createdAt)}`);

    if (task.startedAt) {
      console.log(`  ${chalk.cyan("Started:")}      ${formatDate(task.startedAt)}`);
    }

    if (task.completedAt) {
      console.log(`  ${chalk.cyan("Completed:")}    ${formatDate(task.completedAt)}`);
    }

    if (task.assignedAgent) {
      console.log(
        `  ${chalk.cyan("Agent:")}        ${task.assignedAgent.name} (${formatStatus(task.assignedAgent.status)})`
      );
    }

    if (task.retryCount > 0) {
      console.log(`  ${chalk.cyan("Retries:")}      ${task.retryCount}`);
    }

    console.log(chalk.dim("\n  " + "─".repeat(50)));
    console.log(chalk.cyan("\n  Description:\n"));

    // Indent description
    const descriptionLines = task.description.split("\n");
    for (const line of descriptionLines) {
      console.log(`  ${line}`);
    }

    console.log();
  } catch (error) {
    spinner.fail("Failed to fetch task");
    handleApiError(error);
  }
}

// ============================================================================
// Task Run Command
// ============================================================================

export interface TaskRunOptions {
  dir?: string;
}

export async function taskRunCommand(
  taskId: string,
  options: TaskRunOptions
): Promise<void> {
  const config = loadConfig();
  let workingDir = options.dir || config.defaultWorkingDir;

  // Prompt for working directory if not provided
  if (!options.dir) {
    const { confirmedDir } = await inquirer.prompt([
      {
        type: "input",
        name: "confirmedDir",
        message: "Working directory:",
        default: workingDir,
      },
    ]);
    workingDir = confirmedDir;
  }

  const spinner = ora("Starting task...").start();

  try {
    const api = getApiClient();
    const result = await api.runTask(taskId, workingDir);

    spinner.succeed(`Task started with agent: ${chalk.cyan(result.agentId.slice(0, 8))}`);
    console.log(chalk.dim(`  Task ID: ${taskId.slice(0, 8)}`));
    console.log(chalk.dim(`  Working directory: ${workingDir}`));
    console.log(chalk.dim(`\n  View logs: swarm logs ${result.agentId.slice(0, 8)}\n`));
  } catch (error) {
    spinner.fail("Failed to run task");
    handleApiError(error);
  }
}

// ============================================================================
// Task Cancel Command
// ============================================================================

export interface TaskCancelOptions {
  force?: boolean;
}

export async function taskCancelCommand(
  taskId: string,
  options: TaskCancelOptions
): Promise<void> {
  // Confirm unless --force
  if (!options.force) {
    const { confirm } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirm",
        message: `Cancel task ${taskId.slice(0, 8)}?`,
        default: false,
      },
    ]);

    if (!confirm) {
      console.log(chalk.yellow("  Cancelled.\n"));
      return;
    }
  }

  const spinner = ora("Cancelling task...").start();

  try {
    const api = getApiClient();
    await api.cancelTask(taskId);

    spinner.succeed("Task cancelled");
    console.log(chalk.dim(`  Task ${taskId.slice(0, 8)} has been cancelled.\n`));
  } catch (error) {
    spinner.fail("Failed to cancel task");
    handleApiError(error);
  }
}
