import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { RiskLevel, TaskStatus } from "@/types";

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

const patchSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().min(1).optional(),
  priority: z.number().int().min(0).max(3).optional(),
  riskLevel: z.nativeEnum(RiskLevel).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  filesHint: z.array(z.string()).optional(),
});

// Valid status transitions
const VALID_TRANSITIONS: Partial<Record<TaskStatus, TaskStatus[]>> = {
  [TaskStatus.QUEUED]: [TaskStatus.CANCELLED],
  [TaskStatus.FAILED]: [TaskStatus.QUEUED],
  [TaskStatus.CANCELLED]: [TaskStatus.QUEUED],
};

// ============================================================================
// GET /api/tasks/:id
// ============================================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate params
    const parseResult = paramsSchema.safeParse({ id });
    if (!parseResult.success) {
      return errorResponse("Invalid task ID format", 400);
    }

    // Fetch task with related data
    const task = await db.task.findUnique({
      where: { id },
      include: {
        assignedAgent: {
          select: {
            id: true,
            name: true,
            status: true,
            totalTokensUsed: true,
            lastActivityAt: true,
          },
        },
        verificationResults: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        logs: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        exceptions: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        fileLocks: {
          select: {
            id: true,
            filePath: true,
            acquiredAt: true,
          },
        },
      },
    });

    if (!task) {
      return errorResponse("Task not found", 404);
    }

    // Check if any filesHint are currently locked by other agents
    let lockedFilesHint: Array<{
      filePath: string;
      agentId: string;
      agentName: string | null;
    }> = [];

    if (task.filesHint && task.filesHint.length > 0) {
      const normalizedPaths = task.filesHint.map((p) =>
        p.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "")
      );

      const locks = await db.fileLock.findMany({
        where: {
          filePath: { in: normalizedPaths },
          // Exclude locks held by this task's agent
          NOT: task.assignedAgentId
            ? { agentId: task.assignedAgentId }
            : undefined,
        },
        include: {
          agent: {
            select: {
              name: true,
            },
          },
        },
      });

      const now = new Date();
      lockedFilesHint = locks
        .filter((lock) => !lock.expiresAt || lock.expiresAt > now)
        .map((lock) => ({
          filePath: lock.filePath,
          agentId: lock.agentId,
          agentName: lock.agent?.name ?? null,
        }));
    }

    return jsonResponse({
      ...task,
      lockedFilesHint,
      hasFileConflicts: lockedFilesHint.length > 0,
    });
  } catch (error) {
    console.error("[GET /api/tasks/:id] Error:", error);
    return errorResponse("Failed to fetch task", 500);
  }
}

// ============================================================================
// PATCH /api/tasks/:id
// ============================================================================

export async function PATCH(
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
    const bodyResult = patchSchema.safeParse(body);

    if (!bodyResult.success) {
      return errorResponse(
        `Invalid request body: ${bodyResult.error.message}`,
        400
      );
    }

    const updates = bodyResult.data;

    // Fetch current task
    const task = await db.task.findUnique({
      where: { id },
    });

    if (!task) {
      return errorResponse("Task not found", 404);
    }

    // Validate status transition if changing status
    if (updates.status && updates.status !== task.status) {
      const validTransitions = VALID_TRANSITIONS[task.status];

      if (!validTransitions?.includes(updates.status)) {
        return errorResponse(
          `Invalid status transition from ${task.status} to ${updates.status}. ` +
            `Allowed transitions: ${validTransitions?.join(", ") ?? "none"}`,
          409
        );
      }

      // Cannot change status if agent is working on it
      if (task.assignedAgentId) {
        const agent = await db.agent.findUnique({
          where: { id: task.assignedAgentId },
          select: { status: true },
        });

        if (agent?.status === "WORKING") {
          return errorResponse(
            "Cannot change task status while an agent is working on it",
            409
          );
        }
      }
    }

    // Update task
    const updatedTask = await db.task.update({
      where: { id },
      data: {
        ...updates,
        updatedAt: new Date(),
      },
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

    return jsonResponse(updatedTask);
  } catch (error) {
    console.error("[PATCH /api/tasks/:id] Error:", error);
    return errorResponse("Failed to update task", 500);
  }
}

// ============================================================================
// DELETE /api/tasks/:id
// ============================================================================

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate params
    const parseResult = paramsSchema.safeParse({ id });
    if (!parseResult.success) {
      return errorResponse("Invalid task ID format", 400);
    }

    // Fetch task
    const task = await db.task.findUnique({
      where: { id },
    });

    if (!task) {
      return errorResponse("Task not found", 404);
    }

    // Only allow deletion of QUEUED or CANCELLED tasks
    if (task.status !== TaskStatus.QUEUED && task.status !== TaskStatus.CANCELLED) {
      return errorResponse(
        `Cannot delete task with status ${task.status}. Only QUEUED or CANCELLED tasks can be deleted.`,
        409
      );
    }

    // Delete related data first (due to foreign key constraints)
    await Promise.all([
      db.agentLog.deleteMany({ where: { taskId: id } }),
      db.fileLock.deleteMany({ where: { taskId: id } }),
      db.verificationResult.deleteMany({ where: { taskId: id } }),
      db.exception.deleteMany({ where: { taskId: id } }),
    ]);

    // Delete task
    await db.task.delete({
      where: { id },
    });

    return jsonResponse({
      message: "Task deleted successfully",
      id,
    });
  } catch (error) {
    console.error("[DELETE /api/tasks/:id] Error:", error);
    return errorResponse("Failed to delete task", 500);
  }
}
