import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { createTaskRequestSchema, TaskStatus } from "@/types";

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

const batchSchema = z.object({
  tasks: z
    .array(createTaskRequestSchema)
    .min(1, "At least one task is required")
    .max(50, "Maximum 50 tasks per batch"),
});

// ============================================================================
// POST /api/tasks/batch
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const parseResult = batchSchema.safeParse(body);

    if (!parseResult.success) {
      return errorResponse(
        `Invalid request body: ${parseResult.error.message}`,
        400
      );
    }

    const { tasks: taskInputs } = parseResult.data;

    // Create all tasks in a transaction
    const createdTasks = await db.$transaction(
      taskInputs.map((taskInput) =>
        db.task.create({
          data: {
            title: taskInput.title,
            description: taskInput.description,
            priority: taskInput.priority,
            riskLevel: taskInput.riskLevel,
            filesHint: taskInput.filesHint,
            status: TaskStatus.QUEUED,
          },
        })
      )
    );

    return jsonResponse(
      {
        tasks: createdTasks,
        count: createdTasks.length,
        message: `Successfully created ${createdTasks.length} tasks`,
      },
      201
    );
  } catch (error) {
    console.error("[POST /api/tasks/batch] Error:", error);

    if (error instanceof Error) {
      return errorResponse(error.message, 400);
    }

    return errorResponse("Failed to create tasks", 500);
  }
}
