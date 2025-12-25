"use client";

import { Bot } from "lucide-react";
import Link from "next/link";

import type { AgentStatus, DashboardStats } from "@/hooks/useDashboardStats";

// ============================================================================
// Types
// ============================================================================

interface AgentOverviewProps {
  agents: AgentStatus[];
  stats: DashboardStats;
}

// ============================================================================
// Status Config
// ============================================================================

const statusConfig: Record<
  AgentStatus["status"],
  { color: string; bgColor: string; label: string }
> = {
  WORKING: {
    color: "bg-emerald-500",
    bgColor: "bg-emerald-500/20",
    label: "Working",
  },
  IDLE: {
    color: "bg-zinc-500",
    bgColor: "bg-zinc-500/20",
    label: "Idle",
  },
  PAUSED: {
    color: "bg-blue-500",
    bgColor: "bg-blue-500/20",
    label: "Paused",
  },
  FAILED: {
    color: "bg-red-500",
    bgColor: "bg-red-500/20",
    label: "Failed",
  },
  STUCK: {
    color: "bg-amber-500",
    bgColor: "bg-amber-500/20",
    label: "Stuck",
  },
};

// ============================================================================
// Agent Dot Component
// ============================================================================

function AgentDot({ agent }: { agent: AgentStatus }) {
  const defaultConfig = { color: "bg-zinc-400", bgColor: "bg-zinc-500/10", label: "Unknown" };
  const config = statusConfig[agent.status] ?? defaultConfig;

  return (
    <Link
      href={`/agents/${agent.id}`}
      className="group relative"
      title={`${agent.name} - ${config.label}`}
    >
      <div
        className={`h-8 w-8 rounded-lg ${config.bgColor} flex items-center justify-center transition-transform group-hover:scale-110`}
      >
        <div className={`h-2.5 w-2.5 rounded-full ${config.color}`} />
      </div>

      {/* Tooltip */}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100">
        <div className="whitespace-nowrap rounded-lg bg-zinc-800 px-3 py-2 text-xs shadow-lg">
          <p className="font-medium text-zinc-100">{agent.name}</p>
          <p className="text-zinc-400">{config.label}</p>
          {agent.currentTaskTitle && (
            <p className="mt-1 max-w-[200px] truncate text-zinc-500">
              {agent.currentTaskTitle}
            </p>
          )}
        </div>
        <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-zinc-800" />
      </div>
    </Link>
  );
}

// ============================================================================
// Status Count Component
// ============================================================================

function StatusCount({
  status,
  count,
}: {
  status: AgentStatus["status"];
  count: number;
}) {
  const defaultConfig = { color: "bg-zinc-400", bgColor: "bg-zinc-500/10", label: "Unknown" };
  const config = statusConfig[status] ?? defaultConfig;

  return (
    <div className="flex items-center gap-2">
      <div className={`h-2 w-2 rounded-full ${config.color}`} />
      <span className="text-sm text-zinc-400">{config.label}</span>
      <span className="text-sm font-medium text-zinc-200">{count}</span>
    </div>
  );
}

// ============================================================================
// Agent Overview Component
// ============================================================================

export function AgentOverview({ agents, stats }: AgentOverviewProps) {
  if (agents.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-medium text-zinc-100">Agent Overview</h3>
          <Link
            href="/agents"
            className="text-xs text-zinc-400 hover:text-zinc-200"
          >
            View all
          </Link>
        </div>

        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Bot className="h-10 w-10 text-zinc-700" />
          <p className="mt-3 text-sm text-zinc-500">No agents spawned</p>
          <Link
            href="/agents"
            className="mt-2 text-xs text-blue-500 hover:text-blue-400"
          >
            Spawn an agent
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-100">Agent Overview</h3>
        <Link
          href="/agents"
          className="text-xs text-zinc-400 hover:text-zinc-200"
        >
          View all
        </Link>
      </div>

      {/* Agent Grid */}
      <div className="mb-5 flex flex-wrap gap-2">
        {agents.map((agent) => (
          <AgentDot key={agent.id} agent={agent} />
        ))}
      </div>

      {/* Status Counts */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-zinc-800 pt-4">
        <StatusCount status="WORKING" count={stats.agents.working} />
        <StatusCount status="IDLE" count={stats.agents.idle} />
        <StatusCount status="PAUSED" count={stats.agents.paused} />
        <StatusCount status="FAILED" count={stats.agents.failed} />
        {stats.agents.stuck > 0 && (
          <StatusCount status="STUCK" count={stats.agents.stuck} />
        )}
      </div>
    </div>
  );
}
