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
    <div className="rounded-lg border border-neutral-800 bg-black p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-neutral-500">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
          <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>
        </div>
        <div className="text-neutral-600">{icon}</div>
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
    successRate !== null ? `${successRate.toFixed(0)}%` : "—";

  const todayTotal =
    stats.performance.todayCompleted + stats.performance.todayFailed;
  const todaySubtitle =
    todayTotal > 0
      ? `${stats.performance.todayCompleted} completed today`
      : "No tasks today";

  const exceptionsSubtitle =
    stats.exceptions.unresolved === 0
      ? "All clear"
      : `${stats.exceptions.bySeverity?.critical ?? 0} critical`;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Active Agents"
        value={stats.agents.working}
        subtitle={`${stats.agents.total} total · ${stats.agents.idle} idle`}
        icon={<Zap className="h-5 w-5" />}
      />

      <StatCard
        title="Queued Tasks"
        value={stats.tasks.queued}
        subtitle={`${stats.tasks.inProgress} in progress`}
        icon={<ListTodo className="h-5 w-5" />}
      />

      <StatCard
        title="Success Rate"
        value={successRateDisplay}
        subtitle={todaySubtitle}
        icon={<CheckCircle2 className="h-5 w-5" />}
      />

      <StatCard
        title="Open Exceptions"
        value={stats.exceptions.unresolved}
        subtitle={exceptionsSubtitle}
        icon={<AlertTriangle className="h-5 w-5" />}
      />
    </div>
  );
}
