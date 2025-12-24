import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { agentService } from "@/services/agent-service";
import { AgentStatus, spawnAgentRequestSchema } from "@/types";

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
  status: z.nativeEnum(AgentStatus).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ============================================================================
// GET /api/agents
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse and validate query params
    const queryResult = querySchema.safeParse({
      status: searchParams.get("status") ?? undefined,
      limit: searchParams.get("limit") ?? 50,
    });

    if (!queryResult.success) {
      return errorResponse(
        `Invalid query parameters: ${queryResult.error.message}`,
        400
      );
    }

    const { status, limit } = queryResult.data;

    // Build query
    const where = status ? { status } : {};

    // Fetch agents with aggregated data
    const agents = await db.agent.findMany({
      where,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        currentTask: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        _count: {
          select: {
            logs: true,
            fileLocks: true,
          },
        },
      },
    });

    // Transform response
    const data = agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      status: agent.status,
      branchName: agent.branchName,
      totalTokensUsed: agent.totalTokensUsed,
      tasksCompleted: agent.tasksCompleted,
      tasksFailed: agent.tasksFailed,
      lastActivityAt: agent.lastActivityAt,
      startedAt: agent.startedAt,
      completedAt: agent.completedAt,
      createdAt: agent.createdAt,
      currentTask: agent.currentTask,
      logCount: agent._count.logs,
      fileLockCount: agent._count.fileLocks,
    }));

    return jsonResponse(data);
  } catch (error) {
    console.error("[GET /api/agents] Error:", error);
    return errorResponse("Failed to fetch agents", 500);
  }
}

// ============================================================================
// POST /api/agents
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const parseResult = spawnAgentRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return errorResponse(
        `Invalid request body: ${parseResult.error.message}`,
        400
      );
    }

    const { taskId, workingDir } = parseResult.data;

    // Spawn agent
    const agentId = await agentService.spawnAgent(taskId, workingDir);

    // Fetch created agent
    const agent = await db.agent.findUnique({
      where: { id: agentId },
      include: {
        currentTask: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });

    return jsonResponse(agent, 201);
  } catch (error) {
    console.error("[POST /api/agents] Error:", error);

    if (error instanceof Error) {
      // Handle known errors
      if (error.message.includes("not found")) {
        return errorResponse(error.message, 404);
      }
      if (error.message.includes("not in a spawnable state")) {
        return errorResponse(error.message, 409);
      }
      if (error.message.includes("already assigned")) {
        return errorResponse(error.message, 409);
      }
      return errorResponse(error.message, 400);
    }

    return errorResponse("Failed to spawn agent", 500);
  }
}
