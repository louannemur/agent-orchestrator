import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  AgentStatus,
  ExceptionSeverity,
  ExceptionStatus,
  TaskStatus,
} from "@/types";

// ============================================================================
// Types
// ============================================================================

interface DashboardStatsResponse {
  agents: {
    total: number;
    working: number;
    idle: number;
    paused: number;
    failed: number;
    stuck: number;
  };
  tasks: {
    total: number;
    queued: number;
    inProgress: number;
    completed: number;
    failed: number;
    verifying: number;
    cancelled: number;
  };
  exceptions: {
    total: number;
    unresolved: number;
    bySeverity: {
      critical: number;
      error: number;
      warning: number;
      info: number;
    };
  };
  performance: {
    avgCompletionTime: number | null;
    successRate: number | null;
    todayCompleted: number;
    todayFailed: number;
  };
}

// ============================================================================
// GET /api/dashboard/stats
// ============================================================================

export async function GET() {
  try {
    // Get start of today in UTC
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    // Run all queries in parallel for efficiency
    const [
      agentCounts,
      totalAgents,
      taskCounts,
      totalTasks,
      exceptionCounts,
      totalExceptions,
      openExceptions,
      completedToday,
      failedToday,
      avgCompletionTime,
    ] = await Promise.all([
      // Agent counts by status
      db.agent.groupBy({
        by: ["status"],
        _count: { status: true },
      }),

      // Total agents
      db.agent.count(),

      // Task counts by status
      db.task.groupBy({
        by: ["status"],
        _count: { status: true },
      }),

      // Total tasks
      db.task.count(),

      // Exception counts by severity (open only)
      db.exception.groupBy({
        by: ["severity"],
        _count: { severity: true },
        where: { status: ExceptionStatus.OPEN },
      }),

      // Total exceptions
      db.exception.count(),

      // Open exceptions
      db.exception.count({
        where: { status: ExceptionStatus.OPEN },
      }),

      // Completed today
      db.task.count({
        where: {
          status: TaskStatus.COMPLETED,
          completedAt: { gte: startOfToday },
        },
      }),

      // Failed today
      db.task.count({
        where: {
          status: TaskStatus.FAILED,
          updatedAt: { gte: startOfToday },
        },
      }),

      // Average completion time (for completed tasks)
      db.task.aggregate({
        where: {
          status: TaskStatus.COMPLETED,
          completedAt: { not: null },
          startedAt: { not: null },
        },
        _avg: {
          // We can't do date math in Prisma aggregate, so we'll handle this differently
        },
      }),
    ]);

    // Extract agent counts
    const getAgentCount = (status: AgentStatus) =>
      agentCounts.find((g) => g.status === status)?._count.status ?? 0;

    // Extract task counts
    const getTaskCount = (status: TaskStatus) =>
      taskCounts.find((g) => g.status === status)?._count.status ?? 0;

    // Extract exception severity counts
    const getExceptionCount = (severity: ExceptionSeverity) =>
      exceptionCounts.find((g) => g.severity === severity)?._count.severity ?? 0;

    // Calculate success rate
    const completedTasks = getTaskCount(TaskStatus.COMPLETED);
    const failedTasks = getTaskCount(TaskStatus.FAILED);
    const finishedTasks = completedTasks + failedTasks;
    const successRate =
      finishedTasks > 0 ? (completedTasks / finishedTasks) * 100 : null;

    // Calculate average completion time from recent completed tasks
    let avgTime: number | null = null;
    const recentCompleted = await db.task.findMany({
      where: {
        status: TaskStatus.COMPLETED,
        completedAt: { not: null },
        startedAt: { not: null },
      },
      select: {
        startedAt: true,
        completedAt: true,
      },
      take: 100,
      orderBy: { completedAt: "desc" },
    });

    if (recentCompleted.length > 0) {
      const times = recentCompleted
        .filter((t) => t.startedAt && t.completedAt)
        .map(
          (t) =>
            new Date(t.completedAt!).getTime() - new Date(t.startedAt!).getTime()
        );

      if (times.length > 0) {
        avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      }
    }

    const stats: DashboardStatsResponse = {
      agents: {
        total: totalAgents,
        working: getAgentCount(AgentStatus.WORKING),
        idle: getAgentCount(AgentStatus.IDLE),
        paused: getAgentCount(AgentStatus.PAUSED),
        failed: getAgentCount(AgentStatus.FAILED),
        stuck: getAgentCount(AgentStatus.STUCK),
      },
      tasks: {
        total: totalTasks,
        queued: getTaskCount(TaskStatus.QUEUED),
        inProgress: getTaskCount(TaskStatus.IN_PROGRESS),
        completed: completedTasks,
        failed: failedTasks,
        verifying: getTaskCount(TaskStatus.VERIFYING),
        cancelled: getTaskCount(TaskStatus.CANCELLED),
      },
      exceptions: {
        total: totalExceptions,
        unresolved: openExceptions,
        bySeverity: {
          critical: getExceptionCount(ExceptionSeverity.CRITICAL),
          error: getExceptionCount(ExceptionSeverity.ERROR),
          warning: getExceptionCount(ExceptionSeverity.WARNING),
          info: getExceptionCount(ExceptionSeverity.INFO),
        },
      },
      performance: {
        avgCompletionTime: avgTime,
        successRate: successRate !== null ? Math.round(successRate * 10) / 10 : null,
        todayCompleted: completedToday,
        todayFailed: failedToday,
      },
    };

    return NextResponse.json(
      { data: stats },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10",
        },
      }
    );
  } catch (error) {
    console.error("[GET /api/dashboard/stats] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats", message: "Internal server error" },
      { status: 500 }
    );
  }
}
