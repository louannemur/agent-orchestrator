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
// Schemas
// ============================================================================

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const bodySchema = z.object({
  workingDir: z.string().min(1),
});

// ============================================================================
// POST /api/tasks/:id/retry
// ============================================================================

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
    });

    if (!task) {
      return errorResponse("Task not found", 404);
    }

    // Only allow retry for FAILED tasks
    if (task.status !== TaskStatus.FAILED) {
      return errorResponse(
        `Task cannot be retried with status ${task.status}. Only FAILED tasks can be retried.`,
        409
      );
    }

    // Reset task for retry
    await db.task.update({
      where: { id },
      data: {
        status: TaskStatus.QUEUED,
        verificationStatus: VerificationStatus.PENDING,
        verificationAttempts: 0,
        assignedAgentId: null,
        assignedAt: null,
        completedAt: null,
        commitSha: null,
        prUrl: null,
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
      message: `Task reset and new agent ${agentId} started`,
    });
  } catch (error) {
    console.error("[POST /api/tasks/:id/retry] Error:", error);

    if (error instanceof Error) {
      return errorResponse(error.message, 400);
    }

    return errorResponse("Failed to retry task", 500);
  }
}
