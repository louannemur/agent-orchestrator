import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  AgentStatus,
  ExceptionSeverity,
  ExceptionType,
  LogType,
  TaskStatus,
  VerificationStatus,
} from "@/types";

export const dynamic = "force-dynamic";

// ============================================================================
// Response Helpers
// ============================================================================

function jsonResponse<T>(data: T, status = 200): NextResponse<{ data: T }> {
  return NextResponse.json({ data }, { status });
}

function errorResponse(
  message: string,
  status = 400
): NextResponse<{ error: string; message: string }> {
  return NextResponse.json({ error: message, message }, { status });
}

// ============================================================================
// Schemas
// ============================================================================

const verificationResultSchema = z.object({
  passed: z.boolean(),
  confidenceScore: z.number().min(0).max(1),
  syntaxPassed: z.boolean().nullable().optional(),
  typesPassed: z.boolean().nullable().optional(),
  lintPassed: z.boolean().nullable().optional(),
  testsPassed: z.boolean().nullable().optional(),
  testsTotal: z.number().int().nullable().optional(),
  testsFailed: z.number().int().nullable().optional(),
  semanticScore: z.number().min(0).max(1).nullable().optional(),
  semanticExplanation: z.string().nullable().optional(),
  failures: z.array(z.record(z.unknown())).optional(),
  recommendations: z.array(z.string()).optional(),
});

const completeSchema = z.object({
  runnerToken: z.string().min(1),
  agentId: z.string().uuid(),
  taskId: z.string().uuid(),
  success: z.boolean(),
  summary: z.string().optional(),
  error: z.string().optional(),
  verification: verificationResultSchema.optional(),
});

// ============================================================================
// POST /api/runner/complete
// Mark a task as complete or failed
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = completeSchema.safeParse(body);

    if (!result.success) {
      return errorResponse(`Invalid request: ${result.error.message}`, 400);
    }

    const { runnerToken, agentId, taskId, success, summary, error, verification } = result.data;

    // Validate runner session
    const session = await db.runnerSession.findUnique({
      where: { token: runnerToken },
    });

    if (!session || !session.isActive) {
      return errorResponse("Invalid or inactive runner session", 401);
    }

    // Verify agent belongs to this session
    const agent = await db.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      return errorResponse("Agent not found", 404);
    }

    if (agent.runnerSessionId !== session.id) {
      return errorResponse("Agent does not belong to this runner session", 403);
    }

    // Verify task
    const task = await db.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return errorResponse("Task not found", 404);
    }

    if (task.assignedAgentId !== agentId) {
      return errorResponse("Task is not assigned to this agent", 403);
    }

    // Store verification result if provided
    if (verification) {
      const attemptNumber = task.verificationAttempts + 1;

      await db.verificationResult.create({
        data: {
          taskId,
          attemptNumber,
          passed: verification.passed,
          confidenceScore: verification.confidenceScore,
          syntaxPassed: verification.syntaxPassed ?? null,
          typesPassed: verification.typesPassed ?? null,
          lintPassed: verification.lintPassed ?? null,
          testsPassed: verification.testsPassed ?? null,
          testsTotal: verification.testsTotal ?? null,
          testsFailed: verification.testsFailed ?? null,
          semanticScore: verification.semanticScore ?? null,
          semanticExplanation: verification.semanticExplanation ?? null,
          failures: JSON.parse(JSON.stringify(verification.failures ?? [])),
          recommendations: verification.recommendations ?? [],
        },
      });

      // Update task verification attempts
      await db.task.update({
        where: { id: taskId },
        data: {
          verificationAttempts: attemptNumber,
          verificationStatus: verification.passed
            ? VerificationStatus.PASSED
            : VerificationStatus.FAILED,
        },
      });
    }

    // Update task status
    await db.task.update({
      where: { id: taskId },
      data: {
        status: success ? TaskStatus.COMPLETED : TaskStatus.FAILED,
        completedAt: new Date(),
      },
    });

    // Update agent status
    await db.agent.update({
      where: { id: agentId },
      data: {
        status: AgentStatus.IDLE,
        currentTaskId: null,
        completedAt: new Date(),
        tasksCompleted: success ? { increment: 1 } : undefined,
        tasksFailed: !success ? { increment: 1 } : undefined,
      },
    });

    // Log completion
    await db.agentLog.create({
      data: {
        agentId,
        taskId,
        logType: LogType.STATUS_CHANGE,
        content: success
          ? `Task completed: ${summary ?? "No summary provided"}`
          : `Task failed: ${error ?? "Unknown error"}`,
      },
    });

    // Release file locks
    await db.fileLock.deleteMany({
      where: { agentId },
    });

    // Create exception if task failed
    if (!success) {
      await db.exception.create({
        data: {
          exceptionType: verification
            ? ExceptionType.VERIFICATION_FAILED
            : ExceptionType.UNKNOWN_ERROR,
          agentId,
          taskId,
          severity: ExceptionSeverity.ERROR,
          title: "Task failed",
          description: error ?? "Unknown error",
          suggestedAction: "Review the agent logs and retry the task",
        },
      });
    }

    // Update session last seen
    await db.runnerSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });

    return jsonResponse({
      success: true,
      taskStatus: success ? TaskStatus.COMPLETED : TaskStatus.FAILED,
      agentStatus: AgentStatus.IDLE,
    });
  } catch (error) {
    console.error("[POST /api/runner/complete] Error:", error);
    return errorResponse("Failed to complete task", 500);
  }
}
