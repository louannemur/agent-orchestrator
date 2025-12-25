import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import { getApiClient, handleApiError } from "../api-client.js";
// ============================================================================
// Helpers
// ============================================================================
function formatStatus(status) {
    const statusColors = {
        IDLE: chalk.gray,
        WORKING: chalk.blue,
        PAUSED: chalk.yellow,
        COMPLETED: chalk.green,
        FAILED: chalk.red,
    };
    const colorFn = statusColors[status] || chalk.white;
    return colorFn(status);
}
export async function stopCommand(agentId, options) {
    const api = getApiClient();
    // Handle --all flag
    if (options.all) {
        const spinner = ora("Fetching active agents...").start();
        try {
            const agents = await api.getAgents();
            const activeAgents = agents.filter((a) => a.status === "WORKING" || a.status === "PAUSED");
            spinner.stop();
            if (activeAgents.length === 0) {
                console.log(chalk.yellow("\n  No active agents to stop.\n"));
                return;
            }
            // Confirm unless --force
            if (!options.force) {
                console.log(chalk.yellow(`\n  This will stop ${activeAgents.length} agent(s):\n`));
                for (const agent of activeAgents) {
                    console.log(`    ${chalk.cyan(agent.name)} (${formatStatus(agent.status)})`);
                }
                console.log();
                const { confirm } = await inquirer.prompt([
                    {
                        type: "confirm",
                        name: "confirm",
                        message: "Stop all agents?",
                        default: false,
                    },
                ]);
                if (!confirm) {
                    console.log(chalk.yellow("  Cancelled.\n"));
                    return;
                }
            }
            // Stop all agents
            console.log();
            let stopped = 0;
            for (const agent of activeAgents) {
                const stopSpinner = ora(`Stopping ${agent.name}...`).start();
                try {
                    await api.stopAgent(agent.id);
                    stopSpinner.succeed(`Stopped ${chalk.cyan(agent.name)}`);
                    stopped++;
                }
                catch {
                    stopSpinner.fail(`Failed to stop ${agent.name}`);
                }
            }
            console.log(chalk.green(`\n  ✓ Stopped ${stopped} agent(s)\n`));
        }
        catch (error) {
            spinner.fail("Failed to fetch agents");
            handleApiError(error);
        }
        return;
    }
    // Single agent stop
    let selectedAgentId = agentId;
    // If no agent specified, show selection
    if (!selectedAgentId) {
        const spinner = ora("Fetching active agents...").start();
        try {
            const agents = await api.getAgents();
            spinner.stop();
            const activeAgents = agents.filter((a) => a.status === "WORKING" || a.status === "PAUSED");
            if (activeAgents.length === 0) {
                console.log(chalk.yellow("\n  No active agents to stop.\n"));
                return;
            }
            const { selectedAgent } = await inquirer.prompt([
                {
                    type: "list",
                    name: "selectedAgent",
                    message: "Select an agent to stop:",
                    choices: activeAgents.map((a) => ({
                        name: `${a.name} (${formatStatus(a.status)})${a.currentTask ? ` - ${a.currentTask.title.slice(0, 30)}` : ""}`,
                        value: a.id,
                    })),
                },
            ]);
            selectedAgentId = selectedAgent;
        }
        catch (error) {
            spinner.fail("Failed to fetch agents");
            handleApiError(error);
        }
    }
    // Confirm unless --force
    if (!options.force) {
        const { confirm } = await inquirer.prompt([
            {
                type: "confirm",
                name: "confirm",
                message: `Stop agent ${selectedAgentId.slice(0, 8)}?`,
                default: false,
            },
        ]);
        if (!confirm) {
            console.log(chalk.yellow("  Cancelled.\n"));
            return;
        }
    }
    // Stop the agent
    const spinner = ora("Stopping agent...").start();
    try {
        await api.stopAgent(selectedAgentId);
        spinner.succeed("Agent stopped");
        console.log(chalk.dim(`  Agent ${selectedAgentId.slice(0, 8)} has been stopped.\n`));
    }
    catch (error) {
        spinner.fail("Failed to stop agent");
        handleApiError(error);
    }
}
//# sourceMappingURL=stop.js.map