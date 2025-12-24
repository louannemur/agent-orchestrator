"use client";

import { Activity, RefreshCw, XCircle } from "lucide-react";

import {
  AgentOverview,
  RecentActivityList,
  StatsCards,
} from "@/components/dashboard";
import { MainLayout } from "@/components/layout";
import { useDashboardStats, useNotifications } from "@/hooks";

// ============================================================================
// Dashboard Page
// ============================================================================

export default function DashboardPage() {
  const { stats, recentActivity, agents, isLoading, error, refetch } =
    useDashboardStats();

  // Enable notifications for agent/task/exception changes
  useNotifications({
    agents: agents.map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      currentTaskId: a.currentTaskId,
      currentTask: a.currentTaskTitle
        ? { id: a.currentTaskId || "", title: a.currentTaskTitle, status: "" }
        : null,
      totalTokensUsed: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      createdAt: "",
      startedAt: null,
      completedAt: null,
      lastActivityAt: null,
    })),
  });

  return (
    <MainLayout title="Dashboard">
      {/* Loading State */}
      {isLoading && !stats && (
        <div className="flex h-64 items-center justify-center">
          <div className="flex items-center gap-3 text-zinc-400">
            <Activity className="h-5 w-5 animate-pulse" />
            <span>Loading dashboard...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !stats && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center">
          <XCircle className="mx-auto h-8 w-8 text-red-500" />
          <p className="mt-2 text-red-400">{error}</p>
          <button
            onClick={() => refetch()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      )}

      {/* Dashboard Content */}
      {stats && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <StatsCards stats={stats} />

          {/* Two Column Layout */}
          <div className="grid gap-6 lg:grid-cols-5">
            {/* Left: Agent Overview (2 cols) */}
            <div className="lg:col-span-2">
              <AgentOverview agents={agents} stats={stats} />
            </div>

            {/* Right: Recent Activity (3 cols) */}
            <div className="lg:col-span-3">
              <RecentActivityList activities={recentActivity} />
            </div>
          </div>

          {/* Connection indicator */}
          {error && stats && (
            <div className="flex items-center justify-center gap-2 text-xs text-amber-500">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
              <span>Connection issues - showing cached data</span>
            </div>
          )}
        </div>
      )}
    </MainLayout>
  );
}
