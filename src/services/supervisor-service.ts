import { prisma } from "@/lib/prisma";
import { coordinatorService } from "./coordinator-service";

// ============================================================================
// Types
// ============================================================================

type FailureType =
  | "SYNTAX_ERROR"
  | "TYPE_ERROR"
  | "LINT_ERROR"
  | "TEST_FAILURE"
  | "SEMANTIC_ERROR"
  | "TIMEOUT"
  | "UNKNOWN";

interface RetryStrategy {
  shouldRetry: boolean;
  delayMs: number;
  maxAttempts: number;
  requiresHumanReview: boolean;
}

interface StuckAgentInfo {
  id: string;
  name: string | null;
  lastActivityAt: Date | null;
  currentTaskId: string | null;
  minutesSinceActivity: number;
}

// ============================================================================
// Supervisor Service
// ============================================================================

/**
 * SupervisorService monitors agents and handles automatic recovery.
 * It periodically checks for stuck agents, cleans up expired locks,
 * and processes failed tasks with appropriate retry strategies.
 */
class SupervisorService {
  // Configuration
  private checkInterval: number = 30 * 1000; // 30 seconds
  private maxRetries: number = 3;
  private stuckThreshold: number = 10 * 60 * 1000; // 10 minutes

  // State
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Start the monitoring loop.
   * Runs checks at the configured interval.
   */
  async startMonitoring(): Promise<void> {
    if (this.isRunning) {
      console.log("[Supervisor] Already running");
      return;
    }

    console.log("[Supervisor] Starting monitoring...");
    this.isRunning = true;

    // Run initial check
    await this.runChecks();

    // Start interval
    this.monitoringInterval = setInterval(async () => {
      await this.runChecks();
    }, this.checkInterval);

    console.log(
      `[Supervisor] Monitoring started (interval: ${this.checkInterval / 1000}s)`
    );
  }

  /**
   * Stop the monitoring loop.
   */
  async stopMonitoring(): Promise<void> {
    if (!this.isRunning) {
      console.log("[Supervisor] Not running");
      return;
    }

    console.log("[Supervisor] Stopping monitoring...");

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.isRunning = false;
    console.log("[Supervisor] Monitoring stopped");
  }

  /**
   * Check for stuck agents (no activity for stuckThreshold).
   * Returns list of stuck agents and optionally takes recovery action.
   */
  async checkForStuckAgents(): Promise<StuckAgentInfo[]> {
    const cutoffTime = new Date(Date.now() - this.stuckThreshold);

    // Find agents that are WORKING but haven't had activity
    const stuckAgents = await prisma.agent.findMany({
      where: {
        status: "WORKING",
        OR: [
          { lastActivityAt: { lt: cutoffTime } },
          { lastActivityAt: null, startedAt: { lt: cutoffTime } },
        ],
      },
      select: {
        id: true,
        name: true,
        lastActivityAt: true,
        currentTaskId: true,
        startedAt: true,
      },
    });

    const stuckAgentInfos: StuckAgentInfo[] = stuckAgents.map((agent) => {
      const lastActivity = agent.lastActivityAt || agent.startedAt;
      const minutesSinceActivity = lastActivity
        ? Math.floor((Date.now() - lastActivity.getTime()) / (60 * 1000))
        : Infinity;

      return {
        id: agent.id,
        name: agent.name,
        lastActivityAt: agent.lastActivityAt,
        currentTaskId: agent.currentTaskId,
        minutesSinceActivity,
      };
    });

    // Handle stuck agents
    for (const agent of stuckAgentInfos) {
      console.log(
        `[Supervisor] Stuck agent detected: ${agent.name} (${agent.minutesSinceActivity} minutes inactive)`
      );

      // Create exception
      await prisma.exception.create({
        data: {
          exceptionType: "AGENT_STUCK",
          severity: "ERROR",
          title: `Agent stuck: ${agent.name}`,
          description: `Agent has been inactive for ${agent.minutesSinceActivity} minutes`,
          agentId: agent.id,
          taskId: agent.currentTaskId,
        },
      });

      // Mark agent as failed
      await prisma.agent.update({
        where: { id: agent.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
        },
      });

      // Release any locks held by this agent
      await coordinatorService.releaseAllLocks(agent.id);

      // If agent had a task, mark it as failed
      if (agent.currentTaskId) {
        await prisma.task.update({
          where: { id: agent.currentTaskId },
          data: {
            status: "FAILED",
          },
        });
      }
    }

    return stuckAgentInfos;
  }

  /**
   * Clean up expired file locks.
   * Delegates to CoordinatorService.
   */
  async cleanupExpiredLocks(): Promise<number> {
    const releasedCount = await coordinatorService.cleanupExpiredLocks();

    if (releasedCount > 0) {
      console.log(`[Supervisor] Cleaned up ${releasedCount} expired locks`);
    }

    return releasedCount;
  }

  /**
   * Process failed tasks that are eligible for retry.
   * Applies retry strategy based on failure type.
   */
  async processFailedTasks(): Promise<void> {
    // Find failed tasks that haven't exceeded max retries
    const failedTasks = await prisma.task.findMany({
      where: {
        status: "FAILED",
        verificationAttempts: { lt: this.maxRetries },
      },
      include: {
        assignedAgent: true,
        verificationResults: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    for (const task of failedTasks) {
      // Get error from latest verification result if available
      const latestResult = task.verificationResults[0];
      // Derive error context from failed checks
      const errorContext = latestResult
        ? [
            !latestResult.syntaxPassed && "syntax",
            !latestResult.typesPassed && "type",
            !latestResult.lintPassed && "lint",
            !latestResult.testsPassed && "test",
          ]
            .filter(Boolean)
            .join(" ")
        : "";
      const failureType = this.classifyFailure(errorContext);
      const strategy = this.getRetryStrategy(failureType);

      if (!strategy.shouldRetry) {
        console.log(
          `[Supervisor] Task ${task.id} not eligible for retry: ${failureType}`
        );

        if (strategy.requiresHumanReview) {
          // Create exception for human review
          await prisma.exception.create({
            data: {
              exceptionType: "UNKNOWN_ERROR",
              severity: "ERROR",
              title: `Task requires review: ${task.title}`,
              description: `Task failed with ${failureType} and requires human intervention`,
              taskId: task.id,
            },
          });
        }
        continue;
      }

      // Check if enough time has passed since last attempt
      const lastAttempt = task.updatedAt;
      const timeSinceLastAttempt = Date.now() - lastAttempt.getTime();

      if (timeSinceLastAttempt < strategy.delayMs) {
        continue; // Not ready for retry yet
      }

      console.log(
        `[Supervisor] Retrying task ${task.id} (attempt ${task.verificationAttempts + 1}/${strategy.maxAttempts})`
      );

      // Reset task for retry
      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: "QUEUED",
          verificationAttempts: task.verificationAttempts + 1,
        },
      });
    }
  }

  /**
   * Handle verification failure for a task.
   * Called by VerificationService when verification fails.
   */
  async handleVerificationFailure(
    taskId: string,
    failures: Array<{ check: string; error: string }>
  ): Promise<void> {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignedAgent: true },
    });

    if (!task) {
      console.error(`[Supervisor] Task not found: ${taskId}`);
      return;
    }

    // Classify the primary failure
    const primaryFailure = failures[0];
    const failureType = primaryFailure
      ? this.classifyVerificationFailure(primaryFailure.check)
      : "UNKNOWN";
    const strategy = this.getRetryStrategy(failureType);

    console.log(
      `[Supervisor] Verification failure for task ${taskId}: ${failureType}`
    );

    if (task.verificationAttempts >= strategy.maxAttempts || !strategy.shouldRetry) {
      // Max retries exceeded or not retryable
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: "FAILED",
        },
      });

      // Create exception
      await prisma.exception.create({
        data: {
          exceptionType: "VERIFICATION_FAILED",
          severity: strategy.requiresHumanReview ? "CRITICAL" : "ERROR",
          title: `Verification failed: ${task.title}`,
          description: `Task failed verification after ${task.verificationAttempts} attempts. Failures: ${failures.map((f) => f.check).join(", ")}`,
          taskId: task.id,
          agentId: task.assignedAgentId,
        },
      });
    } else {
      // Queue for retry with appropriate delay
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: "QUEUED",
          verificationAttempts: task.verificationAttempts + 1,
        },
      });

      console.log(
        `[Supervisor] Task ${taskId} queued for retry (attempt ${task.verificationAttempts + 1})`
      );
    }
  }

  // ============================================================================
  // Check Methods
  // ============================================================================

  /**
   * Run all monitoring checks.
   * Called by the monitoring loop and can be invoked directly by cron jobs.
   */
  async runChecks(): Promise<void> {
    try {
      console.log("[Supervisor] Running checks...");

      // Run checks in parallel
      const [stuckAgents, expiredLocks] = await Promise.all([
        this.checkForStuckAgents(),
        this.cleanupExpiredLocks(),
      ]);

      // Process failed tasks (sequential to avoid race conditions)
      await this.processFailedTasks();

      console.log(
        `[Supervisor] Checks complete - Stuck agents: ${stuckAgents.length}, Expired locks: ${expiredLocks}`
      );
    } catch (error) {
      console.error("[Supervisor] Error running checks:", error);

      // Create exception for monitoring failure
      await prisma.exception.create({
        data: {
          exceptionType: "UNKNOWN_ERROR",
          severity: "ERROR",
          title: "Supervisor check failed",
          description:
            error instanceof Error ? error.message : "Unknown error during monitoring",
        },
      });
    }
  }

  /**
   * Get retry strategy based on failure type.
   * Different failure types have different retry behaviors.
   */
  private getRetryStrategy(failureType: FailureType): RetryStrategy {
    switch (failureType) {
      case "SYNTAX_ERROR":
        return {
          shouldRetry: true,
          delayMs: 5 * 1000, // 5 seconds
          maxAttempts: 3,
          requiresHumanReview: false,
        };

      case "TYPE_ERROR":
        return {
          shouldRetry: true,
          delayMs: 10 * 1000, // 10 seconds
          maxAttempts: 3,
          requiresHumanReview: false,
        };

      case "LINT_ERROR":
        return {
          shouldRetry: true,
          delayMs: 5 * 1000, // 5 seconds
          maxAttempts: 2,
          requiresHumanReview: false,
        };

      case "TEST_FAILURE":
        return {
          shouldRetry: true,
          delayMs: 30 * 1000, // 30 seconds
          maxAttempts: 2,
          requiresHumanReview: true,
        };

      case "SEMANTIC_ERROR":
        return {
          shouldRetry: false,
          delayMs: 0,
          maxAttempts: 1,
          requiresHumanReview: true,
        };

      case "TIMEOUT":
        return {
          shouldRetry: true,
          delayMs: 60 * 1000, // 1 minute
          maxAttempts: 2,
          requiresHumanReview: false,
        };

      case "UNKNOWN":
      default:
        return {
          shouldRetry: true,
          delayMs: 30 * 1000, // 30 seconds
          maxAttempts: 1,
          requiresHumanReview: true,
        };
    }
  }

  /**
   * Classify a failure message into a failure type.
   */
  private classifyFailure(errorMessage: string): FailureType {
    const lowerMessage = errorMessage.toLowerCase();

    if (lowerMessage.includes("syntax") || lowerMessage.includes("parse")) {
      return "SYNTAX_ERROR";
    }
    if (lowerMessage.includes("type") || lowerMessage.includes("typescript")) {
      return "TYPE_ERROR";
    }
    if (lowerMessage.includes("lint") || lowerMessage.includes("eslint")) {
      return "LINT_ERROR";
    }
    if (
      lowerMessage.includes("test") ||
      lowerMessage.includes("assertion") ||
      lowerMessage.includes("expect")
    ) {
      return "TEST_FAILURE";
    }
    if (
      lowerMessage.includes("semantic") ||
      lowerMessage.includes("logic") ||
      lowerMessage.includes("behavior")
    ) {
      return "SEMANTIC_ERROR";
    }
    if (
      lowerMessage.includes("timeout") ||
      lowerMessage.includes("timed out")
    ) {
      return "TIMEOUT";
    }

    return "UNKNOWN";
  }

  /**
   * Classify a verification check name into a failure type.
   */
  private classifyVerificationFailure(checkName: string): FailureType {
    switch (checkName.toLowerCase()) {
      case "syntax":
        return "SYNTAX_ERROR";
      case "types":
      case "typescript":
        return "TYPE_ERROR";
      case "lint":
      case "eslint":
        return "LINT_ERROR";
      case "tests":
      case "test":
        return "TEST_FAILURE";
      case "semantic":
        return "SEMANTIC_ERROR";
      default:
        return "UNKNOWN";
    }
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const supervisorService = new SupervisorService();
