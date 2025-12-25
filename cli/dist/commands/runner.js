import chalk from "chalk";
import ora from "ora";
import Anthropic from "@anthropic-ai/sdk";
import { exec } from "child_process";
import { promises as fs } from "fs";
import * as path from "path";
import { promisify } from "util";
import { loadConfig, getRunnerConfig, setRunnerConfig, isRunnerConfigured, } from "../config.js";
const execAsync = promisify(exec);
// ============================================================================
// Runner API Client
// ============================================================================
class RunnerApiClient {
    baseUrl;
    runnerToken;
    constructor(baseUrl, runnerToken) {
        this.baseUrl = baseUrl;
        this.runnerToken = runnerToken;
    }
    async request(method, path, body) {
        const url = `${this.baseUrl}${path}`;
        const response = await fetch(url, {
            method,
            headers: {
                "Content-Type": "application/json",
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        const json = await response.json();
        if (!response.ok) {
            throw new Error(json.message || json.error || "Request failed");
        }
        return json.data;
    }
    async register(name, workingDir) {
        return this.request("POST", "/api/runner/status", { name, workingDir });
    }
    async getStatus() {
        const token = encodeURIComponent(this.runnerToken);
        return this.request("GET", `/api/runner/status?runnerToken=${token}`);
    }
    async claimTask(workingDir) {
        const result = await this.request("POST", "/api/runner/claim", { runnerToken: this.runnerToken, workingDir });
        if (!result.task)
            return null;
        return result;
    }
    async sendHeartbeat(agentId, taskId, tokensUsed) {
        await this.request("POST", "/api/runner/heartbeat", {
            runnerToken: this.runnerToken,
            agentId,
            taskId,
            tokensUsed,
        });
    }
    async sendLogs(agentId, taskId, logs) {
        await this.request("POST", "/api/runner/logs", {
            runnerToken: this.runnerToken,
            agentId,
            taskId,
            logs,
        });
    }
    async completeTask(agentId, taskId, success, options = {}) {
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
const AGENT_TOOLS = [
    {
        name: "read_file",
        description: "Read the contents of a file",
        input_schema: {
            type: "object",
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
            type: "object",
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
            type: "object",
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
            type: "object",
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
            type: "object",
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
            type: "object",
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
            type: "object",
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
            type: "object",
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
function sanitizePath(inputPath, workingDir) {
    const resolved = path.resolve(workingDir, inputPath);
    const normalizedWorkingDir = path.normalize(workingDir);
    const normalizedResolved = path.normalize(resolved);
    if (!normalizedResolved.startsWith(normalizedWorkingDir)) {
        throw new Error(`Path traversal detected: ${inputPath} resolves outside working directory`);
    }
    return resolved;
}
async function executeTool(name, input, workingDir) {
    try {
        switch (name) {
            case "read_file": {
                const safePath = sanitizePath(input.path, workingDir);
                const content = await fs.readFile(safePath, "utf-8");
                return { success: true, output: content };
            }
            case "write_file": {
                const safePath = sanitizePath(input.path, workingDir);
                const dir = path.dirname(safePath);
                await fs.mkdir(dir, { recursive: true });
                await fs.writeFile(safePath, input.content, "utf-8");
                return { success: true, output: `Successfully wrote to ${input.path}` };
            }
            case "edit_file": {
                const safePath = sanitizePath(input.path, workingDir);
                const content = await fs.readFile(safePath, "utf-8");
                const oldContent = input.old_content;
                const newContent = input.new_content;
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
                const safePath = sanitizePath(input.path, workingDir);
                const entries = await fs.readdir(safePath, { withFileTypes: true });
                const results = entries.map((e) => e.name + (e.isDirectory() ? "/" : ""));
                return { success: true, output: results.join("\n") || "(empty directory)" };
            }
            case "search_code": {
                const searchPath = sanitizePath(input.path || ".", workingDir);
                let command = `grep -rn --color=never`;
                if (input.file_pattern) {
                    command += ` --include="${input.file_pattern}"`;
                }
                command += ` --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next`;
                command += ` "${input.pattern.replace(/"/g, '\\"')}" "${searchPath}"`;
                try {
                    const { stdout } = await execAsync(command, { cwd: workingDir, maxBuffer: 1024 * 1024 });
                    const lines = stdout.split("\n").slice(0, 100);
                    return { success: true, output: lines.join("\n") || "No matches found" };
                }
                catch (error) {
                    if (error instanceof Error && "code" in error && error.code === "1") {
                        return { success: true, output: "No matches found" };
                    }
                    throw error;
                }
            }
            case "run_command": {
                const timeoutMs = (input.timeout_seconds || 30) * 1000;
                const { stdout, stderr } = await execAsync(input.command, {
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
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, output: "", error: message };
    }
}
// ============================================================================
// Local Agent Executor
// ============================================================================
async function executeTask(task, agent, workingDir, apiClient, anthropic, maxIterations) {
    const conversationHistory = [];
    let totalTokens = 0;
    const logBuffer = [];
    const flushLogs = async () => {
        if (logBuffer.length > 0) {
            try {
                await apiClient.sendLogs(agent.id, task.id, [...logBuffer]);
                logBuffer.length = 0;
            }
            catch (error) {
                console.error(chalk.dim("  Failed to send logs:", error));
            }
        }
    };
    const addLog = (logType, content, metadata) => {
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
        }
        catch {
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
        const assistantContent = [];
        const toolResults = [];
        for (const block of response.content) {
            assistantContent.push(block);
            if (block.type === "text") {
                addLog("THINKING", block.text);
                console.log(chalk.dim("  Agent thinking..."));
            }
            else if (block.type === "tool_use") {
                addLog("TOOL_CALL", `Calling ${block.name}`, { tool: block.name, input: block.input });
                console.log(chalk.cyan(`  Tool: ${block.name}`));
                const toolResult = await executeTool(block.name, block.input, workingDir);
                addLog(toolResult.success ? "TOOL_RESULT" : "ERROR", toolResult.success ? toolResult.output : toolResult.error || "Unknown error", { tool: block.name, success: toolResult.success });
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
                }
                catch {
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
        }
        else if (response.stop_reason === "end_turn") {
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
export async function runnerRegisterCommand(options) {
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
    }
    catch (error) {
        spinner.fail("Failed to register runner");
        if (error instanceof Error) {
            console.error(chalk.red(`\n  ${error.message}\n`));
        }
        process.exit(1);
    }
}
export async function runnerStartCommand(options) {
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
    }
    catch {
        console.log(chalk.red(`\n  Working directory does not exist: ${workingDir}\n`));
        process.exit(1);
    }
    // Initialize Anthropic client
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
        console.log(chalk.red("\n  ANTHROPIC_API_KEY environment variable is required.\n"));
        process.exit(1);
    }
    const anthropic = new Anthropic({ apiKey: anthropicApiKey });
    const apiClient = new RunnerApiClient(config.apiUrl, runnerCfg.runnerToken);
    console.log(chalk.bold("\n  Local Agent Runner\n"));
    console.log(chalk.dim(`  Working directory: ${workingDir}`));
    console.log(chalk.dim(`  API URL: ${config.apiUrl}`));
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
                if (options.once)
                    break;
                await new Promise((resolve) => setTimeout(resolve, runnerCfg.pollInterval * 1000));
                continue;
            }
            // Claim a task
            spinner.text = "Claiming task...";
            const claimed = await apiClient.claimTask(workingDir);
            if (!claimed) {
                spinner.info("No tasks to claim");
                if (options.once)
                    break;
                await new Promise((resolve) => setTimeout(resolve, runnerCfg.pollInterval * 1000));
                continue;
            }
            spinner.succeed(`Claimed task: ${claimed.task.title}`);
            console.log(chalk.dim(`  Task ID: ${claimed.task.id}`));
            console.log(chalk.dim(`  Agent ID: ${claimed.agent.id}`));
            console.log();
            // Execute the task
            const result = await executeTask(claimed.task, claimed.agent, workingDir, apiClient, anthropic, runnerCfg.maxIterations);
            // Report completion
            await apiClient.completeTask(claimed.agent.id, claimed.task.id, result.success, { summary: result.summary, error: result.error });
            if (result.success) {
                console.log(chalk.green(`\n  Task completed: ${result.summary}\n`));
            }
            else {
                console.log(chalk.red(`\n  Task failed: ${result.error}\n`));
            }
            if (options.once)
                break;
        }
        catch (error) {
            if (error instanceof Error) {
                console.error(chalk.red(`\n  Error: ${error.message}\n`));
            }
            if (options.once)
                break;
            await new Promise((resolve) => setTimeout(resolve, runnerCfg.pollInterval * 1000));
        }
    }
    console.log(chalk.dim("\n  Runner stopped.\n"));
}
export async function runnerStatusCommand() {
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
    }
    catch (error) {
        spinner.fail("Failed to fetch status");
        if (error instanceof Error) {
            console.error(chalk.red(`\n  ${error.message}\n`));
        }
    }
}
//# sourceMappingURL=runner.js.map