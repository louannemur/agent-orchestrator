import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { verificationService } from "@/services/verification-service";
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
// Schema
// ============================================================================

const bodySchema = z.object({
  taskId: z.string().uuid(),
  workingDir: z.string().min(1),
});

// ============================================================================
// POST /api/verify
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const parseResult = bodySchema.safeParse(body);

    if (!parseResult.success) {
      return errorResponse(
        `Invalid request body: ${parseResult.error.message}`,
        400
      );
    }

    const { taskId, workingDir } = parseResult.data;

    // Check task exists
    const task = await db.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return errorResponse("Task not found", 404);
    }

    // Only allow verification for certain statuses
    const allowedStatuses: TaskStatus[] = [
      TaskStatus.IN_PROGRESS,
      TaskStatus.VERIFYING,
      TaskStatus.FAILED,
    ];

    if (!allowedStatuses.includes(task.status)) {
      return errorResponse(
        `Cannot verify task with status ${task.status}. Allowed: ${allowedStatuses.join(", ")}`,
        409
      );
    }

    // Run verification
    const result = await verificationService.verify(taskId, workingDir);

    // Fetch updated task
    const updatedTask = await db.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        status: true,
        verificationStatus: true,
        verificationAttempts: true,
      },
    });

    return jsonResponse({
      verificationResult: result,
      task: updatedTask,
    });
  } catch (error) {
    console.error("[POST /api/verify] Error:", error);

    if (error instanceof Error) {
      return errorResponse(error.message, 400);
    }

    return errorResponse("Verification failed", 500);
  }
}
