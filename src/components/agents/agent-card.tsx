"use client";

import {
  Clock,
  Eye,
  MoreVertical,
  Pause,
  Play,
  Square,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { AgentData, AgentStatusType } from "@/hooks/useAgents";

// ============================================================================
// Types
// ============================================================================

interface AgentCardProps {
  agent: AgentData;
  onPause?: (agentId: string) => void;
  onResume?: (agentId: string) => void;
  onStop?: (agentId: string) => void;
  isActing?: boolean;
}

// ============================================================================
// Status Config
// ============================================================================

const statusConfig: Record<
  AgentStatusType,
  { color: string; bgColor: string; label: string; dotColor: string }
> = {
  WORKING: {
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10 border-emerald-500/20",
    label: "Working",
    dotColor: "bg-emerald-400",
  },
  IDLE: {
    color: "text-zinc-400",
    bgColor: "bg-zinc-500/10 border-zinc-500/20",
    label: "Idle",
    dotColor: "bg-zinc-400",
  },
  PAUSED: {
    color: "text-accent-400",
    bgColor: "bg-accent-500/10 border-accent-500/20",
    label: "Paused",
    dotColor: "bg-accent-400",
  },
  FAILED: {
    color: "text-red-400",
    bgColor: "bg-red-500/10 border-red-500/20",
    label: "Failed",
    dotColor: "bg-red-400",
  },
  STUCK: {
    color: "text-amber-400",
    bgColor: "bg-amber-500/10 border-amber-500/20",
    label: "Stuck",
    dotColor: "bg-amber-400",
  },
};

// ============================================================================
// Helpers
// ============================================================================

function getElapsedTime(startTime: string | null): string {
  if (!startTime) return "";

  const start = new Date(startTime);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffHour > 0) {
    return `${diffHour}h ${diffMin % 60}m`;
  }
  if (diffMin > 0) {
    return `${diffMin}m ${diffSec % 60}s`;
  }
  return `${diffSec}s`;
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + "…";
}

// ============================================================================
// Agent Card Component
// ============================================================================

export function AgentCard({
  agent,
  onPause,
  onResume,
  onStop,
  isActing,
}: AgentCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const defaultConfig = {
    color: "text-zinc-400",
    bgColor: "bg-zinc-500/10 border-zinc-500/20",
    label: "Unknown",
    dotColor: "bg-zinc-400",
  };
  const config = statusConfig[agent.status] ?? defaultConfig;

  const isWorking = agent.status === "WORKING";
  const isPaused = agent.status === "PAUSED";
  const canPause = isWorking;
  const canResume = isPaused;
  const canStop = isWorking || isPaused;

  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white/[0.02] transition-all duration-300 hover:bg-white/[0.04]">
      {/* Border */}
      <div className="absolute inset-0 rounded-2xl border border-white/[0.06] transition-colors duration-300 group-hover:border-white/[0.1]" />

      {/* Working glow effect */}
      {isWorking && (
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent" />
      )}

      <div className="relative p-4">
        {/* Header */}
        <div className="mb-3 flex items-start justify-between">
          <div className="min-w-0 flex-1">
            {/* Status Badge */}
            <div
              className={`mb-2 inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium ${config.bgColor} ${config.color}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${config.dotColor} ${isWorking ? "status-dot-pulse" : ""}`}
              />
              {config.label}
            </div>

            {/* Agent Name */}
            <h3 className="truncate text-[13px] font-medium text-white">
              {truncate(agent.name, 24)}
            </h3>
          </div>

          {/* Actions Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="rounded-lg p-1.5 text-zinc-500 opacity-0 transition-all duration-150 hover:bg-white/[0.06] hover:text-zinc-300 group-hover:opacity-100"
              disabled={isActing}
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full z-20 mt-1 w-36 animate-scale-in overflow-hidden rounded-xl border border-white/[0.08] bg-surface-900 py-1 shadow-xl">
                  <Link
                    href={`/agents/${agent.id}`}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-zinc-300 transition-colors hover:bg-white/[0.06]"
                    onClick={() => setShowMenu(false)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View Details
                  </Link>

                  {canPause && onPause && (
                    <button
                      onClick={() => {
                        onPause(agent.id);
                        setShowMenu(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-zinc-300 transition-colors hover:bg-white/[0.06]"
                      disabled={isActing}
                    >
                      <Pause className="h-3.5 w-3.5" />
                      Pause
                    </button>
                  )}

                  {canResume && onResume && (
                    <button
                      onClick={() => {
                        onResume(agent.id);
                        setShowMenu(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-zinc-300 transition-colors hover:bg-white/[0.06]"
                      disabled={isActing}
                    >
                      <Play className="h-3.5 w-3.5" />
                      Resume
                    </button>
                  )}

                  {canStop && onStop && (
                    <button
                      onClick={() => {
                        onStop(agent.id);
                        setShowMenu(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-red-400 transition-colors hover:bg-white/[0.06]"
                      disabled={isActing}
                    >
                      <Square className="h-3.5 w-3.5" />
                      Stop
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Current Task */}
        <div className="mb-3">
          {agent.currentTask ? (
            <Link
              href={`/tasks/${agent.currentTask.id}`}
              className="block truncate text-[13px] text-zinc-400 transition-colors hover:text-zinc-200"
            >
              {truncate(agent.currentTask.title, 40)}
            </Link>
          ) : (
            <span className="text-[13px] text-zinc-600">No active task</span>
          )}
        </div>

        {/* Footer Stats */}
        <div className="flex items-center justify-between text-[11px] text-zinc-500">
          {/* Elapsed Time (if working) */}
          {isWorking && agent.startedAt && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{getElapsedTime(agent.startedAt)}</span>
            </div>
          )}

          {/* Tokens Used */}
          {!isWorking && (
            <div className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              <span>{agent.totalTokensUsed.toLocaleString()} tokens</span>
            </div>
          )}

          {/* Tasks Stats */}
          <div className="flex items-center gap-2">
            <span className="text-emerald-400">{agent.tasksCompleted} done</span>
            {agent.tasksFailed > 0 && (
              <span className="text-red-400">{agent.tasksFailed} failed</span>
            )}
          </div>
        </div>

        {/* Working Progress Indicator */}
        {isWorking && (
          <div className="mt-3 h-0.5 overflow-hidden rounded-full bg-white/[0.04]">
            <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-emerald-500/50 to-emerald-400/50 shimmer" />
          </div>
        )}
      </div>
    </div>
  );
}
