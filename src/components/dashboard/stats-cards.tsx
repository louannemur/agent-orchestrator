"use client";

import { AlertTriangle, CheckCircle2, ListTodo, Sparkles } from "lucide-react";

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
  accentColor,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  accentColor: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white/[0.02] p-5 transition-all duration-300 hover:bg-white/[0.04]">
      {/* Subtle gradient overlay */}
      <div
        className={`absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${accentColor}`}
      />

      {/* Border */}
      <div className="absolute inset-0 rounded-2xl border border-white/[0.06] transition-colors duration-300 group-hover:border-white/[0.1]" />

      <div className="relative flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            {title}
          </p>
          <p className="text-3xl font-semibold tracking-tight text-white">
            {value}
          </p>
          <p className="text-[13px] text-zinc-500">{subtitle}</p>
        </div>
        <div className="rounded-xl bg-white/[0.04] p-2.5 text-zinc-400">
          {icon}
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
  color: "red" | "orange" | "yellow";
}) {
  const colorStyles = {
    red: "bg-red-500/10 text-red-400 border-red-500/20",
    orange: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    yellow: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  };

  if (count === 0) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${colorStyles[color]}`}
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
    successRate !== null ? `${successRate.toFixed(0)}%` : "—";

  const todayTotal =
    stats.performance.todayCompleted + stats.performance.todayFailed;
  const todaySubtitle =
    todayTotal > 0
      ? `${stats.performance.todayCompleted} completed today`
      : "No tasks today";

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Active Agents"
        value={stats.agents.working}
        subtitle={`${stats.agents.total} total · ${stats.agents.idle} idle`}
        icon={<Sparkles className="h-5 w-5" />}
        accentColor="bg-gradient-to-br from-accent-500/5 to-transparent"
      />

      <StatCard
        title="Queued Tasks"
        value={stats.tasks.queued}
        subtitle={`${stats.tasks.inProgress} in progress`}
        icon={<ListTodo className="h-5 w-5" />}
        accentColor="bg-gradient-to-br from-amber-500/5 to-transparent"
      />

      <StatCard
        title="Success Rate"
        value={successRateDisplay}
        subtitle={todaySubtitle}
        icon={<CheckCircle2 className="h-5 w-5" />}
        accentColor="bg-gradient-to-br from-emerald-500/5 to-transparent"
      />

      {/* Exceptions Card - Special styling */}
      <div className="group relative overflow-hidden rounded-2xl bg-white/[0.02] p-5 transition-all duration-300 hover:bg-white/[0.04]">
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="absolute inset-0 rounded-2xl border border-white/[0.06] transition-colors duration-300 group-hover:border-white/[0.1]" />

        <div className="relative flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Open Exceptions
            </p>
            <p className="text-3xl font-semibold tracking-tight text-white">
              {stats.exceptions.unresolved}
            </p>
            <div className="flex flex-wrap gap-1.5">
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
              {stats.exceptions.unresolved === 0 && (
                <span className="text-[13px] text-zinc-500">All clear</span>
              )}
            </div>
          </div>
          <div className="rounded-xl bg-white/[0.04] p-2.5 text-zinc-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>
      </div>
    </div>
  );
}
