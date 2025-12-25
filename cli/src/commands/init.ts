import chalk from "chalk";
import ora from "ora";

import { createConfig, hasValidConfig, loadConfig } from "../config.js";

// ============================================================================
// Init Command
// ============================================================================

export interface InitOptions {
  global?: boolean;
}

export async function initCommand(options: InitOptions): Promise<void> {
  // Check if config already exists
  if (hasValidConfig() && !options.global) {
    console.log(chalk.yellow("\nConfiguration already exists."));
    console.log(chalk.dim("  Use --global to create a global config instead.\n"));

    const config = loadConfig();
    console.log(chalk.dim("  Current API URL: " + config.apiUrl));
    console.log(chalk.dim("  Current Working Dir: " + config.defaultWorkingDir + "\n"));

    // Ask if they want to overwrite
  }

  // Create the configuration
  await createConfig({ global: options.global });

  // Test connection to API
  const config = loadConfig();
  const spinner = ora("Testing connection to API...").start();

  try {
    const response = await fetch(`${config.apiUrl}/api/health`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (response.ok) {
      spinner.succeed("Connected to API successfully");
      console.log(chalk.green("\n  ✓ Swarm CLI initialized successfully!\n"));
      console.log(chalk.dim("  Commands:"));
      console.log(chalk.dim("    swarm status     Show system status"));
      console.log(chalk.dim("    swarm spawn      Spawn an agent"));
      console.log(chalk.dim("    swarm task list  List tasks"));
      console.log(chalk.dim("    swarm --help     Show all commands\n"));
    } else {
      spinner.warn("API returned non-OK status");
      console.log(
        chalk.yellow(
          "\n  Warning: Could not verify API connection. Is the server running?\n"
        )
      );
    }
  } catch (error) {
    spinner.warn("Could not connect to API");
    console.log(
      chalk.yellow(
        `\n  Warning: Could not connect to ${config.apiUrl}`
      )
    );
    console.log(chalk.dim("  Make sure the server is running.\n"));
  }
}
