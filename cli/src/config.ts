import fs from "fs";
import os from "os";
import path from "path";

import chalk from "chalk";
import inquirer from "inquirer";

// ============================================================================
// Types
// ============================================================================

export interface SwarmConfig {
  apiUrl: string;
  defaultWorkingDir: string;
}

// ============================================================================
// Constants
// ============================================================================

const CONFIG_FILE_NAME = ".swarmrc";
const DEFAULT_API_URL = "http://localhost:3000";

// ============================================================================
// Config File Paths
// ============================================================================

/**
 * Get the path to the global config file (~/.swarmrc)
 */
function getGlobalConfigPath(): string {
  return path.join(os.homedir(), CONFIG_FILE_NAME);
}

/**
 * Get the path to the local config file (./.swarmrc)
 */
function getLocalConfigPath(): string {
  return path.join(process.cwd(), CONFIG_FILE_NAME);
}

// ============================================================================
// Load Config
// ============================================================================

/**
 * Load configuration from .swarmrc files and environment variables.
 * Priority: Environment variables > Local .swarmrc > Global .swarmrc > Defaults
 */
export function loadConfig(): SwarmConfig {
  const config: SwarmConfig = {
    apiUrl: DEFAULT_API_URL,
    defaultWorkingDir: process.cwd(),
  };

  // Try to load global config
  const globalConfigPath = getGlobalConfigPath();
  if (fs.existsSync(globalConfigPath)) {
    try {
      const globalConfig = JSON.parse(fs.readFileSync(globalConfigPath, "utf-8"));
      Object.assign(config, globalConfig);
    } catch {
      // Ignore parse errors for global config
    }
  }

  // Try to load local config (overrides global)
  const localConfigPath = getLocalConfigPath();
  if (fs.existsSync(localConfigPath)) {
    try {
      const localConfig = JSON.parse(fs.readFileSync(localConfigPath, "utf-8"));
      Object.assign(config, localConfig);
    } catch {
      // Ignore parse errors for local config
    }
  }

  // Environment variables override file config
  if (process.env.SWARM_API_URL) {
    config.apiUrl = process.env.SWARM_API_URL;
  }

  if (process.env.SWARM_WORKING_DIR) {
    config.defaultWorkingDir = process.env.SWARM_WORKING_DIR;
  }

  return config;
}

// ============================================================================
// Create Config
// ============================================================================

/**
 * Interactively create a .swarmrc configuration file.
 */
export async function createConfig(options: { global?: boolean } = {}): Promise<void> {
  const configPath = options.global ? getGlobalConfigPath() : getLocalConfigPath();
  const configType = options.global ? "global" : "local";

  console.log(chalk.blue(`\nCreating ${configType} configuration...\n`));

  // Check if config already exists
  if (fs.existsSync(configPath)) {
    const { overwrite } = await inquirer.prompt([
      {
        type: "confirm",
        name: "overwrite",
        message: `${configPath} already exists. Overwrite?`,
        default: false,
      },
    ]);

    if (!overwrite) {
      console.log(chalk.yellow("Configuration creation cancelled."));
      return;
    }
  }

  // Prompt for configuration values
  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "apiUrl",
      message: "API URL:",
      default: DEFAULT_API_URL,
      validate: (input: string) => {
        try {
          new URL(input);
          return true;
        } catch {
          return "Please enter a valid URL";
        }
      },
    },
    {
      type: "input",
      name: "defaultWorkingDir",
      message: "Default working directory:",
      default: process.cwd(),
      validate: (input: string) => {
        if (path.isAbsolute(input)) {
          return true;
        }
        return "Please enter an absolute path";
      },
    },
  ]);

  // Create config object
  const config: SwarmConfig = {
    apiUrl: answers.apiUrl,
    defaultWorkingDir: answers.defaultWorkingDir,
  };

  // Write config file
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
    console.log(chalk.green(`\nConfiguration saved to ${configPath}`));
  } catch (error) {
    console.error(chalk.red(`Failed to write config file: ${error}`));
    process.exit(1);
  }
}

// ============================================================================
// Validate Config
// ============================================================================

/**
 * Check if configuration exists and is valid.
 */
export function hasValidConfig(): boolean {
  const globalExists = fs.existsSync(getGlobalConfigPath());
  const localExists = fs.existsSync(getLocalConfigPath());

  return globalExists || localExists;
}

/**
 * Get the path of the active config file.
 */
export function getActiveConfigPath(): string | null {
  const localPath = getLocalConfigPath();
  if (fs.existsSync(localPath)) {
    return localPath;
  }

  const globalPath = getGlobalConfigPath();
  if (fs.existsSync(globalPath)) {
    return globalPath;
  }

  return null;
}

// ============================================================================
// Display Config
// ============================================================================

/**
 * Display the current configuration.
 */
export function displayConfig(): void {
  const config = loadConfig();
  const activePath = getActiveConfigPath();

  console.log(chalk.blue("\nCurrent Configuration:\n"));

  if (activePath) {
    console.log(chalk.dim(`  Config file: ${activePath}`));
  } else {
    console.log(chalk.dim("  Config file: (using defaults)"));
  }

  console.log();
  console.log(`  ${chalk.cyan("API URL:")}          ${config.apiUrl}`);
  console.log(`  ${chalk.cyan("Working Directory:")} ${config.defaultWorkingDir}`);
  console.log();

  // Show environment overrides if any
  const overrides: string[] = [];
  if (process.env.SWARM_API_URL) overrides.push("SWARM_API_URL");
  if (process.env.SWARM_WORKING_DIR) overrides.push("SWARM_WORKING_DIR");

  if (overrides.length > 0) {
    console.log(chalk.yellow(`  Environment overrides: ${overrides.join(", ")}`));
    console.log();
  }
}
