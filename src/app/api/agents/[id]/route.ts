import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { agentService } from "@/services/agent-service";
import { AgentStatus } from "@/types";

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

const patchSchema = z.object({
  action: z.enum(["stop", "pause", "resume"]),
});

// ============================================================================
// GET /api/agents/:id
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate params
    const parseResult = paramsSchema.safeParse({ id });
    if (!parseResult.success) {
      return errorResponse("Invalid agent ID format", 400);
    }

    // Fetch agent with related data
    const agent = await db.agent.findUnique({
      where: { id },
      include: {
        currentTask: true,
        logs: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        fileLocks: {
          select: {
            id: true,
            filePath: true,
            acquiredAt: true,
            expiresAt: true,
          },
        },
        _count: {
          select: {
            logs: true,
            exceptions: true,
          },
        },
      },
    });

    if (!agent) {
      return errorResponse("Agent not found", 404);
    }

    // Add computed statistics
    const data = {
      ...agent,
      statistics: {
        totalLogs: agent._count.logs,
        totalExceptions: agent._count.exceptions,
        isRunning: agentService.isAgentRunning(id),
        successRate:
          agent.tasksCompleted + agent.tasksFailed > 0
            ? (agent.tasksCompleted / (agent.tasksCompleted + agent.tasksFailed)) * 100
            : 0,
      },
    };

    return jsonResponse(data);
  } catch (error) {
    console.error("[GET /api/agents/:id] Error:", error);
    return errorResponse("Failed to fetch agent", 500);
  }
}

// ============================================================================
// PATCH /api/agents/:id
// ============================================================================

export async function PATCH(
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

    // Parse and validate body
    const body = await request.json();
    const bodyResult = patchSchema.safeParse(body);

    if (!bodyResult.success) {
      return errorResponse(
        `Invalid request body: ${bodyResult.error.message}`,
        400
      );
    }

    const { action } = bodyResult.data;

    // Check agent exists
    const agent = await db.agent.findUnique({
      where: { id },
    });

    if (!agent) {
      return errorResponse("Agent not found", 404);
    }

    // Execute action
    switch (action) {
      case "stop":
        if (agent.status !== AgentStatus.WORKING) {
          return errorResponse("Agent is not currently working", 409);
        }
        await agentService.stopAgent(id);
        break;

      case "pause":
        if (agent.status !== AgentStatus.WORKING) {
          return errorResponse("Agent is not currently working", 409);
        }
        await agentService.pauseAgent(id);
        break;

      case "resume":
        if (agent.status !== AgentStatus.PAUSED) {
          return errorResponse("Agent is not paused", 409);
        }
        await agentService.resumeAgent(id);
        break;
    }

    // Fetch updated agent
    const updatedAgent = await db.agent.findUnique({
      where: { id },
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

    return jsonResponse(updatedAgent);
  } catch (error) {
    console.error("[PATCH /api/agents/:id] Error:", error);

    if (error instanceof Error) {
      return errorResponse(error.message, 400);
    }

    return errorResponse("Failed to update agent", 500);
  }
}

// ============================================================================
// DELETE /api/agents/:id
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate params
    const parseResult = paramsSchema.safeParse({ id });
    if (!parseResult.success) {
      return errorResponse("Invalid agent ID format", 400);
    }

    // Check agent exists
    const agent = await db.agent.findUnique({
      where: { id },
    });

    if (!agent) {
      return errorResponse("Agent not found", 404);
    }

    // Stop agent if running
    if (agentService.isAgentRunning(id)) {
      await agentService.stopAgent(id);
    }

    // Release file locks
    await db.fileLock.deleteMany({
      where: { agentId: id },
    });

    // Update agent status (soft delete - keep for history)
    await db.agent.update({
      where: { id },
      data: {
        status: AgentStatus.COMPLETED,
        completedAt: new Date(),
        currentTaskId: null,
      },
    });

    return jsonResponse({
      message: "Agent terminated successfully",
      id,
    });
  } catch (error) {
    console.error("[DELETE /api/agents/:id] Error:", error);
    return errorResponse("Failed to delete agent", 500);
  }
}
