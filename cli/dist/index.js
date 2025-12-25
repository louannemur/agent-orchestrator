#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { table } from "table";
import { displayConfig, hasValidConfig, loadConfig } from "./config.js";
import { getApiClient, handleApiError } from "./api-client.js";
import { initCommand, statusCommand, spawnCommand, stopCommand, logsCommand, taskAddCommand, taskListCommand, taskViewCommand, taskRunCommand, taskCancelCommand, queueCommand, runnerRegisterCommand, runnerStartCommand, runnerStatusCommand, } from "./commands/index.js";
// ============================================================================
// Program Setup
// ============================================================================
const program = new Command();
program
    .name("swarm")
    .description("CLI for Agent Orchestrator - manage AI agents and tasks")
    .version("1.0.0");
// ============================================================================
// Helpers
// ============================================================================
function checkConfig() {
    if (!hasValidConfig()) {
        console.log(chalk.yellow("\nNo configuration found. Run `swarm init` to set up.\n"));
        console.log(chalk.dim("  Using default API URL: http://localhost:3000\n"));
    }
}
function formatStatus(status) {
    const statusColors = {
        IDLE: chalk.gray,
        WORKING: chalk.blue,
        PAUSED: chalk.yellow,
        COMPLETED: chalk.green,
        FAILED: chalk.red,
        QUEUED: chalk.yellow,
        IN_PROGRESS: chalk.blue,
        VERIFYING: chalk.magenta,
        CANCELLED: chalk.gray,
    };
    const colorFn = statusColors[status] || chalk.white;
    return colorFn(status);
}
function truncate(str, maxLength) {
    if (str.length <= maxLength)
        return str;
    return str.slice(0, maxLength - 3) + "...";
}
// ============================================================================
// Init Command
// ============================================================================
program
    .command("init")
    .description("Initialize swarm configuration")
    .option("-g, --global", "Create global configuration in home directory")
    .action(async (options) => {
    await initCommand({ global: options.global });
});
// ============================================================================
// Config Command
// ============================================================================
program
    .command("config")
    .description("Display or modify configuration")
    .option("--anthropic-key <key>", "Set Anthropic API key")
    .option("--api-url <url>", "Set API URL")
    .action(async (options) => {
    const { setRunnerConfig, getRunnerConfig } = await import("./config.js");
    if (options.anthropicKey) {
        setRunnerConfig({ anthropicApiKey: options.anthropicKey });
        console.log(chalk.green("\n  ✓ Anthropic API key updated.\n"));
        return;
    }
    if (options.apiUrl) {
        const fs = await import("fs");
        const currentConfig = loadConfig();
        currentConfig.apiUrl = options.apiUrl;
        fs.writeFileSync(".swarmrc.json", JSON.stringify(currentConfig, null, 2));
        console.log(chalk.green("\n  ✓ API URL updated.\n"));
        return;
    }
    displayConfig();
});
// ============================================================================
// Status Command
// ============================================================================
program
    .command("status")
    .description("Show overall system status with active agents table")
    .action(async () => {
    checkConfig();
    await statusCommand();
});
// ============================================================================
// Spawn Command
// ============================================================================
program
    .command("spawn")
    .description("Spawn a new agent for a task")
    .argument("[taskId]", "Task ID to assign to the agent")
    .option("-d, --dir <directory>", "Working directory for the agent")
    .option("-c, --count <number>", "Number of agents to spawn for queue", "1")
    .action(async (taskId, options) => {
    checkConfig();
    await spawnCommand(taskId, {
        dir: options.dir,
        count: parseInt(options.count, 10),
    });
});
// ============================================================================
// Stop Command
// ============================================================================
program
    .command("stop")
    .description("Stop an agent")
    .argument("[agentId]", "Agent ID to stop")
    .option("-a, --all", "Stop all running agents")
    .option("-f, --force", "Skip confirmation prompt")
    .action(async (agentId, options) => {
    checkConfig();
    await stopCommand(agentId, {
        all: options.all,
        force: options.force,
    });
});
// ============================================================================
// Logs Command
// ============================================================================
program
    .command("logs")
    .description("View agent logs")
    .argument("[agentId]", "Agent ID to view logs for")
    .option("-n, --lines <number>", "Number of log lines to show", "50")
    .option("-f, --follow", "Follow log output (poll every 2s)")
    .option("-t, --type <type>", "Filter by log type (THINKING, TOOL_CALL, ERROR, etc.)")
    .action(async (agentId, options) => {
    checkConfig();
    await logsCommand(agentId, {
        lines: options.lines,
        follow: options.follow,
        type: options.type,
    });
});
// ============================================================================
// Task Commands
// ============================================================================
const taskCommand = program
    .command("task")
    .description("Task management commands");
taskCommand
    .command("add")
    .description("Create a new task")
    .argument("[title]", "Task title")
    .option("-d, --description <description>", "Task description")
    .option("-p, --priority <priority>", "Priority (0-3, where 0 is highest)", "2")
    .option("-r, --risk <level>", "Risk level (LOW, MEDIUM, HIGH, CRITICAL)", "MEDIUM")
    .option("--files <files>", "Comma-separated list of relevant files")
    .action(async (title, options) => {
    checkConfig();
    await taskAddCommand(title, {
        description: options.description,
        priority: options.priority,
        risk: options.risk,
        files: options.files,
    });
});
taskCommand
    .command("list")
    .description("List all tasks")
    .option("-s, --status <status>", "Filter by status (QUEUED, IN_PROGRESS, COMPLETED, FAILED)")
    .option("-l, --limit <number>", "Maximum number of tasks to show", "50")
    .action(async (options) => {
    checkConfig();
    await taskListCommand({
        status: options.status,
        limit: options.limit,
    });
});
taskCommand
    .command("view")
    .description("Show task details")
    .argument("<taskId>", "Task ID")
    .action(async (taskId) => {
    checkConfig();
    await taskViewCommand(taskId);
});
taskCommand
    .command("run")
    .description("Run a queued task")
    .argument("<taskId>", "Task ID to run")
    .option("-d, --dir <directory>", "Working directory")
    .action(async (taskId, options) => {
    checkConfig();
    await taskRunCommand(taskId, { dir: options.dir });
});
taskCommand
    .command("cancel")
    .description("Cancel a task")
    .argument("<taskId>", "Task ID to cancel")
    .option("-f, --force", "Skip confirmation prompt")
    .action(async (taskId, options) => {
    checkConfig();
    await taskCancelCommand(taskId, { force: options.force });
});
// ============================================================================
// Queue Command
// ============================================================================
program
    .command("queue")
    .description("Show task queue status (shorthand for task list --status QUEUED)")
    .action(async () => {
    checkConfig();
    await queueCommand();
});
// ============================================================================
// Runner Commands (Local Agent Execution)
// ============================================================================
const runnerCommand = program
    .command("runner")
    .description("Local agent runner commands - execute tasks on your machine");
runnerCommand
    .command("register")
    .description("Register this machine as a local runner with the cloud")
    .option("-n, --name <name>", "Name for this runner")
    .action(async (options) => {
    checkConfig();
    await runnerRegisterCommand({ name: options.name });
});
runnerCommand
    .command("start")
    .description("Start the local runner to process tasks")
    .option("-d, --dir <directory>", "Working directory for task execution")
    .option("--once", "Process one task and exit")
    .action(async (options) => {
    checkConfig();
    await runnerStartCommand({ dir: options.dir, once: options.once });
});
runnerCommand
    .command("status")
    .description("Show local runner status")
    .action(async () => {
    checkConfig();
    await runnerStatusCommand();
});
// ============================================================================
// Agents Command
// ============================================================================
program
    .command("agents")
    .description("List all agents")
    .option("-s, --status <status>", "Filter by status (IDLE, WORKING, PAUSED, FAILED)")
    .action(async (options) => {
    checkConfig();
    const spinner = ora("Fetching agents...").start();
    try {
        const api = getApiClient();
        let agents = await api.getAgents();
        spinner.stop();
        if (options.status) {
            agents = agents.filter((a) => a.status.toUpperCase() === options.status.toUpperCase());
        }
        if (agents.length === 0) {
            console.log(chalk.yellow("\n  No agents found.\n"));
            return;
        }
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
                chalk.cyan("Name"),
                chalk.cyan("Status"),
                chalk.cyan("Current Task"),
                chalk.cyan("Tokens"),
                chalk.cyan("Tasks"),
            ],
            ...agents.map((a) => [
                a.name,
                formatStatus(a.status),
                a.currentTask ? truncate(a.currentTask.title, 30) : chalk.dim("-"),
                a.totalTokensUsed.toLocaleString(),
                `${chalk.green(a.tasksCompleted)}/${chalk.red(a.tasksFailed)}`,
            ]),
        ];
        console.log();
        console.log(table(tableData, tableConfig));
        console.log(chalk.dim(`  ${agents.length} agent(s)\n`));
    }
    catch (error) {
        spinner.fail("Failed to fetch agents");
        handleApiError(error);
    }
});
// ============================================================================
// Parse and Run
// ============================================================================
program.parse();
//# sourceMappingURL=index.js.map