import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";

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

const heartbeatSchema = z.object({
  runnerToken: z.string().min(1),
  agentId: z.string().uuid(),
  taskId: z.string().uuid().optional(),
  tokensUsed: z.number().int().optional(),
});

// ============================================================================
// POST /api/runner/heartbeat
// Report agent heartbeat to keep it alive
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = heartbeatSchema.safeParse(body);

    if (!result.success) {
      return errorResponse(`Invalid request: ${result.error.message}`, 400);
    }

    const { runnerToken, agentId, tokensUsed } = result.data;

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

    // Update agent heartbeat
    const updateData: Record<string, unknown> = {
      lastActivityAt: new Date(),
    };

    if (tokensUsed !== undefined) {
      updateData.totalTokensUsed = tokensUsed;
    }

    await db.agent.update({
      where: { id: agentId },
      data: updateData,
    });

    // Update session last seen
    await db.runnerSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });

    return jsonResponse({
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[POST /api/runner/heartbeat] Error:", error);
    return errorResponse("Failed to process heartbeat", 500);
  }
}
