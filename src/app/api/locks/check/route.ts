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
// Schema
// ============================================================================

const bodySchema = z.object({
  filePaths: z.array(z.string().min(1)).min(1).max(100),
  excludeAgentId: z.string().uuid().optional(),
});

// ============================================================================
// POST /api/locks/check
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

    const { filePaths, excludeAgentId } = parseResult.data;

    // Normalize paths
    const normalizedPaths = filePaths.map((p) =>
      p.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "")
    );

    // Find all locks for these paths
    const locks = await db.fileLock.findMany({
      where: {
        filePath: { in: normalizedPaths },
      },
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

    // Build result
    const now = new Date();
    const lockedFiles: Array<{
      filePath: string;
      agentId: string;
      agentName: string | null;
      agentStatus: string;
      taskId: string | null;
      taskTitle: string | null;
      acquiredAt: Date;
      expiresAt: Date | null;
      isExpired: boolean;
    }> = [];

    const availableFiles: string[] = [];

    for (const filePath of normalizedPaths) {
      const lock = locks.find((l) => l.filePath === filePath);

      if (!lock) {
        availableFiles.push(filePath);
        continue;
      }

      // Check if lock is expired
      const isExpired = lock.expiresAt ? lock.expiresAt < now : false;
      if (isExpired) {
        availableFiles.push(filePath);
        continue;
      }

      // Check if lock is held by excluded agent
      if (excludeAgentId && lock.agentId === excludeAgentId) {
        availableFiles.push(filePath);
        continue;
      }

      lockedFiles.push({
        filePath: lock.filePath,
        agentId: lock.agentId,
        agentName: lock.agent?.name ?? null,
        agentStatus: lock.agent?.status ?? "UNKNOWN",
        taskId: lock.taskId,
        taskTitle: lock.task?.title ?? null,
        acquiredAt: lock.acquiredAt,
        expiresAt: lock.expiresAt,
        isExpired,
      });
    }

    // Summary
    const hasConflicts = lockedFiles.length > 0;

    return jsonResponse({
      hasConflicts,
      summary: {
        total: normalizedPaths.length,
        locked: lockedFiles.length,
        available: availableFiles.length,
      },
      lockedFiles,
      availableFiles,
    });
  } catch (error) {
    console.error("[POST /api/locks/check] Error:", error);
    return errorResponse("Failed to check locks", 500);
  }
}
