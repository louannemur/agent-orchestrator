import chalk from "chalk";
import ora from "ora";
import { table } from "table";

import { getApiClient, handleApiError } from "../api-client.js";

// ============================================================================
// Helpers
// ============================================================================

function formatStatus(status: string): string {
  const statusColors: Record<string, (s: string) => string> = {
    QUEUED: chalk.yellow,
    IN_PROGRESS: chalk.blue,
    VERIFYING: chalk.magenta,
  };

  const colorFn = statusColors[status] || chalk.white;
  return colorFn(status);
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

function formatWaitTime(createdAt: string): string {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();

  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) return chalk.dim("just now");
  if (minutes < 60) return chalk.dim(`${minutes}m ago`);

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return chalk.dim(`${hours}h ago`);

  const days = Math.floor(hours / 24);
  return chalk.yellow(`${days}d ago`);
}

function getPriorityColor(priority: number): (s: string) => string {
  const colors: Record<number, (s: string) => string> = {
    0: chalk.red,
    1: chalk.yellow,
    2: chalk.blue,
    3: chalk.gray,
  };
  return colors[priority] || chalk.white;
}

// ============================================================================
// Queue Command
// ============================================================================

export async function queueCommand(): Promise<void> {
  const spinner = ora("Fetching queue...").start();

  try {
    const api = getApiClient();
    const queue = await api.getQueueStatus();

    spinner.stop();

    console.log(chalk.blue("\n  Task Queue\n"));
    console.log(chalk.dim("  " + "─".repeat(50)));

    // Summary
    console.log(
      `  ${chalk.yellow("Queued:")}      ${queue.queued} task${queue.queued !== 1 ? "s" : ""}`
    );
    console.log(
      `  ${chalk.blue("In Progress:")} ${queue.inProgress} task${queue.inProgress !== 1 ? "s" : ""}`
    );

    if (queue.tasks.length === 0) {
      console.log(chalk.dim("\n  Queue is empty.\n"));
      return;
    }

    console.log(chalk.dim("\n  " + "─".repeat(50)));

    // Separate queued and in-progress tasks
    const queuedTasks = queue.tasks
      .filter((t) => t.status === "QUEUED")
      .sort((a, b) => a.priority - b.priority);

    const inProgressTasks = queue.tasks.filter(
      (t) => t.status === "IN_PROGRESS" || t.status === "VERIFYING"
    );

    // Show in-progress tasks
    if (inProgressTasks.length > 0) {
      console.log(chalk.cyan("\n  In Progress:\n"));

      for (const task of inProgressTasks) {
        const agentInfo = task.assignedAgent
          ? chalk.dim(` (${task.assignedAgent.name})`)
          : "";

        console.log(
          `    ${formatStatus(task.status.padEnd(11))} ${truncate(task.title, 45)}${agentInfo}`
        );
      }
    }

    // Show queued tasks in priority order
    if (queuedTasks.length > 0) {
      console.log(chalk.cyan("\n  Queued (by priority):\n"));

      const tableConfig = {
        border: {
          topBody: chalk.dim("─"),
          topJoin: chalk.dim("┬"),
          topLeft: chalk.dim("  ┌"),
          topRight: chalk.dim("┐"),
          bottomBody: chalk.dim("─"),
          bottomJoin: chalk.dim("┴"),
          bottomLeft: chalk.dim("  └"),
          bottomRight: chalk.dim("┘"),
          bodyLeft: chalk.dim("  │"),
          bodyRight: chalk.dim("│"),
          bodyJoin: chalk.dim("│"),
          joinBody: chalk.dim("─"),
          joinLeft: chalk.dim("  ├"),
          joinRight: chalk.dim("┤"),
          joinJoin: chalk.dim("┼"),
        },
      };

      const tableData = [
        [
          chalk.cyan("#"),
          chalk.cyan("Pri"),
          chalk.cyan("Title"),
          chalk.cyan("Waiting"),
        ],
        ...queuedTasks.map((t, i) => {
          const priorityColor = getPriorityColor(t.priority);
          return [
            chalk.dim((i + 1).toString()),
            priorityColor(`P${t.priority}`),
            truncate(t.title, 40),
            formatWaitTime(t.createdAt),
          ];
        }),
      ];

      console.log(table(tableData, tableConfig));
    }

    // Helpful commands
    console.log(chalk.dim("  Commands:"));
    console.log(chalk.dim("    swarm spawn          Spawn agent for next task"));
    console.log(chalk.dim("    swarm spawn --count N  Spawn N agents for queue"));
    console.log(chalk.dim("    swarm task add       Add new task to queue\n"));
  } catch (error) {
    spinner.fail("Failed to fetch queue");
    handleApiError(error);
  }
}
