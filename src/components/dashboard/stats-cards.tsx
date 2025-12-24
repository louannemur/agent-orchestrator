"use client";

import { AlertTriangle, Bot, CheckCircle2, ListTodo } from "lucide-react";

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
  color,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  color: "blue" | "amber" | "emerald" | "red";
}) {
  const colorStyles = {
    blue: {
      bg: "bg-blue-500/10",
      icon: "text-blue-500",
      border: "border-blue-500/20",
    },
    amber: {
      bg: "bg-amber-500/10",
      icon: "text-amber-500",
      border: "border-amber-500/20",
    },
    emerald: {
      bg: "bg-emerald-500/10",
      icon: "text-emerald-500",
      border: "border-emerald-500/20",
    },
    red: {
      bg: "bg-red-500/10",
      icon: "text-red-500",
      border: "border-red-500/20",
    },
  };

  const styles = colorStyles[color];

  return (
    <div className={`rounded-xl border ${styles.border} bg-zinc-900/50 p-5`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-zinc-400">{title}</p>
          <p className="text-3xl font-bold tracking-tight text-zinc-100">
            {value}
          </p>
          <p className="text-xs text-zinc-500">{subtitle}</p>
        </div>
        <div className={`rounded-lg p-2.5 ${styles.bg}`}>
          <div className={styles.icon}>{icon}</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Exception Severity Badge
// ============================================================================

function SeverityBadge({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: "red" | "orange" | "yellow" | "blue";
}) {
  const colorStyles = {
    red: "bg-red-500/20 text-red-400",
    orange: "bg-orange-500/20 text-orange-400",
    yellow: "bg-yellow-500/20 text-yellow-400",
    blue: "bg-blue-500/20 text-blue-400",
  };

  if (count === 0) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${colorStyles[color]}`}
    >
      {count} {label}
    </span>
  );
}

// ============================================================================
// Stats Cards Component
// ============================================================================

export function StatsCards({ stats }: StatsCardsProps) {
  const successRate = stats.performance.successRate;
  const successRateDisplay =
    successRate !== null ? `${successRate.toFixed(0)}%` : "N/A";

  const todayTotal =
    stats.performance.todayCompleted + stats.performance.todayFailed;
  const todaySubtitle =
    todayTotal > 0 ? `${stats.performance.todayCompleted} completed today` : "no tasks today";

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Active Agents"
        value={stats.agents.working}
        subtitle={`${stats.agents.total} total, ${stats.agents.idle} idle`}
        icon={<Bot className="h-5 w-5" />}
        color="blue"
      />

      <StatCard
        title="Queued Tasks"
        value={stats.tasks.queued}
        subtitle={`${stats.tasks.inProgress} in progress`}
        icon={<ListTodo className="h-5 w-5" />}
        color="amber"
      />

      <StatCard
        title="Success Rate"
        value={successRateDisplay}
        subtitle={todaySubtitle}
        icon={<CheckCircle2 className="h-5 w-5" />}
        color="emerald"
      />

      <div className="rounded-xl border border-red-500/20 bg-zinc-900/50 p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-400">Open Exceptions</p>
            <p className="text-3xl font-bold tracking-tight text-zinc-100">
              {stats.exceptions.unresolved}
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <SeverityBadge
                label="critical"
                count={stats.exceptions.bySeverity?.critical ?? 0}
                color="red"
              />
              <SeverityBadge
                label="error"
                count={stats.exceptions.bySeverity?.error ?? 0}
                color="orange"
              />
              <SeverityBadge
                label="warning"
                count={stats.exceptions.bySeverity?.warning ?? 0}
                color="yellow"
              />
            </div>
          </div>
          <div className="rounded-lg bg-red-500/10 p-2.5">
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
        </div>
      </div>
    </div>
  );
}
