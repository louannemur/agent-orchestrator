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
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    label: "Working",
    dotColor: "bg-emerald-500",
  },
  IDLE: {
    color: "text-zinc-400",
    bgColor: "bg-zinc-500/10",
    label: "Idle",
    dotColor: "bg-zinc-500",
  },
  PAUSED: {
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    label: "Paused",
    dotColor: "bg-blue-500",
  },
  FAILED: {
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    label: "Failed",
    dotColor: "bg-red-500",
  },
  STUCK: {
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    label: "Stuck",
    dotColor: "bg-amber-500",
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
  const defaultConfig = { color: "text-zinc-400", bgColor: "bg-zinc-500/10", label: "Unknown" };
  const config = statusConfig[agent.status] ?? defaultConfig;

  const isWorking = agent.status === "WORKING";
  const isPaused = agent.status === "PAUSED";
  const canPause = isWorking;
  const canResume = isPaused;
  const canStop = isWorking || isPaused;

  return (
    <div className="group relative rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition-all hover:border-zinc-700 hover:bg-zinc-900">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="min-w-0 flex-1">
          {/* Status Badge */}
          <div
            className={`mb-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${config.bgColor} ${config.color}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${config.dotColor} ${isWorking ? "animate-pulse" : ""}`}
            />
            {config.label}
          </div>

          {/* Agent Name */}
          <h3 className="truncate text-sm font-medium text-zinc-100">
            {truncate(agent.name, 24)}
          </h3>
        </div>

        {/* Actions Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="rounded-lg p-1.5 text-zinc-500 opacity-0 transition-all hover:bg-zinc-800 hover:text-zinc-300 group-hover:opacity-100"
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
              <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-lg border border-zinc-700 bg-zinc-800 py-1 shadow-lg">
                <Link
                  href={`/agents/${agent.id}`}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700"
                  onClick={() => setShowMenu(false)}
                >
                  <Eye className="h-4 w-4" />
                  View Details
                </Link>

                {canPause && onPause && (
                  <button
                    onClick={() => {
                      onPause(agent.id);
                      setShowMenu(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700"
                    disabled={isActing}
                  >
                    <Pause className="h-4 w-4" />
                    Pause
                  </button>
                )}

                {canResume && onResume && (
                  <button
                    onClick={() => {
                      onResume(agent.id);
                      setShowMenu(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700"
                    disabled={isActing}
                  >
                    <Play className="h-4 w-4" />
                    Resume
                  </button>
                )}

                {canStop && onStop && (
                  <button
                    onClick={() => {
                      onStop(agent.id);
                      setShowMenu(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-400 hover:bg-zinc-700"
                    disabled={isActing}
                  >
                    <Square className="h-4 w-4" />
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
            className="block truncate text-sm text-zinc-400 hover:text-zinc-300"
          >
            {truncate(agent.currentTask.title, 40)}
          </Link>
        ) : (
          <span className="text-sm text-zinc-600">No active task</span>
        )}
      </div>

      {/* Footer Stats */}
      <div className="flex items-center justify-between text-xs text-zinc-500">
        {/* Elapsed Time (if working) */}
        {isWorking && agent.startedAt && (
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span>{getElapsedTime(agent.startedAt)}</span>
          </div>
        )}

        {/* Tokens Used */}
        {!isWorking && (
          <div className="flex items-center gap-1">
            <Zap className="h-3.5 w-3.5" />
            <span>{agent.totalTokensUsed.toLocaleString()} tokens</span>
          </div>
        )}

        {/* Tasks Stats */}
        <div className="flex items-center gap-2">
          <span className="text-emerald-500">{agent.tasksCompleted} done</span>
          {agent.tasksFailed > 0 && (
            <span className="text-red-500">{agent.tasksFailed} failed</span>
          )}
        </div>
      </div>

      {/* Working Progress Indicator */}
      {isWorking && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-emerald-500/50" />
        </div>
      )}
    </div>
  );
}
