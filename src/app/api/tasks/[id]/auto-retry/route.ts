import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { agentService } from "@/services/agent-service";
import { TaskStatus, VerificationStatus } from "@/types";

// ============================================================================
// Response Helpers
// ============================================================================

function jsonResponse<T>(
  data: T,
  status = 200
): NextResponse<{ data: T }> {
  return NextResponse.json({ data }, { status });
}

function errorResponse(
  message: string,
  status = 400
): NextResponse<{ error: string; message: string }> {
  return NextResponse.json({ error: message, message }, { status });
}

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

// ============================================================================
// Retry Strategy Logic (matches supervisor-service)
// ============================================================================

function getRetryStrategy(failureType: FailureType): RetryStrategy {
  switch (failureType) {
    case "SYNTAX_ERROR":
      return {
        shouldRetry: true,
        delayMs: 5 * 1000,
        maxAttempts: 3,
        requiresHumanReview: false,
      };
    case "TYPE_ERROR":
      return {
        shouldRetry: true,
        delayMs: 10 * 1000,
        maxAttempts: 3,
        requiresHumanReview: false,
      };
    case "LINT_ERROR":
      return {
        shouldRetry: true,
        delayMs: 5 * 1000,
        maxAttempts: 2,
        requiresHumanReview: false,
      };
    case "TEST_FAILURE":
      return {
        shouldRetry: true,
        delayMs: 30 * 1000,
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
        delayMs: 60 * 1000,
        maxAttempts: 2,
        requiresHumanReview: false,
      };
    case "UNKNOWN":
    default:
      return {
        shouldRetry: true,
        delayMs: 30 * 1000,
        maxAttempts: 1,
        requiresHumanReview: true,
      };
  }
}

function classifyFailure(errorMessage: string): FailureType {
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
  if (lowerMessage.includes("timeout") || lowerMessage.includes("timed out")) {
    return "TIMEOUT";
  }

  return "UNKNOWN";
}

// ============================================================================
// Schemas
// ============================================================================

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const bodySchema = z.object({
  workingDir: z.string().min(1),
});

// ============================================================================
// POST /api/tasks/:id/auto-retry
// ============================================================================

/**
 * Trigger automatic retry using supervisor's retry strategy.
 * Only works for FAILED tasks with attempts < 3.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate params
    const paramsResult = paramsSchema.safeParse({ id });
    if (!paramsResult.success) {
      return errorResponse("Invalid task ID format", 400);
    }

    // Parse and validate body
    const body = await request.json();
    const bodyResult = bodySchema.safeParse(body);

    if (!bodyResult.success) {
      return errorResponse(
        `Invalid request body: ${bodyResult.error.message}`,
        400
      );
    }

    const { workingDir } = bodyResult.data;

    // Fetch task
    const task = await db.task.findUnique({
      where: { id },
      include: {
        verificationResults: true,
      },
    });

    if (!task) {
      return errorResponse("Task not found", 404);
    }

    // Only allow retry for FAILED tasks
    if (task.status !== TaskStatus.FAILED) {
      return errorResponse(
        `Task cannot be auto-retried with status ${task.status}. Only FAILED tasks can be retried.`,
        409
      );
    }

    // Check retry count
    const currentAttempts = task.verificationAttempts ?? 0;
    if (currentAttempts >= 3) {
      return errorResponse(
        `Task has already been retried ${currentAttempts} times. Maximum retries (3) exceeded.`,
        409
      );
    }

    // Get error info from latest verification result
    const latestVerification = task.verificationResults?.[0];
    const errorInfo = latestVerification?.failures
      ? JSON.stringify(latestVerification.failures)
      : "";

    // Determine retry strategy based on failure type
    const failureType = classifyFailure(errorInfo);
    const strategy = getRetryStrategy(failureType);

    if (!strategy.shouldRetry) {
      return errorResponse(
        `Task failure type "${failureType}" is not eligible for automatic retry. Human review required.`,
        409
      );
    }

    // Check if max attempts for this failure type exceeded
    if (currentAttempts >= strategy.maxAttempts) {
      return errorResponse(
        `Task has exceeded maximum attempts (${strategy.maxAttempts}) for failure type "${failureType}".`,
        409
      );
    }

    // Reset task for retry
    await db.task.update({
      where: { id },
      data: {
        status: TaskStatus.QUEUED,
        verificationStatus: VerificationStatus.PENDING,
        verificationAttempts: currentAttempts + 1,
        assignedAgentId: null,
        assignedAt: null,
        completedAt: null,
      },
    });

    // Spawn new agent
    const agentId = await agentService.spawnAgent(id, workingDir);

    // Fetch updated task
    const updatedTask = await db.task.findUnique({
      where: { id },
      include: {
        assignedAgent: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    return jsonResponse({
      agentId,
      task: updatedTask,
      status: "retrying",
      retryInfo: {
        attempt: currentAttempts + 1,
        maxAttempts: strategy.maxAttempts,
        failureType,
        requiresHumanReview: strategy.requiresHumanReview,
      },
      message: `Auto-retry initiated (attempt ${currentAttempts + 1}/${strategy.maxAttempts}) - Agent ${agentId} started`,
    });
  } catch (error) {
    console.error("[POST /api/tasks/:id/auto-retry] Error:", error);

    if (error instanceof Error) {
      return errorResponse(error.message, 400);
    }

    return errorResponse("Failed to auto-retry task", 500);
  }
}
