#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import Anthropic from "@anthropic-ai/sdk";
import { exec } from "child_process";
import { promises as fs } from "fs";
import * as path from "path";
import * as readline from "readline";
import { promisify } from "util";
import Conf from "conf";
const execAsync = promisify(exec);
const config = new Conf({
    projectName: "swarm-agent",
    defaults: {
        apiUrl: "",
        runnerToken: "",
        runnerName: "",
        workingDir: "",
        anthropicApiKey: "",
    },
});
function isConfigured() {
    return !!(config.get("apiUrl") && config.get("runnerToken"));
}
// ============================================================================
// API Client
// ============================================================================
async function apiRequest(method, endpoint, body) {
    const apiUrl = config.get("apiUrl");
    const response = await fetch(`${apiUrl}${endpoint}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await response.json());
    if (!response.ok) {
        throw new Error(json.message || json.error || "Request failed");
    }
    return json.data;
}
// ============================================================================
// Program
// ============================================================================
const program = new Command();
program
    .name("swarm-agent")
    .description("Connect your machine to Swarm - AI agent orchestration")
    .version("1.0.0");
// ============================================================================
// Connect Command
// ============================================================================
program
    .command("connect <token>")
    .description("Connect this machine to your Swarm dashboard")
    .option("-d, --dir <directory>", "Working directory for tasks")
    .action(async (token, options) => {
    console.log(chalk.bold("\n  Swarm Agent Setup\n"));
    const spinner = ora("Validating connection token...").start();
    try {
        // Token format: base64(apiUrl|setupToken:expiresAt)
        const decoded = Buffer.from(token, "base64").toString("utf-8");
        const [apiUrl, setupToken] = decoded.split("|");
        if (!apiUrl || !setupToken) {
            spinner.fail("Invalid token format");
            console.log(chalk.dim("\n  Get a valid token from your Swarm dashboard.\n"));
            process.exit(1);
        }
        // Validate token with server
        const response = await fetch(`${apiUrl}/api/connect`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ setupToken }),
        });
        const json = (await response.json());
        if (!response.ok || !json.data) {
            spinner.fail("Invalid or expired token");
            console.log(chalk.dim("\n  Get a new token from your Swarm dashboard.\n"));
            process.exit(1);
        }
        spinner.succeed("Token validated");
        // Determine working directory
        let workingDir = options.dir;
        if (!workingDir) {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
            });
            workingDir = await new Promise((resolve) => {
                rl.question(chalk.dim(`  Working directory [${process.cwd()}]: `), (answer) => {
                    rl.close();
                    resolve(answer.trim() || process.cwd());
                });
            });
        }
        // Verify directory exists
        try {
            await fs.access(workingDir);
        }
        catch {
            console.log(chalk.red(`\n  Directory does not exist: ${workingDir}\n`));
            process.exit(1);
        }
        // Check for existing API key or prompt for one
        let anthropicApiKey = process.env.ANTHROPIC_API_KEY || "";
        if (!anthropicApiKey) {
            const rl2 = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
            });
            anthropicApiKey = await new Promise((resolve) => {
                rl2.question(chalk.dim("  Anthropic API key (get one at console.anthropic.com): "), (answer) => {
                    rl2.close();
                    resolve(answer.trim());
                });
            });
            if (!anthropicApiKey) {
                console.log(chalk.red("\n  API key is required to run the agent.\n"));
                process.exit(1);
            }
        }
        // Save configuration
        config.set("apiUrl", apiUrl);
        config.set("runnerToken", json.data.runnerToken);
        config.set("runnerName", json.data.runnerName);
        config.set("workingDir", workingDir);
        config.set("anthropicApiKey", anthropicApiKey);
        console.log(chalk.green("\n  Connected successfully!\n"));
        console.log(chalk.dim(`  Runner: ${json.data.runnerName}`));
        console.log(chalk.dim(`  Working directory: ${workingDir}`));
        console.log(chalk.dim(`  API key: ****${anthropicApiKey.slice(-4)}`));
        console.log();
        console.log(chalk.bold("  Start the agent with:"));
        console.log(chalk.cyan("    swarm-agent start"));
        console.log();
    }
    catch (error) {
        spinner.fail("Connection failed");
        if (error instanceof Error) {
            console.log(chalk.red(`\n  ${error.message}\n`));
        }
        process.exit(1);
    }
});
// ============================================================================
// Start Command
// ============================================================================
program
    .command("start")
    .description("Start the agent to process tasks")
    .option("-d, --dir <directory>", "Working directory (overrides saved config)")
    .option("-k, --api-key <key>", "Anthropic API key (if not using Claude Code)")
    .option("--once", "Process one task and exit")
    .action(async (options) => {
    if (!isConfigured()) {
        console.log(chalk.yellow("\n  Not connected. Run 'npx swarm-agent connect <token>' first."));
        console.log(chalk.dim("  Get your token from the Swarm dashboard.\n"));
        process.exit(1);
    }
    const workingDir = options.dir || config.get("workingDir") || process.cwd();
    const runnerToken = config.get("runnerToken");
    const runnerName = config.get("runnerName");
    // Get API key from options, env, or saved config
    const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY || config.get("anthropicApiKey");
    if (!apiKey) {
        console.log(chalk.yellow("\n  No API key configured."));
        console.log(chalk.dim("  Run 'swarm-agent connect <token>' again to set up your API key."));
        console.log(chalk.dim("  Or provide one with: swarm-agent start --api-key <key>\n"));
        process.exit(1);
    }
    console.log(chalk.bold("\n  Swarm Agent\n"));
    console.log(chalk.dim(`  Runner: ${runnerName}`));
    console.log(chalk.dim(`  Directory: ${workingDir}`));
    console.log(chalk.dim(`  API key: ****${apiKey.slice(-4)}`));
    console.log();
    let running = true;
    process.on("SIGINT", () => {
        console.log(chalk.yellow("\n  Shutting down..."));
        running = false;
    });
    // Initialize Anthropic
    const anthropic = new Anthropic({ apiKey });
    while (running) {
        const spinner = ora("Checking for tasks...").start();
        try {
            // Check for tasks
            const status = await apiRequest("GET", `/api/runner/status?runnerToken=${encodeURIComponent(runnerToken)}`);
            if (status.availableTasks.count === 0) {
                spinner.info("No tasks available");
                if (options.once)
                    break;
                await new Promise((r) => setTimeout(r, 5000));
                continue;
            }
            // Claim a task
            spinner.text = "Claiming task...";
            const claimed = await apiRequest("POST", "/api/runner/claim", { runnerToken, workingDir });
            if (!claimed.task) {
                spinner.info("No tasks to claim");
                if (options.once)
                    break;
                await new Promise((r) => setTimeout(r, 5000));
                continue;
            }
            spinner.succeed(`Task: ${claimed.task.title}`);
            // Execute task
            const result = await executeWithApi(claimed.task, workingDir, anthropic);
            // Report completion
            await apiRequest("POST", "/api/runner/complete", {
                runnerToken,
                agentId: claimed.agent.id,
                taskId: claimed.task.id,
                success: result.success,
                summary: result.summary,
                error: result.error,
            });
            if (result.success) {
                console.log(chalk.green(`  Completed: ${result.summary?.slice(0, 100) || "Done"}\n`));
            }
            else {
                console.log(chalk.red(`  Failed: ${result.error?.slice(0, 100) || "Unknown error"}\n`));
            }
            if (options.once)
                break;
        }
        catch (error) {
            spinner.fail("Error");
            if (error instanceof Error) {
                console.log(chalk.dim(`  ${error.message}`));
            }
            if (options.once)
                break;
            await new Promise((r) => setTimeout(r, 5000));
        }
    }
    console.log(chalk.dim("\n  Agent stopped.\n"));
});
// ============================================================================
// Status Command
// ============================================================================
program
    .command("status")
    .description("Show connection status")
    .action(async () => {
    console.log(chalk.bold("\n  Swarm Agent Status\n"));
    if (!isConfigured()) {
        console.log(chalk.yellow("  Not connected."));
        console.log(chalk.dim("  Run 'npx swarm-agent connect <token>' to connect.\n"));
        return;
    }
    const apiUrl = config.get("apiUrl");
    const runnerName = config.get("runnerName");
    const workingDir = config.get("workingDir");
    const anthropicApiKey = config.get("anthropicApiKey");
    console.log(`  Connected: ${chalk.green("Yes")}`);
    console.log(`  Runner: ${chalk.cyan(runnerName)}`);
    console.log(`  Server: ${chalk.dim(apiUrl)}`);
    console.log(`  Directory: ${chalk.dim(workingDir)}`);
    console.log(`  API key: ${anthropicApiKey ? chalk.green(`****${anthropicApiKey.slice(-4)}`) : chalk.yellow("not set")}`);
    // Check server status
    const spinner = ora("Checking server...").start();
    try {
        const runnerToken = config.get("runnerToken");
        const status = await apiRequest("GET", `/api/runner/status?runnerToken=${encodeURIComponent(runnerToken)}`);
        spinner.stop();
        console.log(`  Tasks available: ${chalk.cyan(status.availableTasks.count)}`);
    }
    catch {
        spinner.stop();
        console.log(`  Server: ${chalk.red("unreachable")}`);
    }
    console.log();
});
// ============================================================================
// Disconnect Command
// ============================================================================
program
    .command("disconnect")
    .description("Disconnect this machine")
    .action(() => {
    config.clear();
    console.log(chalk.green("\n  Disconnected successfully.\n"));
});
async function executeWithApi(task, workingDir, anthropic) {
    console.log(chalk.dim("  Running with Anthropic API..."));
    const tools = [
        {
            name: "run_command",
            description: "Run a shell command",
            input_schema: {
                type: "object",
                properties: {
                    command: { type: "string", description: "Command to run" },
                },
                required: ["command"],
            },
        },
        {
            name: "read_file",
            description: "Read a file",
            input_schema: {
                type: "object",
                properties: {
                    path: { type: "string", description: "File path" },
                },
                required: ["path"],
            },
        },
        {
            name: "write_file",
            description: "Write to a file",
            input_schema: {
                type: "object",
                properties: {
                    path: { type: "string", description: "File path" },
                    content: { type: "string", description: "Content" },
                },
                required: ["path", "content"],
            },
        },
        {
            name: "task_complete",
            description: "Mark task as complete",
            input_schema: {
                type: "object",
                properties: {
                    summary: { type: "string", description: "Summary of work done" },
                },
                required: ["summary"],
            },
        },
    ];
    const systemPrompt = `You are an AI agent. Complete this task:
Title: ${task.title}
Description: ${task.description}
Working directory: ${workingDir}

Use the tools to complete the task, then call task_complete.`;
    const messages = [
        { role: "user", content: "Begin the task." },
    ];
    try {
        for (let i = 0; i < 20; i++) {
            const response = await anthropic.messages.create({
                model: "claude-sonnet-4-20250514",
                max_tokens: 4096,
                system: systemPrompt,
                messages,
                tools,
            });
            const toolResults = [];
            for (const block of response.content) {
                if (block.type === "tool_use") {
                    const input = block.input;
                    if (block.name === "task_complete") {
                        return { success: true, summary: input.summary };
                    }
                    let result;
                    try {
                        if (block.name === "run_command") {
                            const { stdout, stderr } = await execAsync(input.command, {
                                cwd: workingDir,
                                timeout: 30000,
                            });
                            result = stdout + (stderr ? `\nStderr: ${stderr}` : "");
                        }
                        else if (block.name === "read_file") {
                            result = await fs.readFile(path.join(workingDir, input.path), "utf-8");
                        }
                        else if (block.name === "write_file") {
                            await fs.writeFile(path.join(workingDir, input.path), input.content);
                            result = "File written successfully";
                        }
                        else {
                            result = "Unknown tool";
                        }
                    }
                    catch (e) {
                        result = `Error: ${e instanceof Error ? e.message : String(e)}`;
                    }
                    toolResults.push({
                        type: "tool_result",
                        tool_use_id: block.id,
                        content: result.slice(0, 10000),
                    });
                }
            }
            messages.push({ role: "assistant", content: response.content });
            if (toolResults.length > 0) {
                messages.push({ role: "user", content: toolResults });
            }
            if (response.stop_reason === "end_turn" && toolResults.length === 0) {
                return { success: true, summary: "Task completed" };
            }
        }
        return { success: false, error: "Max iterations reached" };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
// ============================================================================
// Run
// ============================================================================
program.parse();
//# sourceMappingURL=index.js.map