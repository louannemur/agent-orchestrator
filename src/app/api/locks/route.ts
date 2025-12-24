import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { ExceptionSeverity, ExceptionType } from "@/types";

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
  agentId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

const deleteSchema = z.object({
  filePath: z.string().min(1),
  reason: z.string().max(500).optional(),
});

// ============================================================================
// GET /api/locks
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse and validate query params
    const queryResult = querySchema.safeParse({
      agentId: searchParams.get("agentId") ?? undefined,
      limit: searchParams.get("limit") ?? 100,
    });

    if (!queryResult.success) {
      return errorResponse(
        `Invalid query parameters: ${queryResult.error.message}`,
        400
      );
    }

    const { agentId, limit } = queryResult.data;

    // Build where clause
    const where = agentId ? { agentId } : {};

    // Fetch locks with related data
    const locks = await db.fileLock.findMany({
      where,
      take: limit,
      orderBy: { acquiredAt: "desc" },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });

    // Check for expired locks and mark them
    const now = new Date();
    const locksWithExpiry = locks.map((lock) => ({
      ...lock,
      isExpired: lock.expiresAt ? lock.expiresAt < now : false,
    }));

    // Get total count
    const totalCount = await db.fileLock.count({ where });

    return jsonResponse({
      locks: locksWithExpiry,
      totalCount,
    });
  } catch (error) {
    console.error("[GET /api/locks] Error:", error);
    return errorResponse("Failed to fetch locks", 500);
  }
}

// ============================================================================
// DELETE /api/locks (Force Release)
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const parseResult = deleteSchema.safeParse(body);

    if (!parseResult.success) {
      return errorResponse(
        `Invalid request body: ${parseResult.error.message}`,
        400
      );
    }

    const { filePath, reason } = parseResult.data;

    // Find the lock
    const lock = await db.fileLock.findUnique({
      where: { filePath },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!lock) {
      return errorResponse("Lock not found", 404);
    }

    // Create exception noting the force release
    await db.exception.create({
      data: {
        exceptionType: ExceptionType.CONFLICT_DETECTED,
        agentId: lock.agentId,
        taskId: lock.taskId ?? undefined,
        severity: ExceptionSeverity.INFO,
        title: "File lock force released",
        description:
          `Lock on "${filePath}" was forcibly released by admin.\n` +
          `Previously held by: ${lock.agent?.name ?? lock.agentId}\n` +
          (lock.task ? `For task: ${lock.task.title}\n` : "") +
          (reason ? `Reason: ${reason}` : ""),
      },
    });

    // Delete the lock
    await db.fileLock.delete({
      where: { filePath },
    });

    return jsonResponse({
      message: "Lock forcibly released",
      filePath,
      previousHolder: {
        agentId: lock.agentId,
        agentName: lock.agent?.name,
        taskId: lock.taskId,
        taskTitle: lock.task?.title,
      },
    });
  } catch (error) {
    console.error("[DELETE /api/locks] Error:", error);
    return errorResponse("Failed to release lock", 500);
  }
}
