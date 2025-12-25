import Conf from "conf";
import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as readline from "readline";
// ============================================================================
// Config File Paths
// ============================================================================
const LOCAL_CONFIG_FILE = ".swarmrc.json";
const GLOBAL_CONFIG_DIR = path.join(os.homedir(), ".config", "swarm");
const GLOBAL_CONFIG_FILE = path.join(GLOBAL_CONFIG_DIR, "config.json");
// ============================================================================
// Runner Config Store (for local runner)
// ============================================================================
const runnerConfig = new Conf({
    projectName: "agent-orchestrator-runner",
    defaults: {
        runnerToken: "",
        runnerName: "",
        anthropicApiKey: "",
        pollInterval: 5,
        maxIterations: 50,
    },
});
// ============================================================================
// Swarm Config Functions
// ============================================================================
function findLocalConfig() {
    let currentDir = process.cwd();
    while (currentDir !== path.dirname(currentDir)) {
        const configPath = path.join(currentDir, LOCAL_CONFIG_FILE);
        if (fs.existsSync(configPath)) {
            return configPath;
        }
        currentDir = path.dirname(currentDir);
    }
    return null;
}
export function loadConfig() {
    // First try local config
    const localPath = findLocalConfig();
    if (localPath) {
        try {
            const content = fs.readFileSync(localPath, "utf-8");
            return JSON.parse(content);
        }
        catch {
            // Fall through to global config
        }
    }
    // Try global config
    if (fs.existsSync(GLOBAL_CONFIG_FILE)) {
        try {
            const content = fs.readFileSync(GLOBAL_CONFIG_FILE, "utf-8");
            return JSON.parse(content);
        }
        catch {
            // Fall through to defaults
        }
    }
    // Default config
    return {
        apiUrl: "http://localhost:3000",
        defaultWorkingDir: process.cwd(),
    };
}
export function hasValidConfig() {
    const localPath = findLocalConfig();
    return localPath !== null || fs.existsSync(GLOBAL_CONFIG_FILE);
}
export function displayConfig() {
    const config = loadConfig();
    const localPath = findLocalConfig();
    console.log(chalk.bold("\n  Swarm Configuration\n"));
    if (localPath) {
        console.log(chalk.dim(`  Config file: ${localPath}`));
    }
    else if (fs.existsSync(GLOBAL_CONFIG_FILE)) {
        console.log(chalk.dim(`  Config file: ${GLOBAL_CONFIG_FILE} (global)`));
    }
    else {
        console.log(chalk.yellow("  No configuration file found"));
        console.log(chalk.dim("  Run 'swarm init' to create one\n"));
        return;
    }
    console.log();
    console.log(`  API URL:     ${chalk.cyan(config.apiUrl)}`);
    console.log(`  Working Dir: ${chalk.cyan(config.defaultWorkingDir)}`);
    console.log();
    // Also show runner config if configured
    if (isRunnerConfigured()) {
        const runner = getRunnerConfig();
        console.log(chalk.bold("  Local Runner Configuration\n"));
        console.log(`  Runner Name:   ${chalk.cyan(runner.runnerName)}`);
        console.log(`  Token:         ${chalk.dim(runner.runnerToken.slice(0, 16) + "...")}`);
        console.log(`  Anthropic Key: ${runner.anthropicApiKey ? chalk.green("configured") : chalk.yellow("not set")}`);
        console.log(`  Poll Interval: ${chalk.cyan(runner.pollInterval + "s")}`);
        console.log();
    }
}
export async function createConfig(options = {}) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));
    console.log(chalk.bold("\n  Configure Swarm CLI\n"));
    const apiUrl = await question(chalk.dim("  API URL [http://localhost:3000]: "));
    const workingDir = await question(chalk.dim(`  Default working directory [${process.cwd()}]: `));
    rl.close();
    const config = {
        apiUrl: apiUrl.trim() || "http://localhost:3000",
        defaultWorkingDir: workingDir.trim() || process.cwd(),
    };
    if (options.global) {
        // Create global config directory if needed
        if (!fs.existsSync(GLOBAL_CONFIG_DIR)) {
            fs.mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
        }
        fs.writeFileSync(GLOBAL_CONFIG_FILE, JSON.stringify(config, null, 2));
        console.log(chalk.dim(`\n  Created: ${GLOBAL_CONFIG_FILE}\n`));
    }
    else {
        fs.writeFileSync(LOCAL_CONFIG_FILE, JSON.stringify(config, null, 2));
        console.log(chalk.dim(`\n  Created: ${LOCAL_CONFIG_FILE}\n`));
    }
}
// ============================================================================
// Runner Config Functions
// ============================================================================
export function getRunnerConfig() {
    return {
        runnerToken: runnerConfig.get("runnerToken"),
        runnerName: runnerConfig.get("runnerName"),
        anthropicApiKey: runnerConfig.get("anthropicApiKey"),
        pollInterval: runnerConfig.get("pollInterval"),
        maxIterations: runnerConfig.get("maxIterations"),
    };
}
export function setRunnerConfig(updates) {
    if (updates.runnerToken !== undefined)
        runnerConfig.set("runnerToken", updates.runnerToken);
    if (updates.runnerName !== undefined)
        runnerConfig.set("runnerName", updates.runnerName);
    if (updates.anthropicApiKey !== undefined)
        runnerConfig.set("anthropicApiKey", updates.anthropicApiKey);
    if (updates.pollInterval !== undefined)
        runnerConfig.set("pollInterval", updates.pollInterval);
    if (updates.maxIterations !== undefined)
        runnerConfig.set("maxIterations", updates.maxIterations);
}
export function clearRunnerConfig() {
    runnerConfig.clear();
}
export function isRunnerConfigured() {
    const cfg = getRunnerConfig();
    return !!(cfg.runnerToken && cfg.runnerName);
}
export function getRunnerConfigPath() {
    return runnerConfig.path;
}
//# sourceMappingURL=config.js.map