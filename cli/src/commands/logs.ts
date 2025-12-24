import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";

import { getApiClient, handleApiError, type AgentLog } from "../api-client.js";

// ============================================================================
// Helpers
// ============================================================================

function getLogTypeColor(logType: string): (s: string) => string {
  const colors: Record<string, (s: string) => string> = {
    THINKING: chalk.magenta,
    TOOL_CALL: chalk.blue,
    TOOL_RESULT: chalk.cyan,
    ERROR: chalk.red,
    INFO: chalk.gray,
    STATUS_CHANGE: chalk.yellow,
  };
  return colors[logType] || chalk.white;
}

function formatLog(log: AgentLog): string {
  const timestamp = new Date(log.createdAt).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const typeColor = getLogTypeColor(log.logType);
  const typeLabel = log.logType.padEnd(12);

  // Truncate long content for display
  let content = log.content;
  if (content.length > 200) {
    content = content.slice(0, 200) + "...";
  }

  // Handle multi-line content
  const lines = content.split("\n");
  if (lines.length > 1) {
    const firstLine = lines[0];
    const moreLines = lines.length - 1;
    content = firstLine + chalk.dim(` (+${moreLines} lines)`);
  }

  return `${chalk.dim(timestamp)} ${typeColor(typeLabel)} ${content}`;
}

function formatStatus(status: string): string {
  const statusColors: Record<string, (s: string) => string> = {
    IDLE: chalk.gray,
    WORKING: chalk.blue,
    PAUSED: chalk.yellow,
    COMPLETED: chalk.green,
    FAILED: chalk.red,
  };

  const colorFn = statusColors[status] || chalk.white;
  return colorFn(status);
}

// ============================================================================
// Logs Command
// ============================================================================

export interface LogsOptions {
  lines?: string;
  follow?: boolean;
  type?: string;
}

export async function logsCommand(
  agentId: string | undefined,
  options: LogsOptions
): Promise<void> {
  const api = getApiClient();
  const limit = parseInt(options.lines || "50", 10);

  let selectedAgentId = agentId;

  // If no agent specified, show selection
  if (!selectedAgentId) {
    const spinner = ora("Fetching agents...").start();

    try {
      const agents = await api.getAgents();
      spinner.stop();

      if (agents.length === 0) {
        console.log(chalk.yellow("\n  No agents found.\n"));
        return;
      }

      // Sort by most recent activity
      agents.sort((a, b) => {
        const aTime = a.lastActivityAt || a.createdAt;
        const bTime = b.lastActivityAt || b.createdAt;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      const { selectedAgent } = await inquirer.prompt([
        {
          type: "list",
          name: "selectedAgent",
          message: "Select an agent:",
          choices: agents.slice(0, 20).map((a) => ({
            name: `${a.name} (${formatStatus(a.status)})`,
            value: a.id,
          })),
        },
      ]);

      selectedAgentId = selectedAgent;
    } catch (error) {
      spinner.fail("Failed to fetch agents");
      handleApiError(error);
    }
  }

  // Fetch and display logs
  async function fetchAndDisplayLogs(
    lastLogId?: string
  ): Promise<{ logs: AgentLog[]; lastId?: string }> {
    const logs = await api.getAgentLogs(selectedAgentId!, { limit });

    // Filter by type if specified
    let filteredLogs = logs;
    if (options.type) {
      const filterType = options.type.toUpperCase();
      filteredLogs = logs.filter((l) => l.logType === filterType);
    }

    // If we have a lastLogId, only show new logs
    if (lastLogId) {
      const lastIndex = filteredLogs.findIndex((l) => l.id === lastLogId);
      if (lastIndex !== -1) {
        filteredLogs = filteredLogs.slice(0, lastIndex);
      }
    }

    return {
      logs: filteredLogs.reverse(), // Oldest first
      lastId: logs[0]?.id,
    };
  }

  // Initial fetch
  const spinner = ora("Fetching logs...").start();

  try {
    const { logs, lastId } = await fetchAndDisplayLogs();
    spinner.stop();

    if (logs.length === 0) {
      console.log(chalk.yellow("\n  No logs found for this agent.\n"));
      if (!options.follow) return;
    } else {
      console.log(chalk.blue(`\n  Logs for agent ${selectedAgentId!.slice(0, 8)}\n`));
      console.log(chalk.dim("─".repeat(70)));

      for (const log of logs) {
        console.log(formatLog(log));
      }

      console.log(chalk.dim("─".repeat(70)));
      console.log(chalk.dim(`  ${logs.length} entries\n`));
    }

    // Follow mode
    if (options.follow) {
      console.log(chalk.dim("  Following logs (Ctrl+C to stop)...\n"));

      let currentLastId = lastId;
      let isRunning = true;

      // Handle Ctrl+C
      process.on("SIGINT", () => {
        isRunning = false;
        console.log(chalk.dim("\n  Stopped following.\n"));
        process.exit(0);
      });

      // Poll for new logs every 2 seconds
      while (isRunning) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        try {
          const { logs: newLogs, lastId: newLastId } =
            await fetchAndDisplayLogs(currentLastId);

          for (const log of newLogs) {
            console.log(formatLog(log));
          }

          if (newLastId) {
            currentLastId = newLastId;
          }
        } catch {
          // Silently continue on errors during follow
        }
      }
    }
  } catch (error) {
    spinner.fail("Failed to fetch logs");
    handleApiError(error);
  }
}
