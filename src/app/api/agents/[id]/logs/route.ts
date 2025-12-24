import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { LogType } from "@/types";

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

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  before: z.string().datetime().optional(),
  type: z.nativeEnum(LogType).optional(),
});

// ============================================================================
// GET /api/agents/:id/logs
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate params
    const paramsResult = paramsSchema.safeParse({ id });
    if (!paramsResult.success) {
      return errorResponse("Invalid agent ID format", 400);
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const queryResult = querySchema.safeParse({
      limit: searchParams.get("limit") ?? 100,
      before: searchParams.get("before") ?? undefined,
      type: searchParams.get("type") ?? undefined,
    });

    if (!queryResult.success) {
      return errorResponse(
        `Invalid query parameters: ${queryResult.error.message}`,
        400
      );
    }

    const { limit, before, type } = queryResult.data;

    // Check agent exists
    const agent = await db.agent.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!agent) {
      return errorResponse("Agent not found", 404);
    }

    // Build where clause
    const where: {
      agentId: string;
      createdAt?: { lt: Date };
      logType?: LogType;
    } = { agentId: id };

    if (before) {
      where.createdAt = { lt: new Date(before) };
    }

    if (type) {
      where.logType = type;
    }

    // Fetch logs
    const logs = await db.agentLog.findMany({
      where,
      take: limit + 1, // Fetch one extra to check if there are more
      orderBy: { createdAt: "desc" },
      include: {
        task: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // Check if there are more results
    const hasMore = logs.length > limit;
    const resultLogs = hasMore ? logs.slice(0, limit) : logs;

    // Get cursor for next page
    const nextCursor = hasMore && resultLogs.length > 0
      ? resultLogs[resultLogs.length - 1]!.createdAt.toISOString()
      : null;

    // Get total count for this agent
    const totalCount = await db.agentLog.count({
      where: { agentId: id },
    });

    return jsonResponse({
      logs: resultLogs,
      pagination: {
        limit,
        hasMore,
        nextCursor,
        totalCount,
      },
    });
  } catch (error) {
    console.error("[GET /api/agents/:id/logs] Error:", error);
    return errorResponse("Failed to fetch logs", 500);
  }
}
