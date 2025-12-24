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
// Query Schema
// ============================================================================

const querySchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.coerce.number().int().min(0).max(3).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ============================================================================
// GET /api/tasks
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse and validate query params
    const queryResult = querySchema.safeParse({
      status: searchParams.get("status") ?? undefined,
      priority: searchParams.get("priority") ?? undefined,
      limit: searchParams.get("limit") ?? 50,
      offset: searchParams.get("offset") ?? 0,
    });

    if (!queryResult.success) {
      return errorResponse(
        `Invalid query parameters: ${queryResult.error.message}`,
        400
      );
    }

    const { status, priority, limit, offset } = queryResult.data;

    // Build where clause
    const where: {
      status?: TaskStatus;
      priority?: number;
    } = {};

    if (status) where.status = status;
    if (priority !== undefined) where.priority = priority;

    // Fetch tasks with count
    const [tasks, totalCount] = await Promise.all([
      db.task.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: [
          { priority: "asc" }, // Lower priority number = more urgent
          { createdAt: "asc" }, // Oldest first
        ],
        include: {
          assignedAgent: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
          _count: {
            select: {
              verificationResults: true,
              logs: true,
              exceptions: true,
            },
          },
        },
      }),
      db.task.count({ where }),
    ]);

    // Transform response
    const data = tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      riskLevel: task.riskLevel,
      status: task.status,
      verificationStatus: task.verificationStatus,
      verificationAttempts: task.verificationAttempts,
      estimatedComplexity: task.estimatedComplexity,
      filesHint: task.filesHint,
      branchName: task.branchName,
      prUrl: task.prUrl,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      completedAt: task.completedAt,
      assignedAgent: task.assignedAgent,
      counts: {
        verificationResults: task._count.verificationResults,
        logs: task._count.logs,
        exceptions: task._count.exceptions,
      },
    }));

    return jsonResponse({
      tasks: data,
      pagination: {
        limit,
        offset,
        totalCount,
        hasMore: offset + tasks.length < totalCount,
      },
    });
  } catch (error) {
    console.error("[GET /api/tasks] Error:", error);
    return errorResponse("Failed to fetch tasks", 500);
  }
}

// ============================================================================
// POST /api/tasks
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const parseResult = createTaskRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return errorResponse(
        `Invalid request body: ${parseResult.error.message}`,
        400
      );
    }

    const { title, description, priority, riskLevel, filesHint } = parseResult.data;

    // Create task
    const task = await db.task.create({
      data: {
        title,
        description,
        priority,
        riskLevel,
        filesHint,
        status: TaskStatus.QUEUED,
      },
    });

    return jsonResponse(task, 201);
  } catch (error) {
    console.error("[POST /api/tasks] Error:", error);
    return errorResponse("Failed to create task", 500);
  }
}
