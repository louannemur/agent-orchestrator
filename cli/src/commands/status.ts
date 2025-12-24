import chalk from "chalk";
import ora from "ora";
import { table } from "table";

import { getApiClient, handleApiError, type Agent } from "../api-client.js";

// ============================================================================
// Helpers
// ============================================================================

function formatStatus(status: string): string {
  const statusColors: Record<string, (s: string) => string> = {
    IDLE: chalk.gray,
    WORKING: chalk.blue,
    PAUSED: chalk.yellow,
    COMPLETED: chalk.green,
    FAILED: chalk.red,
    STUCK: chalk.red,
  };

  const colorFn = statusColors[status] || chalk.white;
  return colorFn(status.toLowerCase());
}

function formatElapsed(startedAt: string | null): string {
  if (!startedAt) return chalk.dim("-");

  const started = new Date(startedAt);
  const now = new Date();
  const diffMs = now.getTime() - started.getTime();

  const minutes = Math.floor(diffMs / 60000);
  const seconds = Math.floor((diffMs % 60000) / 1000);

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

// ============================================================================
// Status Command
// ============================================================================

export async function statusCommand(): Promise<void> {
  const spinner = ora("Fetching status...").start();

  try {
    const api = getApiClient();

    // Fetch dashboard stats and agents in parallel
    const [stats, agents] = await Promise.all([
      api.getDashboardStats(),
      api.getAgents(),
    ]);

    spinner.stop();

    // Filter to only show working/stuck agents
    const activeAgents = agents.filter(
      (a) => a.status === "WORKING" || a.status === "PAUSED"
    );

    // Check for stuck agents (working for > 10 minutes with no recent activity)
    const now = new Date();
    const stuckAgents = activeAgents.filter((a) => {
      if (a.status !== "WORKING") return false;
      const lastActivity = a.lastActivityAt
        ? new Date(a.lastActivityAt)
        : a.startedAt
          ? new Date(a.startedAt)
          : null;

      if (!lastActivity) return false;

      const inactiveMs = now.getTime() - lastActivity.getTime();
      return inactiveMs > 10 * 60 * 1000; // 10 minutes
    });

    // Print header
    console.log(chalk.blue("\n  Agent Orchestrator Status\n"));

    // Print active agents table
    if (activeAgents.length > 0) {
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
          chalk.cyan("Agent"),
          chalk.cyan("Status"),
          chalk.cyan("Task"),
          chalk.cyan("Elapsed"),
        ],
        ...activeAgents.map((a) => {
          const isStuck = stuckAgents.includes(a);
          const status = isStuck ? "STUCK" : a.status;

          return [
            a.name.slice(0, 12),
            formatStatus(status),
            a.currentTask
              ? truncate(a.currentTask.title, 30)
              : chalk.dim("-"),
            formatElapsed(a.startedAt),
          ];
        }),
      ];

      console.log(table(tableData, tableConfig));
    } else {
      console.log(chalk.dim("  No active agents\n"));
    }

    // Print stats summary
    const successRate =
      stats.completedTasks + stats.failedTasks > 0
        ? Math.round(
            (stats.completedTasks / (stats.completedTasks + stats.failedTasks)) *
              100
          )
        : 0;

    const statsLine = [
      `${chalk.blue(stats.activeAgents)} active`,
      `${chalk.yellow(stats.pendingTasks)} queued`,
      `${chalk.green(successRate + "%")} success rate`,
    ];

    if (stats.openExceptions > 0) {
      statsLine.push(`${chalk.red(stats.openExceptions)} exception${stats.openExceptions > 1 ? "s" : ""}`);
    }

    console.log(chalk.dim("  Stats: ") + statsLine.join(chalk.dim(" | ")));

    // Warning for stuck agents
    if (stuckAgents.length > 0) {
      console.log(
        chalk.yellow(
          `\n  ⚠ ${stuckAgents.length} agent(s) appear to be stuck (no activity for >10 min)`
        )
      );
    }

    console.log();
  } catch (error) {
    spinner.fail("Failed to fetch status");
    handleApiError(error);
  }
}
