import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";

import { db } from "@/lib/db";
import { AgentStatus, TaskStatus } from "@/types";

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

const getStatusSchema = z.object({
  runnerToken: z.string().min(1),
});

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  workingDir: z.string().min(1),
});

const updateStatusSchema = z.object({
  runnerToken: z.string().min(1),
  agentId: z.string().uuid(),
  status: z.nativeEnum(AgentStatus),
});

// ============================================================================
// GET /api/runner/status
// Get runner status and available tasks
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const runnerToken = searchParams.get("runnerToken");

    if (!runnerToken) {
      return errorResponse("runnerToken is required", 400);
    }

    const result = getStatusSchema.safeParse({ runnerToken });

    if (!result.success) {
      return errorResponse(`Invalid request: ${result.error.message}`, 400);
    }

    // Validate runner session
    const session = await db.runnerSession.findUnique({
      where: { token: runnerToken },
      include: {
        agents: {
          where: {
            status: AgentStatus.WORKING,
          },
          include: {
            currentTask: true,
          },
        },
      },
    });

    if (!session || !session.isActive) {
      return errorResponse("Invalid or inactive runner session", 401);
    }

    // Update session last seen
    await db.runnerSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });

    // Get available tasks count
    const availableTasksCount = await db.task.count({
      where: {
        status: TaskStatus.QUEUED,
      },
    });

    // Get next available task preview
    const nextTask = await db.task.findFirst({
      where: {
        status: TaskStatus.QUEUED,
      },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        priority: true,
        riskLevel: true,
      },
    });

    return jsonResponse({
      session: {
        id: session.id,
        name: session.name,
        workingDir: session.workingDir,
        isActive: session.isActive,
        lastSeenAt: session.lastSeenAt.toISOString(),
      },
      activeAgents: session.agents.map((agent) => ({
        id: agent.id,
        status: agent.status,
        currentTask: agent.currentTask
          ? {
              id: agent.currentTask.id,
              title: agent.currentTask.title,
            }
          : null,
      })),
      availableTasks: {
        count: availableTasksCount,
        next: nextTask,
      },
    });
  } catch (error) {
    console.error("[GET /api/runner/status] Error:", error);
    return errorResponse("Failed to get status", 500);
  }
}

// ============================================================================
// POST /api/runner/status
// Register a new runner session or update agent status
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Check if this is a registration request
    if (body.name && !body.runnerToken) {
      const result = registerSchema.safeParse(body);

      if (!result.success) {
        return errorResponse(`Invalid request: ${result.error.message}`, 400);
      }

      const { name, workingDir } = result.data;

      // Generate a unique token
      const token = randomBytes(32).toString("hex");

      // Create the session
      const session = await db.runnerSession.create({
        data: {
          token,
          name,
          workingDir,
          isActive: true,
          lastSeenAt: new Date(),
        },
      });

      return jsonResponse({
        session: {
          id: session.id,
          token: session.token,
          name: session.name,
          workingDir: session.workingDir,
        },
      });
    }

    // Otherwise, this is a status update
    const result = updateStatusSchema.safeParse(body);

    if (!result.success) {
      return errorResponse(`Invalid request: ${result.error.message}`, 400);
    }

    const { runnerToken, agentId, status } = result.data;

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

    // Update agent status
    await db.agent.update({
      where: { id: agentId },
      data: {
        status,
        lastActivityAt: new Date(),
      },
    });

    // Update session last seen
    await db.runnerSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });

    return jsonResponse({
      success: true,
      agentId,
      status,
    });
  } catch (error) {
    console.error("[POST /api/runner/status] Error:", error);
    return errorResponse("Failed to update status", 500);
  }
}
