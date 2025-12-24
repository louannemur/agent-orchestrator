import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { agentService } from "@/services/agent-service";
import { TaskStatus } from "@/types";

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
// POST /api/tasks/:id/run
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

    // Validate task status
    if (task.status !== TaskStatus.QUEUED && task.status !== TaskStatus.FAILED) {
      return errorResponse(
        `Task cannot be run with status ${task.status}. Only QUEUED or FAILED tasks can be run.`,
        409
      );
    }

    // Spawn agent
    const agentId = await agentService.spawnAgent(id, workingDir);

    return jsonResponse({
      agentId,
      taskId: id,
      status: "started",
      message: `Agent ${agentId} started working on task`,
    });
  } catch (error) {
    console.error("[POST /api/tasks/:id/run] Error:", error);

    if (error instanceof Error) {
      if (error.message.includes("already assigned")) {
        return errorResponse(error.message, 409);
      }
      return errorResponse(error.message, 400);
    }

    return errorResponse("Failed to run task", 500);
  }
}
