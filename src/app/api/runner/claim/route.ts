import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

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

const claimSchema = z.object({
  runnerToken: z.string().min(1),
  taskId: z.string().uuid().optional(),
  workingDir: z.string().min(1),
});

// ============================================================================
// POST /api/runner/claim
// Claim a task for local execution
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = claimSchema.safeParse(body);

    if (!result.success) {
      return errorResponse(`Invalid request: ${result.error.message}`, 400);
    }

    const { runnerToken, taskId, workingDir } = result.data;

    // Validate runner session
    const session = await db.runnerSession.findUnique({
      where: { token: runnerToken },
    });

    if (!session || !session.isActive) {
      return errorResponse("Invalid or inactive runner session", 401);
    }

    // Update session last seen
    await db.runnerSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });

    // Find a task to claim
    let task;

    if (taskId) {
      // Claim a specific task
      task = await db.task.findUnique({
        where: { id: taskId },
      });

      if (!task) {
        return errorResponse("Task not found", 404);
      }

      if (task.status !== TaskStatus.QUEUED && task.status !== TaskStatus.FAILED) {
        return errorResponse(
          `Task is not claimable. Current status: ${task.status}`,
          400
        );
      }
    } else {
      // Find the highest priority queued task
      task = await db.task.findFirst({
        where: {
          status: TaskStatus.QUEUED,
        },
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      });

      if (!task) {
        return jsonResponse({ task: null, agent: null, message: "No tasks available" });
      }
    }

    // Create an agent for this task
    const branchName = `agent/${task.id.slice(0, 8)}`;

    const agent = await db.agent.create({
      data: {
        name: `Local: ${task.title.slice(0, 50)}`,
        status: AgentStatus.WORKING,
        currentTaskId: task.id,
        branchName,
        isLocalRunner: true,
        runnerSessionId: session.id,
        startedAt: new Date(),
        lastActivityAt: new Date(),
      },
    });

    // Update the task
    await db.task.update({
      where: { id: task.id },
      data: {
        status: TaskStatus.IN_PROGRESS,
        assignedAgentId: agent.id,
        assignedAt: new Date(),
        branchName,
      },
    });

    // Update session working directory
    await db.runnerSession.update({
      where: { id: session.id },
      data: { workingDir },
    });

    return jsonResponse({
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        riskLevel: task.riskLevel,
        filesHint: task.filesHint,
      },
      agent: {
        id: agent.id,
        branchName: agent.branchName,
      },
      workingDir,
    });
  } catch (error) {
    console.error("[POST /api/runner/claim] Error:", error);
    return errorResponse("Failed to claim task", 500);
  }
}
