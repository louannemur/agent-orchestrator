"use client";

import { AlertTriangle, CheckCircle2, ListTodo, Zap } from "lucide-react";

import type { DashboardStats } from "@/hooks/useDashboardStats";

// ============================================================================
// Types
// ============================================================================

interface StatsCardsProps {
  stats: DashboardStats;
}

// ============================================================================
// Stat Card Component
// ============================================================================

function StatCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
              {title}
            </p>
            <span className="text-neutral-600">{icon}</span>
          </div>
          <p className="text-2xl font-semibold tracking-tight text-white">
            {value}
          </p>
          <p className="mt-3 text-xs text-neutral-500">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Stats Cards Component
// ============================================================================

export function StatsCards({ stats }: StatsCardsProps) {
  const successRate = stats.performance.successRate;
  const successRateDisplay =
    successRate !== null ? `${successRate.toFixed(1)}%` : "—";

  const todayTotal =
    stats.performance.todayCompleted + stats.performance.todayFailed;
  const todaySubtitle =
    todayTotal > 0
      ? `${stats.performance.todayCompleted} completed today`
      : "No tasks today";

  // Calculate error rate
  const errorRate =
    successRate !== null ? (100 - successRate).toFixed(2) : "0.00";

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Active Agents"
        value={stats.agents.working}
        subtitle={`${stats.agents.total} total · ${stats.agents.idle} idle`}
        icon={<Zap className="h-4 w-4" />}
      />

      <StatCard
        title="Pending Tasks"
        value={stats.tasks.queued}
        subtitle={`${stats.tasks.inProgress} in progress`}
        icon={<ListTodo className="h-4 w-4" />}
      />

      <StatCard
        title="Success Rate"
        value={successRateDisplay}
        subtitle={todaySubtitle}
        icon={<CheckCircle2 className="h-4 w-4" />}
      />

      <StatCard
        title="Error Rate"
        value={`${errorRate}%`}
        subtitle={
          stats.exceptions.unresolved === 0
            ? "Within limits"
            : `${stats.exceptions.unresolved} exceptions`
        }
        icon={<AlertTriangle className="h-4 w-4" />}
      />
    </div>
  );
}
