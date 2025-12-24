import Anthropic from "@anthropic-ai/sdk";
import { exec } from "child_process";
import { promisify } from "util";

import { db } from "@/lib/db";
import type { AgentConfig, ToolResult } from "@/types";
import {
  AgentStatus,
  ExceptionSeverity,
  ExceptionType,
  LogType,
  TaskStatus,
  VerificationStatus,
  type Task,
} from "@/types";

import { coordinatorService } from "./coordinator-service";
import { AGENT_TOOLS, executeTool, parseTaskCompletion } from "./tools";
import { verificationService } from "./verification-service";

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

interface AgentRunnerResult {
  success: boolean;
  summary?: string;
  error?: string;
}

type IterationResult = "continue" | "complete" | "failed" | "retry";

type TaskCompleteResult = "complete" | "retry" | "failed";

// ============================================================================
// AgentRunner Class
// ============================================================================

export class AgentRunner {
  private readonly agentId: string;
  private readonly config: AgentConfig;
  private readonly anthropic: Anthropic;

  private isRunning = false;
  private conversationHistory: Anthropic.MessageParam[] = [];
  private totalTokens = 0;
  private currentTask: Task | null = null;
  private lastCompletionSummary: string | null = null;
  private retryCount = 0;
  private startTime: Date | null = null;

  // Configuration
  private readonly MAX_RUNNING_TIME_MS = 30 * 60 * 1000; // 30 minutes

  constructor(
    agentId: string,
    config: AgentConfig,
    anthropic: Anthropic
  ) {
    this.agentId = agentId;
    this.config = config;
    this.anthropic = anthropic;
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  async start(): Promise<AgentRunnerResult> {
    if (this.isRunning) {
      return { success: false, error: "Agent is already running" };
    }

    this.isRunning = true;
    this.conversationHistory = [];
    this.totalTokens = 0;
    this.retryCount = 0;
    this.startTime = new Date();

    try {
      // Fetch task details
      this.currentTask = await db.task.findUnique({
        where: { id: this.config.taskId },
      });

      if (!this.currentTask) {
        return { success: false, error: "Task not found" };
      }

      // Update agent status
      await db.agent.update({
        where: { id: this.agentId },
        data: {
          status: AgentStatus.WORKING,
          currentTaskId: this.config.taskId,
          branchName: this.config.branchName,
          startedAt: new Date(),
          lastActivityAt: new Date(),
        },
      });

      // Update task status
      await db.task.update({
        where: { id: this.config.taskId },
        data: {
          status: TaskStatus.IN_PROGRESS,
          assignedAgentId: this.agentId,
          assignedAt: new Date(),
          branchName: this.config.branchName,
        },
      });

      await this.logActivity(
        LogType.STATUS_CHANGE,
        `Agent started working on task: ${this.currentTask.title}`
      );

      // Run the agent loop
      const maxIterations = this.config.maxIterations ?? 50;
      let iteration = 0;
      let result: IterationResult = "continue";

      while (this.isRunning && result === "continue" && iteration < maxIterations) {
        iteration++;
        await this.updateHeartbeat();

        try {
          result = await this.runIteration();
        } catch (error) {
          // Handle API errors with retry
          const recovered = await this.handleIterationError(error, iteration);
          if (!recovered) {
            result = "failed";
          }
        }
      }

      // Handle max iterations reached
      if (iteration >= maxIterations && result === "continue") {
        await this.logActivity(
          LogType.ERROR,
          `Agent reached maximum iterations (${maxIterations})`
        );

        await this.createException(
          ExceptionType.AGENT_STUCK,
          ExceptionSeverity.ERROR,
          "Agent reached maximum iterations",
          `The agent ran for ${maxIterations} iterations without completing the task.`,
          "Review the agent logs and consider breaking the task into smaller pieces."
        );

        result = "failed";
      }

      // Finalize based on result
      return await this.finalize(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.logActivity(LogType.ERROR, `Agent crashed: ${errorMessage}`);

      await this.createException(
        ExceptionType.UNKNOWN_ERROR,
        ExceptionSeverity.CRITICAL,
        "Agent crashed unexpectedly",
        errorMessage
      );

      // Release all locks on crash
      await coordinatorService.releaseAllLocks(this.agentId);
      await this.updateAgentStatus(AgentStatus.FAILED);
      return { success: false, error: errorMessage };
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    await coordinatorService.releaseAllLocks(this.agentId);
    await this.updateAgentStatus(AgentStatus.IDLE);
    await this.logActivity(LogType.STATUS_CHANGE, "Agent stopped");
  }

  async pause(): Promise<void> {
    this.isRunning = false;
    // Note: Keep locks when paused so agent can resume
    await this.updateAgentStatus(AgentStatus.PAUSED);
    await this.logActivity(LogType.STATUS_CHANGE, "Agent paused");
  }

  // ==========================================================================
  // Private Methods - Core Loop
  // ==========================================================================

  private async runIteration(): Promise<IterationResult> {
    const systemPrompt = this.buildSystemPrompt(this.currentTask!);

    // Call Claude API
    const response = await this.callClaudeWithRetry(systemPrompt);

    // Track token usage
    this.totalTokens += response.usage.input_tokens + response.usage.output_tokens;
    await this.updateTokenUsage();

    // Process response content
    const assistantContent: Anthropic.ContentBlock[] = [];
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    let iterationResult: IterationResult = "continue";

    for (const block of response.content) {
      assistantContent.push(block);

      if (block.type === "text") {
        // Log thinking/text content
        await this.logActivity(LogType.THINKING, block.text);
      } else if (block.type === "tool_use") {
        // Log tool call
        await this.logActivity(LogType.TOOL_CALL, `Calling ${block.name}`, {
          tool: block.name,
          input: block.input,
        });

        // Execute tool
        const toolResult = await executeTool(
          block.name,
          block.input as Record<string, unknown>,
          this.config.workingDir,
          this.agentId,
          this.config.taskId
        );

        // Log tool result
        await this.logActivity(
          toolResult.success ? LogType.TOOL_RESULT : LogType.ERROR,
          toolResult.success ? toolResult.output : toolResult.error ?? "Unknown error",
          { tool: block.name, success: toolResult.success }
        );

        // Check for task completion
        const completion = parseTaskCompletion(toolResult);
        if (completion) {
          if (completion.complete) {
            await this.logActivity(
              LogType.STATUS_CHANGE,
              `Agent marked task complete: ${completion.summary}`
            );
            // Handle verification
            const completeResult = await this.handleTaskComplete(
              completion.summary ?? "Task completed"
            );
            iterationResult = completeResult;
          } else if (completion.failed) {
            await this.logActivity(
              LogType.STATUS_CHANGE,
              `Task failed: ${completion.reason}`
            );
            iterationResult = "failed";
          }
        }

        // Add to tool results
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: this.formatToolResult(toolResult),
        });
      }
    }

    // Add assistant message to history
    this.conversationHistory.push({
      role: "assistant",
      content: assistantContent,
    });

    // If there were tool calls, add tool results and continue
    if (toolResults.length > 0 && (iterationResult === "continue" || iterationResult === "retry")) {
      this.conversationHistory.push({
        role: "user",
        content: toolResults,
      });
    }

    // If stop reason is "end_turn" with no tool calls, we might be stuck
    if (response.stop_reason === "end_turn" && toolResults.length === 0) {
      // Prompt the agent to continue or complete
      this.conversationHistory.push({
        role: "user",
        content:
          "Please continue working on the task. If you have completed the task, call the task_complete tool. If you cannot complete it, call the task_failed tool.",
      });
    }

    // If retry, change result to continue so the loop keeps going
    if (iterationResult === "retry") {
      return "continue";
    }

    return iterationResult;
  }

  // ==========================================================================
  // Private Methods - Task Completion & Verification
  // ==========================================================================

  private async handleTaskComplete(summary: string): Promise<TaskCompleteResult> {
    this.lastCompletionSummary = summary;

    try {
      // Step 1: Commit any changes
      await this.logActivity(LogType.INFO, "Committing changes...");

      try {
        // Check if there are changes to commit
        const { stdout: statusOutput } = await execAsync("git status --porcelain", {
          cwd: this.config.workingDir,
        });

        if (statusOutput.trim()) {
          // There are changes to commit
          await execAsync(
            `git add -A && git commit -m "Agent: ${summary.replace(/"/g, '\\"').slice(0, 100)}"`,
            { cwd: this.config.workingDir }
          );
          await this.logActivity(LogType.INFO, "Changes committed successfully");
        } else {
          await this.logActivity(LogType.INFO, "No changes to commit");
        }
      } catch (gitError) {
        await this.logActivity(
          LogType.ERROR,
          `Git commit failed: ${gitError instanceof Error ? gitError.message : String(gitError)}`
        );
        // Continue with verification anyway
      }

      // Step 2: Run verification
      await this.logActivity(LogType.INFO, "Running verification...");

      const verificationResult = await verificationService.verify(
        this.config.taskId,
        this.config.workingDir
      );

      // Step 3: Handle verification result
      if (verificationResult.passed) {
        await this.logActivity(
          LogType.STATUS_CHANGE,
          `Verification passed with confidence ${verificationResult.confidenceScore}`
        );
        return "complete";
      }

      // Verification failed - check retry count
      if (this.retryCount >= 3) {
        // Max retries reached
        await this.logActivity(
          LogType.ERROR,
          `Verification failed after ${this.retryCount} attempts`
        );

        await this.createException(
          ExceptionType.VERIFICATION_FAILED,
          ExceptionSeverity.ERROR,
          "Task verification failed after maximum attempts",
          this.formatVerificationFailures(verificationResult),
          "Review the agent's changes and verification results. Consider simplifying the task."
        );

        return "failed";
      }

      // Try to continue with feedback
      const decision = await this.handleVerificationFailure(verificationResult);

      if (decision === "give_up") {
        await this.createException(
          ExceptionType.AGENT_STUCK,
          ExceptionSeverity.ERROR,
          "Agent exceeded maximum running time",
          `Agent has been running for over 30 minutes without completing verification.`,
          "Consider breaking the task into smaller pieces or reviewing the agent's approach."
        );
        return "failed";
      }

      return "retry";
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.logActivity(LogType.ERROR, `Verification error: ${errorMessage}`);
      return "failed";
    }
  }

  private formatVerificationFailures(result: {
    syntaxPassed: boolean | null;
    typesPassed: boolean | null;
    lintPassed: boolean | null;
    testsPassed: boolean | null;
    failures: unknown;
    semanticExplanation: string | null;
  }): string {
    const lines: string[] = [];

    if (!result.syntaxPassed) lines.push("- Syntax errors detected");
    if (!result.typesPassed) lines.push("- TypeScript type errors");
    if (!result.lintPassed) lines.push("- ESLint errors");
    if (!result.testsPassed) lines.push("- Test failures");

    if (result.failures && Array.isArray(result.failures)) {
      const failures = result.failures as Array<{ message?: string }>;
      for (const failure of failures.slice(0, 10)) {
        if (failure.message) {
          lines.push(`  • ${failure.message}`);
        }
      }
    }

    if (result.semanticExplanation) {
      lines.push(`\nSemantic analysis: ${result.semanticExplanation}`);
    }

    return lines.join("\n");
  }

  private buildVerificationFeedback(result: {
    syntaxPassed: boolean | null;
    typesPassed: boolean | null;
    lintPassed: boolean | null;
    testsPassed: boolean | null;
    testsTotal: number | null;
    testsFailed: number | null;
    failures: unknown;
    semanticScore: unknown;
    semanticExplanation: string | null;
    recommendations: string[];
  }): string {
    let feedback = `## Verification Failed

Your changes did not pass verification. Please fix the issues and call task_complete again.

### Check Results:
`;

    feedback += `- Syntax: ${result.syntaxPassed ? "✓ Passed" : "✗ Failed"}\n`;
    feedback += `- Types: ${result.typesPassed ? "✓ Passed" : "✗ Failed"}\n`;
    feedback += `- Lint: ${result.lintPassed ? "✓ Passed" : "✗ Failed"}\n`;
    feedback += `- Tests: ${result.testsPassed ? "✓ Passed" : "✗ Failed"}`;
    if (result.testsTotal && result.testsTotal > 0) {
      feedback += ` (${result.testsFailed ?? 0}/${result.testsTotal} failed)`;
    }
    feedback += "\n";

    if (result.failures && Array.isArray(result.failures) && result.failures.length > 0) {
      feedback += "\n### Errors:\n";
      const failures = result.failures as Array<{ type?: string; message?: string; file?: string; line?: number }>;
      for (const failure of failures.slice(0, 15)) {
        if (failure.file && failure.line) {
          feedback += `- ${failure.file}:${failure.line}: ${failure.message}\n`;
        } else if (failure.message) {
          feedback += `- ${failure.message}\n`;
        }
      }
      if (failures.length > 15) {
        feedback += `... and ${failures.length - 15} more errors\n`;
      }
    }

    if (result.semanticExplanation) {
      feedback += `\n### Semantic Analysis:\n${result.semanticExplanation}\n`;
    }

    if (result.recommendations.length > 0) {
      feedback += "\n### Recommendations:\n";
      for (const rec of result.recommendations) {
        feedback += `- ${rec}\n`;
      }
    }

    feedback += "\nPlease fix these issues and try again.";

    return feedback;
  }

  /**
   * Handle a verification failure and determine if the agent should continue or give up.
   * Returns 'continue' to keep the agent loop going, or 'give_up' to stop.
   */
  private async handleVerificationFailure(
    result: {
      syntaxPassed: boolean | null;
      typesPassed: boolean | null;
      lintPassed: boolean | null;
      testsPassed: boolean | null;
      testsTotal: number | null;
      testsFailed: number | null;
      failures: unknown;
      semanticScore: unknown;
      semanticExplanation: string | null;
      recommendations: string[];
    }
  ): Promise<"continue" | "give_up"> {
    // Check if agent has been running too long
    if (this.startTime) {
      const runningTime = Date.now() - this.startTime.getTime();
      if (runningTime > this.MAX_RUNNING_TIME_MS) {
        await this.logActivity(
          LogType.ERROR,
          `Agent has been running for ${Math.floor(runningTime / 60000)} minutes, giving up`
        );
        return "give_up";
      }
    }

    // Increment retry count
    this.retryCount++;

    // Update task verification attempts in database
    await db.task.update({
      where: { id: this.config.taskId },
      data: {
        verificationAttempts: { increment: 1 },
      },
    });

    // Build detailed feedback message
    const feedbackMessage = this.buildDetailedFailureFeedback(result);

    // Add feedback to conversation history
    this.conversationHistory.push({
      role: "user",
      content: feedbackMessage,
    });

    await this.logActivity(
      LogType.INFO,
      `Verification failed (attempt ${this.retryCount}/3), providing feedback to agent`
    );

    return "continue";
  }

  /**
   * Build a detailed feedback message from verification failures.
   * Lists each failure with file and line number.
   */
  private buildDetailedFailureFeedback(result: {
    syntaxPassed: boolean | null;
    typesPassed: boolean | null;
    lintPassed: boolean | null;
    testsPassed: boolean | null;
    testsTotal: number | null;
    testsFailed: number | null;
    failures: unknown;
    semanticScore: unknown;
    semanticExplanation: string | null;
    recommendations: string[];
  }): string {
    let message = `The verification failed with these issues:\n\n`;

    // List failures with file and line
    if (result.failures && Array.isArray(result.failures)) {
      const failures = result.failures as Array<{
        type?: string;
        message?: string;
        file?: string;
        line?: number;
      }>;

      for (const failure of failures) {
        if (failure.file && failure.line) {
          message += `- ${failure.file}:${failure.line} - ${failure.message || "Error"}\n`;
        } else if (failure.file) {
          message += `- ${failure.file}: ${failure.message || "Error"}\n`;
        } else if (failure.message) {
          message += `- ${failure.message}\n`;
        }
      }
    }

    // Add check status summary
    message += `\nCheck status:\n`;
    message += `- Syntax: ${result.syntaxPassed === false ? "FAILED" : result.syntaxPassed ? "PASSED" : "SKIPPED"}\n`;
    message += `- Types: ${result.typesPassed === false ? "FAILED" : result.typesPassed ? "PASSED" : "SKIPPED"}\n`;
    message += `- Lint: ${result.lintPassed === false ? "FAILED" : result.lintPassed ? "PASSED" : "SKIPPED"}\n`;
    message += `- Tests: ${result.testsPassed === false ? "FAILED" : result.testsPassed ? "PASSED" : "SKIPPED"}`;
    if (result.testsFailed && result.testsTotal) {
      message += ` (${result.testsFailed}/${result.testsTotal} failed)`;
    }
    message += "\n";

    // Add semantic explanation if available
    if (result.semanticExplanation) {
      message += `\nSemantic analysis: ${result.semanticExplanation}\n`;
    }

    // Add recommendations
    if (result.recommendations.length > 0) {
      message += `\nRecommendations:\n`;
      for (const rec of result.recommendations) {
        message += `- ${rec}\n`;
      }
    }

    message += `\nPlease fix these issues and try again. Then call task_complete.`;

    return message;
  }

  private async callClaudeWithRetry(
    systemPrompt: string,
    maxRetries = 3
  ): Promise<Anthropic.Message> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8096,
          system: systemPrompt,
          messages: this.conversationHistory.length > 0
            ? this.conversationHistory
            : [{ role: "user", content: "Begin working on the task." }],
          tools: AGENT_TOOLS.map((tool) => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.input_schema as Anthropic.Tool["input_schema"],
          })),
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        await this.logActivity(
          LogType.ERROR,
          `API call failed (attempt ${attempt}/${maxRetries}): ${lastError.message}`
        );

        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError ?? new Error("API call failed after retries");
  }

  private async handleIterationError(
    error: unknown,
    iteration: number
  ): Promise<boolean> {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await this.logActivity(
      LogType.ERROR,
      `Iteration ${iteration} error: ${errorMessage}`
    );

    // Check if it's a rate limit error
    if (errorMessage.includes("rate_limit") || errorMessage.includes("429")) {
      await this.logActivity(LogType.INFO, "Rate limited, waiting 60 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 60000));
      return true;
    }

    // Check if it's a transient error
    if (
      errorMessage.includes("timeout") ||
      errorMessage.includes("ECONNRESET") ||
      errorMessage.includes("502") ||
      errorMessage.includes("503")
    ) {
      await this.logActivity(LogType.INFO, "Transient error, retrying...");
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return true;
    }

    // Non-recoverable error
    return false;
  }

  // ==========================================================================
  // Private Methods - Prompts
  // ==========================================================================

  private buildSystemPrompt(task: Task): string {
    const filesHint =
      task.filesHint && task.filesHint.length > 0
        ? `\n\nRelevant files to look at:\n${task.filesHint.map((f) => `- ${f}`).join("\n")}`
        : "";

    return `You are an AI software engineering agent working on a specific task. Your goal is to complete the task efficiently and correctly.

## Task
**Title:** ${task.title}

**Description:**
${task.description}

## Working Environment
- Working directory: ${this.config.workingDir}
- Branch: ${this.config.branchName}
${filesHint}

## Instructions
1. Focus ONLY on this specific task. Do not work on unrelated issues.
2. Use the available tools to explore the codebase, understand the context, and make changes.
3. Always read relevant files before modifying them.
4. Make minimal, focused changes that address the task requirements.
5. Run tests if the project has them to verify your changes work correctly.
6. When you have successfully completed the task, call the \`task_complete\` tool with a summary.
7. If you encounter an insurmountable obstacle or cannot complete the task, call the \`task_failed\` tool with an explanation.

## Important Guidelines
- Write clean, maintainable code following the project's existing patterns.
- Do not introduce security vulnerabilities.
- If you're unsure about something, explore the codebase to find examples.
- Keep your changes focused - do not refactor unrelated code.
- Test your changes when possible before marking the task complete.

Begin by exploring the relevant parts of the codebase to understand the context, then implement the required changes.`;
  }

  private formatToolResult(result: ToolResult): string {
    if (result.success) {
      return result.output;
    }
    return `Error: ${result.error}`;
  }

  // ==========================================================================
  // Private Methods - Database Operations
  // ==========================================================================

  private async logActivity(
    type: LogType,
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      await db.agentLog.create({
        data: {
          agentId: this.agentId,
          taskId: this.config.taskId,
          logType: type,
          content: content.slice(0, 50000), // Truncate very long content
          metadata: metadata ?? undefined,
        },
      });
    } catch (error) {
      console.error("Failed to log activity:", error);
    }
  }

  private async updateHeartbeat(): Promise<void> {
    try {
      await db.agent.update({
        where: { id: this.agentId },
        data: { lastActivityAt: new Date() },
      });
    } catch (error) {
      console.error("Failed to update heartbeat:", error);
    }
  }

  private async updateTokenUsage(): Promise<void> {
    try {
      await db.agent.update({
        where: { id: this.agentId },
        data: { totalTokensUsed: this.totalTokens },
      });
    } catch (error) {
      console.error("Failed to update token usage:", error);
    }
  }

  private async updateAgentStatus(status: AgentStatus): Promise<void> {
    try {
      const data: Record<string, unknown> = { status };

      if (status === AgentStatus.COMPLETED || status === AgentStatus.FAILED) {
        data.completedAt = new Date();
        data.currentTaskId = null;
      }

      await db.agent.update({
        where: { id: this.agentId },
        data,
      });
    } catch (error) {
      console.error("Failed to update agent status:", error);
    }
  }

  private async createException(
    type: ExceptionType,
    severity: ExceptionSeverity,
    title: string,
    description?: string,
    suggestedAction?: string
  ): Promise<void> {
    try {
      await db.exception.create({
        data: {
          exceptionType: type,
          agentId: this.agentId,
          taskId: this.config.taskId,
          severity,
          title,
          description,
          suggestedAction,
        },
      });
    } catch (error) {
      console.error("Failed to create exception:", error);
    }
  }

  private async finalize(result: IterationResult): Promise<AgentRunnerResult> {
    const isSuccess = result === "complete";

    // Release all file locks held by this agent
    await coordinatorService.releaseAllLocks(this.agentId);

    // Get current task state (verification may have already updated it)
    const currentTask = await db.task.findUnique({
      where: { id: this.config.taskId },
    });

    // Determine final task status
    // If verification already ran and updated status, respect that
    const taskAlreadyCompleted = currentTask?.status === TaskStatus.COMPLETED;
    const taskAlreadyFailed = currentTask?.status === TaskStatus.FAILED;

    // Update agent
    await db.agent.update({
      where: { id: this.agentId },
      data: {
        status: isSuccess ? AgentStatus.IDLE : AgentStatus.FAILED,
        completedAt: new Date(),
        currentTaskId: null,
        tasksCompleted: isSuccess ? { increment: 1 } : undefined,
        tasksFailed: !isSuccess ? { increment: 1 } : undefined,
      },
    });

    // Only update task if it hasn't been updated by verification
    if (!taskAlreadyCompleted && !taskAlreadyFailed) {
      await db.task.update({
        where: { id: this.config.taskId },
        data: {
          status: isSuccess ? TaskStatus.COMPLETED : TaskStatus.FAILED,
          completedAt: new Date(),
        },
      });
    }

    // Get the last log entry for summary
    const lastLog = await db.agentLog.findFirst({
      where: {
        agentId: this.agentId,
        taskId: this.config.taskId,
        logType: LogType.STATUS_CHANGE,
      },
      orderBy: { createdAt: "desc" },
    });

    if (isSuccess) {
      return {
        success: true,
        summary: this.lastCompletionSummary ?? lastLog?.content ?? "Task completed",
      };
    }

    // Create exception for agent-declared failures (not verification failures)
    // Verification failures already have exceptions created
    if (result === "failed" && currentTask?.verificationStatus !== VerificationStatus.FAILED) {
      await this.createException(
        ExceptionType.UNKNOWN_ERROR,
        ExceptionSeverity.WARNING,
        "Agent reported task failure",
        lastLog?.content ?? "Unknown reason"
      );
    }

    return {
      success: false,
      error: lastLog?.content ?? "Task failed",
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createAgentRunner(
  agentId: string,
  config: AgentConfig,
  anthropic?: Anthropic
): AgentRunner {
  const client = anthropic ?? new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  return new AgentRunner(agentId, config, client);
}
