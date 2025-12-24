import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";

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
  taskId: z.string().uuid(),
});

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// ============================================================================
// GET /api/verify/:taskId
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;

    // Validate params
    const paramsResult = paramsSchema.safeParse({ taskId });
    if (!paramsResult.success) {
      return errorResponse("Invalid task ID format", 400);
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const queryResult = querySchema.safeParse({
      limit: searchParams.get("limit") ?? 10,
    });

    if (!queryResult.success) {
      return errorResponse(
        `Invalid query parameters: ${queryResult.error.message}`,
        400
      );
    }

    const { limit } = queryResult.data;

    // Check task exists
    const task = await db.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        status: true,
        verificationStatus: true,
        verificationAttempts: true,
      },
    });

    if (!task) {
      return errorResponse("Task not found", 404);
    }

    // Fetch verification results
    const results = await db.verificationResult.findMany({
      where: { taskId },
      take: limit,
      orderBy: { attemptNumber: "desc" },
    });

    // Calculate summary stats
    const totalAttempts = results.length;
    const passedCount = results.filter((r) => r.passed).length;
    const latestResult = results[0] ?? null;

    return jsonResponse({
      task,
      results,
      summary: {
        totalAttempts,
        passedCount,
        failedCount: totalAttempts - passedCount,
        latestPassed: latestResult?.passed ?? null,
        latestConfidence: latestResult?.confidenceScore ?? null,
      },
    });
  } catch (error) {
    console.error("[GET /api/verify/:taskId] Error:", error);
    return errorResponse("Failed to fetch verification results", 500);
  }
}
