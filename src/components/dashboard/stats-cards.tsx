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
// Mini Sparkline Component
// ============================================================================

function Sparkline({ trend }: { trend: "up" | "down" | "flat" }) {
  // Simple SVG sparkline
  const paths = {
    up: "M0 20 L5 18 L10 15 L15 16 L20 12 L25 14 L30 8 L35 10 L40 5",
    down: "M0 5 L5 8 L10 6 L15 10 L20 12 L25 9 L30 15 L35 14 L40 20",
    flat: "M0 12 L5 11 L10 13 L15 12 L20 11 L25 13 L30 12 L35 11 L40 12",
  };

  return (
    <svg
      width="50"
      height="24"
      viewBox="0 0 40 24"
      fill="none"
      className="text-neutral-600"
    >
      <path
        d={paths[trend]}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

// ============================================================================
// Stat Card Component
// ============================================================================

function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend = "flat",
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "flat";
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
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-neutral-500">{subtitle}</p>
            <Sparkline trend={trend} />
          </div>
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
        trend={stats.agents.working > 0 ? "up" : "flat"}
      />

      <StatCard
        title="Pending Tasks"
        value={stats.tasks.queued}
        subtitle={`${stats.tasks.inProgress} in progress`}
        icon={<ListTodo className="h-4 w-4" />}
        trend={stats.tasks.queued > 5 ? "up" : "flat"}
      />

      <StatCard
        title="Success Rate"
        value={successRateDisplay}
        subtitle={todaySubtitle}
        icon={<CheckCircle2 className="h-4 w-4" />}
        trend={successRate && successRate > 95 ? "up" : "flat"}
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
        trend={stats.exceptions.unresolved > 0 ? "up" : "flat"}
      />
    </div>
  );
}
