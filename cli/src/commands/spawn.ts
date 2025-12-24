import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";

import { getApiClient, handleApiError } from "../api-client.js";
import { loadConfig } from "../config.js";

// ============================================================================
// Helpers
// ============================================================================

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

// ============================================================================
// Spawn Command
// ============================================================================

export interface SpawnOptions {
  dir?: string;
  count?: number;
}

export async function spawnCommand(
  taskId: string | undefined,
  options: SpawnOptions
): Promise<void> {
  const config = loadConfig();
  const api = getApiClient();

  let selectedTaskId = taskId;
  let workingDir = options.dir || config.defaultWorkingDir;
  const count = options.count || 1;

  // If no task specified, show task selection
  if (!selectedTaskId) {
    const spinner = ora("Fetching queued tasks...").start();

    try {
      const tasks = await api.getTasks();
      spinner.stop();

      const queuedTasks = tasks.filter((t) => t.status === "QUEUED");

      if (queuedTasks.length === 0) {
        console.log(
          chalk.yellow("\n  No queued tasks available.")
        );
        console.log(
          chalk.dim("  Create a task first with: swarm task add \"title\"\n")
        );
        return;
      }

      // Sort by priority (0 = highest)
      queuedTasks.sort((a, b) => a.priority - b.priority);

      const { selectedTask } = await inquirer.prompt([
        {
          type: "list",
          name: "selectedTask",
          message: "Select a task to assign:",
          choices: queuedTasks.map((t) => ({
            name: `[P${t.priority}] ${truncate(t.title, 50)}`,
            value: t.id,
          })),
        },
      ]);

      selectedTaskId = selectedTask;
    } catch (error) {
      spinner.fail("Failed to fetch tasks");
      handleApiError(error);
    }
  }

  // Prompt for working directory if not provided
  if (!options.dir) {
    const { confirmedDir } = await inquirer.prompt([
      {
        type: "input",
        name: "confirmedDir",
        message: "Working directory:",
        default: workingDir,
        validate: (input: string) => {
          if (!input.startsWith("/") && !input.match(/^[A-Za-z]:\\/)) {
            return "Please enter an absolute path";
          }
          return true;
        },
      },
    ]);
    workingDir = confirmedDir;
  }

  // Spawn agent(s)
  if (count > 1) {
    // Spawn multiple agents for the queue
    console.log(chalk.blue(`\n  Spawning ${count} agents...\n`));

    const tasks = await api.getTasks();
    const queuedTasks = tasks
      .filter((t) => t.status === "QUEUED")
      .sort((a, b) => a.priority - b.priority)
      .slice(0, count);

    if (queuedTasks.length === 0) {
      console.log(chalk.yellow("  No queued tasks available.\n"));
      return;
    }

    let spawned = 0;
    for (const task of queuedTasks) {
      const spinner = ora(`Spawning agent for: ${truncate(task.title, 40)}`).start();
      try {
        const result = await api.spawnAgent(task.id, workingDir);
        spinner.succeed(
          `Agent ${chalk.cyan(result.agentId.slice(0, 8))} → ${truncate(task.title, 40)}`
        );
        spawned++;
      } catch (error) {
        spinner.fail(`Failed: ${truncate(task.title, 40)}`);
      }
    }

    console.log(chalk.green(`\n  ✓ Spawned ${spawned} agent(s)\n`));
  } else {
    // Spawn single agent
    const spinner = ora("Spawning agent...").start();

    try {
      const result = await api.spawnAgent(selectedTaskId!, workingDir);

      // Get task details for display
      const task = await api.getTask(selectedTaskId!);

      spinner.succeed(`Spawned agent ${chalk.cyan(result.agentId.slice(0, 8))}`);
      console.log(chalk.dim(`  Task: ${task.title}`));
      console.log(chalk.dim(`  Working directory: ${workingDir}`));
      console.log(chalk.dim(`\n  View logs: swarm logs ${result.agentId.slice(0, 8)}\n`));
    } catch (error) {
      spinner.fail("Failed to spawn agent");
      handleApiError(error);
    }
  }
}
