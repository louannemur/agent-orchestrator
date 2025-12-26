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
  { color: string; label: string; dotColor: string }
> = {
  WORKING: {
    color: "text-emerald-500",
    label: "Working",
    dotColor: "bg-emerald-500",
  },
  IDLE: {
    color: "text-neutral-500",
    label: "Idle",
    dotColor: "bg-neutral-500",
  },
  PAUSED: {
    color: "text-amber-500",
    label: "Paused",
    dotColor: "bg-amber-500",
  },
  FAILED: {
    color: "text-red-500",
    label: "Failed",
    dotColor: "bg-red-500",
  },
  STUCK: {
    color: "text-orange-500",
    label: "Stuck",
    dotColor: "bg-orange-500",
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
    color: "text-neutral-500",
    label: "Unknown",
    dotColor: "bg-neutral-500",
  };
  const config = statusConfig[agent.status] ?? defaultConfig;

  const isWorking = agent.status === "WORKING";
  const isPaused = agent.status === "PAUSED";
  const canPause = isWorking;
  const canResume = isPaused;
  const canStop = isWorking || isPaused;

  return (
    <div className="rounded-lg border border-neutral-800 bg-black p-4">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="min-w-0 flex-1">
          {/* Status */}
          <div className="mb-2 flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${config.dotColor} ${
                isWorking ? "status-dot-pulse" : ""
              }`}
            />
            <span className={`text-xs font-medium ${config.color}`}>
              {config.label}
            </span>
          </div>

          {/* Agent Name */}
          <h3 className="truncate text-sm font-medium text-white">
            {truncate(agent.name, 24)}
          </h3>
        </div>

        {/* Actions Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-900 hover:text-white"
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
              <div className="absolute right-0 top-full z-20 mt-1 w-32 rounded-md border border-neutral-800 bg-neutral-900 py-1">
                <Link
                  href={`/agents/${agent.id}`}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
                  onClick={() => setShowMenu(false)}
                >
                  <Eye className="h-3.5 w-3.5" />
                  View
                </Link>

                {canPause && onPause && (
                  <button
                    onClick={() => {
                      onPause(agent.id);
                      setShowMenu(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
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
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
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
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:bg-neutral-800"
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
            className="block truncate text-sm text-neutral-400 hover:text-white"
          >
            {truncate(agent.currentTask.title, 40)}
          </Link>
        ) : (
          <span className="text-sm text-neutral-600">No active task</span>
        )}
      </div>

      {/* Footer Stats */}
      <div className="flex items-center justify-between text-xs text-neutral-500">
        {isWorking && agent.startedAt ? (
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{getElapsedTime(agent.startedAt)}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            <span>{agent.totalTokensUsed.toLocaleString()} tokens</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <span className="text-emerald-500">{agent.tasksCompleted} done</span>
          {agent.tasksFailed > 0 && (
            <span className="text-red-500">{agent.tasksFailed} failed</span>
          )}
        </div>
      </div>
    </div>
  );
}
