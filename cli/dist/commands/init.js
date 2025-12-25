import chalk from "chalk";
import ora from "ora";
import * as readline from "readline";
import { createConfig, hasValidConfig, loadConfig, setRunnerConfig, getRunnerConfig, isRunnerConfigured, } from "../config.js";
function question(rl, prompt) {
    return new Promise((resolve) => rl.question(prompt, resolve));
}
function maskApiKey(key) {
    if (key.length <= 8)
        return "****";
    return key.slice(0, 4) + "..." + key.slice(-4);
}
export async function initCommand(options) {
    console.log(chalk.bold("\n  🐝 Swarm CLI Setup\n"));
    // Check if config already exists
    if (hasValidConfig() && !options.global) {
        const config = loadConfig();
        const runnerCfg = getRunnerConfig();
        console.log(chalk.dim("  Existing configuration found:\n"));
        console.log(chalk.dim(`    API URL:       ${config.apiUrl}`));
        console.log(chalk.dim(`    Working Dir:   ${config.defaultWorkingDir}`));
        if (runnerCfg.anthropicApiKey) {
            console.log(chalk.dim(`    Anthropic Key: ${maskApiKey(runnerCfg.anthropicApiKey)}`));
        }
        if (isRunnerConfigured()) {
            console.log(chalk.dim(`    Runner:        ${runnerCfg.runnerName}`));
        }
        console.log();
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        const answer = await question(rl, chalk.yellow("  Reconfigure? (y/N): "));
        rl.close();
        if (answer.toLowerCase() !== "y") {
            console.log(chalk.dim("\n  Setup cancelled.\n"));
            return;
        }
        console.log();
    }
    // Create the configuration
    await createConfig({ global: options.global });
    // Now prompt for Anthropic API key
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    console.log(chalk.bold("\n  Configure Local Agent Runner\n"));
    console.log(chalk.dim("  The runner executes AI agents locally on your machine."));
    console.log(chalk.dim("  You'll need an Anthropic API key from https://console.anthropic.com\n"));
    const existingKey = getRunnerConfig().anthropicApiKey;
    let keyPrompt = "  Anthropic API Key: ";
    if (existingKey) {
        keyPrompt = `  Anthropic API Key [${maskApiKey(existingKey)}]: `;
    }
    const anthropicKey = await question(rl, chalk.dim(keyPrompt));
    const runnerName = await question(rl, chalk.dim(`  Runner name [${process.env.USER || "local"}-runner]: `));
    rl.close();
    const finalKey = anthropicKey.trim() || existingKey;
    const finalName = runnerName.trim() || `${process.env.USER || "local"}-runner`;
    if (finalKey) {
        setRunnerConfig({ anthropicApiKey: finalKey });
    }
    // Register with the cloud
    const config = loadConfig();
    const spinner = ora("Registering runner with cloud...").start();
    try {
        const response = await fetch(`${config.apiUrl}/api/runner/status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: finalName,
                workingDir: config.defaultWorkingDir,
            }),
        });
        if (response.ok) {
            const json = await response.json();
            if (json.data?.session?.token) {
                setRunnerConfig({
                    runnerToken: json.data.session.token,
                    runnerName: finalName,
                });
                spinner.succeed("Runner registered successfully");
            }
            else {
                spinner.warn("Registered but no token received");
            }
        }
        else {
            spinner.warn("Could not register runner (server may be unavailable)");
        }
    }
    catch {
        spinner.warn("Could not connect to API server");
    }
    // Test connection
    const testSpinner = ora("Testing API connection...").start();
    try {
        const response = await fetch(`${config.apiUrl}/api/health`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        });
        if (response.ok) {
            testSpinner.succeed("API connection successful");
        }
        else {
            testSpinner.warn("API returned non-OK status");
        }
    }
    catch {
        testSpinner.warn("Could not connect to API");
        console.log(chalk.yellow(`\n  Make sure the server at ${config.apiUrl} is running.\n`));
    }
    // Show success message
    console.log(chalk.green("\n  ✓ Swarm CLI configured successfully!\n"));
    if (!finalKey) {
        console.log(chalk.yellow("  ⚠ No Anthropic API key configured."));
        console.log(chalk.dim("    Set it with: swarm config --anthropic-key <key>\n"));
    }
    console.log(chalk.dim("  Quick start:"));
    console.log(chalk.cyan("    swarm task add \"Build a landing page\""));
    console.log(chalk.cyan("    swarm runner start --dir /path/to/project"));
    console.log();
    console.log(chalk.dim("  Other commands:"));
    console.log(chalk.dim("    swarm status       Show system status"));
    console.log(chalk.dim("    swarm task list    List all tasks"));
    console.log(chalk.dim("    swarm config       Show current config"));
    console.log(chalk.dim("    swarm --help       Show all commands\n"));
}
//# sourceMappingURL=init.js.map