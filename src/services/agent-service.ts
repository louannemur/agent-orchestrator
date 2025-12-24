import Anthropic from "@anthropic-ai/sdk";

import { db } from "@/lib/db";
import type { Agent, AgentConfig } from "@/types";
import {
  AgentStatus,
  ExceptionSeverity,
  ExceptionType,
  TaskStatus,
} from "@/types";

import { AgentRunner, createAgentRunner } from "./agent-runner";

// ============================================================================
// AgentService Class
// ============================================================================

class AgentService {
  private runningAgents: Map<string, AgentRunner> = new Map();
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  // ==========================================================================
  // Agent Lifecycle
  // ==========================================================================

  async spawnAgent(taskId: string, workingDir: string): Promise<string> {
    // Validate task exists and is in a spawnable state
    const task = await db.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (
      task.status !== TaskStatus.QUEUED &&
      task.status !== TaskStatus.FAILED
    ) {
      throw new Error(
        `Task is not in a spawnable state. Current status: ${task.status}`
      );
    }

    // Check if task is already assigned to a running agent
    if (task.assignedAgentId) {
      const existingAgent = await db.agent.findUnique({
        where: { id: task.assignedAgentId },
      });

      if (existingAgent?.status === AgentStatus.WORKING) {
        throw new Error(
          `Task is already assigned to running agent: ${task.assignedAgentId}`
        );
      }
    }

    // Create agent record
    const branchName = `agent/${taskId.slice(0, 8)}`;

    const agent = await db.agent.create({
      data: {
        name: `Agent for ${task.title.slice(0, 50)}`,
        status: AgentStatus.IDLE,
        branchName,
      },
    });

    console.log(`[AgentService] Created agent ${agent.id} for task ${taskId}`);

    // Create config
    const config: AgentConfig = {
      taskId,
      workingDir,
      branchName,
      maxIterations: 50,
    };

    // Create runner
    const runner = createAgentRunner(agent.id, config, this.anthropic);
    this.runningAgents.set(agent.id, runner);

    // Start the runner in background (don't await)
    this.startRunnerInBackground(agent.id, runner);

    return agent.id;
  }

  private startRunnerInBackground(agentId: string, runner: AgentRunner): void {
    runner
      .start()
      .then((result) => {
        console.log(
          `[AgentService] Agent ${agentId} finished:`,
          result.success ? "success" : "failed",
          result.summary ?? result.error
        );
      })
      .catch((error) => {
        console.error(`[AgentService] Agent ${agentId} crashed:`, error);
      })
      .finally(() => {
        this.runningAgents.delete(agentId);
      });
  }

  async stopAgent(agentId: string): Promise<void> {
    const runner = this.runningAgents.get(agentId);

    if (runner) {
      await runner.stop();
      this.runningAgents.delete(agentId);
      console.log(`[AgentService] Stopped agent ${agentId}`);
    } else {
      // Agent might not be in memory, update database directly
      await db.agent.update({
        where: { id: agentId },
        data: {
          status: AgentStatus.IDLE,
          currentTaskId: null,
        },
      });
      console.log(`[AgentService] Stopped agent ${agentId} (was not in memory)`);
    }
  }

  async pauseAgent(agentId: string): Promise<void> {
    const runner = this.runningAgents.get(agentId);

    if (runner) {
      await runner.pause();
      this.runningAgents.delete(agentId);
      console.log(`[AgentService] Paused agent ${agentId}`);
    } else {
      await db.agent.update({
        where: { id: agentId },
        data: { status: AgentStatus.PAUSED },
      });
      console.log(`[AgentService] Paused agent ${agentId} (was not in memory)`);
    }
  }

  async resumeAgent(agentId: string): Promise<void> {
    // Get agent from database
    const agent = await db.agent.findUnique({
      where: { id: agentId },
      include: { currentTask: true },
    });

    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    if (agent.status !== AgentStatus.PAUSED) {
      throw new Error(`Agent is not paused. Current status: ${agent.status}`);
    }

    if (!agent.currentTaskId) {
      throw new Error(`Agent has no assigned task`);
    }

    // Check if already running
    if (this.runningAgents.has(agentId)) {
      throw new Error(`Agent is already running`);
    }

    // Create config from existing agent data
    const config: AgentConfig = {
      taskId: agent.currentTaskId,
      workingDir: process.cwd(), // This should be stored somewhere
      branchName: agent.branchName ?? `agent/${agent.currentTaskId.slice(0, 8)}`,
      maxIterations: 50,
    };

    // Create and start runner
    const runner = createAgentRunner(agentId, config, this.anthropic);
    this.runningAgents.set(agentId, runner);

    this.startRunnerInBackground(agentId, runner);

    console.log(`[AgentService] Resumed agent ${agentId}`);
  }

  // ==========================================================================
  // Agent Queries
  // ==========================================================================

  async getAgentStatus(agentId: string): Promise<Agent & { logs: unknown[] }> {
    const agent = await db.agent.findUnique({
      where: { id: agentId },
      include: {
        logs: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        currentTask: true,
      },
    });

    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    return agent;
  }

  async getAllAgents(): Promise<Agent[]> {
    return db.agent.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        currentTask: true,
      },
    });
  }

  async getRunningAgents(): Promise<Agent[]> {
    return db.agent.findMany({
      where: { status: AgentStatus.WORKING },
      orderBy: { startedAt: "desc" },
      include: {
        currentTask: true,
      },
    });
  }

  async getAgentsByStatus(status: AgentStatus): Promise<Agent[]> {
    return db.agent.findMany({
      where: { status },
      orderBy: { createdAt: "desc" },
      include: {
        currentTask: true,
      },
    });
  }

  // ==========================================================================
  // Cleanup & Maintenance
  // ==========================================================================

  async cleanupStaleAgents(): Promise<void> {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    // Find stale agents
    const staleAgents = await db.agent.findMany({
      where: {
        status: AgentStatus.WORKING,
        lastActivityAt: {
          lt: tenMinutesAgo,
        },
      },
      include: {
        currentTask: true,
      },
    });

    console.log(
      `[AgentService] Found ${staleAgents.length} stale agents to clean up`
    );

    for (const agent of staleAgents) {
      try {
        // Remove from running agents map if present
        this.runningAgents.delete(agent.id);

        // Update agent status to STUCK
        await db.agent.update({
          where: { id: agent.id },
          data: {
            status: AgentStatus.STUCK,
            completedAt: new Date(),
          },
        });

        // Update task status if assigned
        if (agent.currentTaskId) {
          await db.task.update({
            where: { id: agent.currentTaskId },
            data: {
              status: TaskStatus.FAILED,
            },
          });
        }

        // Release file locks held by this agent
        await db.fileLock.deleteMany({
          where: { agentId: agent.id },
        });

        // Create exception
        await db.exception.create({
          data: {
            exceptionType: ExceptionType.AGENT_STUCK,
            agentId: agent.id,
            taskId: agent.currentTaskId ?? undefined,
            severity: ExceptionSeverity.ERROR,
            title: "Agent became unresponsive",
            description: `Agent ${agent.id} has not reported activity for over 10 minutes. Last activity: ${agent.lastActivityAt?.toISOString() ?? "never"}`,
            suggestedAction:
              "Review the agent logs to determine what happened. The task may need to be requeued.",
          },
        });

        console.log(
          `[AgentService] Marked agent ${agent.id} as stuck and released resources`
        );
      } catch (error) {
        console.error(
          `[AgentService] Failed to cleanup stale agent ${agent.id}:`,
          error
        );
      }
    }
  }

  async releaseExpiredLocks(): Promise<number> {
    const now = new Date();

    const result = await db.fileLock.deleteMany({
      where: {
        expiresAt: {
          lt: now,
        },
      },
    });

    if (result.count > 0) {
      console.log(`[AgentService] Released ${result.count} expired file locks`);
    }

    return result.count;
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  async getStats(): Promise<{
    total: number;
    byStatus: Record<AgentStatus, number>;
    inMemory: number;
  }> {
    const agents = await db.agent.groupBy({
      by: ["status"],
      _count: { status: true },
    });

    const total = await db.agent.count();

    const byStatus = Object.values(AgentStatus).reduce(
      (acc, status) => {
        acc[status] = 0;
        return acc;
      },
      {} as Record<AgentStatus, number>
    );

    for (const group of agents) {
      byStatus[group.status] = group._count.status;
    }

    return {
      total,
      byStatus,
      inMemory: this.runningAgents.size,
    };
  }

  // ==========================================================================
  // Utility
  // ==========================================================================

  isAgentRunning(agentId: string): boolean {
    return this.runningAgents.has(agentId);
  }

  getRunningAgentIds(): string[] {
    return Array.from(this.runningAgents.keys());
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const agentService = new AgentService();

// Re-export class for testing
export { AgentService };
