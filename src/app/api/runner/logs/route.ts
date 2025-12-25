import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { LogType } from "@/types";

export const dynamic = "force-dynamic";

// ============================================================================
// Response Helpers
// ============================================================================

function jsonResponse<T>(data: T, status = 200): NextResponse<{ data: T }> {
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

const logEntrySchema = z.object({
  logType: z.nativeEnum(LogType),
  content: z.string(),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.string().optional(),
});

const logsSchema = z.object({
  runnerToken: z.string().min(1),
  agentId: z.string().uuid(),
  taskId: z.string().uuid(),
  logs: z.array(logEntrySchema).min(1).max(100),
});

// ============================================================================
// POST /api/runner/logs
// Report agent logs in batches
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = logsSchema.safeParse(body);

    if (!result.success) {
      return errorResponse(`Invalid request: ${result.error.message}`, 400);
    }

    const { runnerToken, agentId, taskId, logs } = result.data;

    // Validate runner session
    const session = await db.runnerSession.findUnique({
      where: { token: runnerToken },
    });

    if (!session || !session.isActive) {
      return errorResponse("Invalid or inactive runner session", 401);
    }

    // Verify agent belongs to this session
    const agent = await db.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      return errorResponse("Agent not found", 404);
    }

    if (agent.runnerSessionId !== session.id) {
      return errorResponse("Agent does not belong to this runner session", 403);
    }

    // Insert logs in batch
    const logRecords = logs.map((log) => ({
      agentId,
      taskId,
      logType: log.logType,
      content: log.content.slice(0, 50000), // Truncate very long content
      metadata: log.metadata ? JSON.parse(JSON.stringify(log.metadata)) : undefined,
      createdAt: log.timestamp ? new Date(log.timestamp) : new Date(),
    }));

    await db.agentLog.createMany({
      data: logRecords,
    });

    // Update agent last activity
    await db.agent.update({
      where: { id: agentId },
      data: { lastActivityAt: new Date() },
    });

    // Update session last seen
    await db.runnerSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });

    return jsonResponse({
      success: true,
      logsReceived: logs.length,
    });
  } catch (error) {
    console.error("[POST /api/runner/logs] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to process logs";
    return errorResponse(message, 500);
  }
}
