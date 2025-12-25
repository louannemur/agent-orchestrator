"use client";

import {
  ArrowLeft,
  Clock,
  Loader2,
  Pause,
  Play,
  Square,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { AgentDetail } from "@/hooks/useAgent";

// ============================================================================
// Types
// ============================================================================

interface AgentHeaderProps {
  agent: AgentDetail;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  isActing?: boolean;
}

// ============================================================================
// Status Config
// ============================================================================

const statusConfig: Record<
  AgentDetail["status"],
  { color: string; bgColor: string; label: string; dotColor: string }
> = {
  WORKING: {
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10 border-emerald-500/20",
    label: "Working",
    dotColor: "bg-emerald-500",
  },
  IDLE: {
    color: "text-zinc-400",
    bgColor: "bg-zinc-500/10 border-zinc-500/20",
    label: "Idle",
    dotColor: "bg-zinc-500",
  },
  PAUSED: {
    color: "text-blue-400",
    bgColor: "bg-blue-500/10 border-blue-500/20",
    label: "Paused",
    dotColor: "bg-blue-500",
  },
  FAILED: {
    color: "text-red-400",
    bgColor: "bg-red-500/10 border-red-500/20",
    label: "Failed",
    dotColor: "bg-red-500",
  },
  STUCK: {
    color: "text-amber-400",
    bgColor: "bg-amber-500/10 border-amber-500/20",
    label: "Stuck",
    dotColor: "bg-amber-500",
  },
};

// ============================================================================
// Elapsed Time Hook
// ============================================================================

function useElapsedTime(startTime: string | null): string {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    if (!startTime) {
      setElapsed("");
      return;
    }

    const updateElapsed = () => {
      const start = new Date(startTime);
      const now = new Date();
      const diffMs = now.getTime() - start.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);

      if (diffHour > 0) {
        setElapsed(`${diffHour}h ${diffMin % 60}m ${diffSec % 60}s`);
      } else if (diffMin > 0) {
        setElapsed(`${diffMin}m ${diffSec % 60}s`);
      } else {
        setElapsed(`${diffSec}s`);
      }
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  return elapsed;
}

// ============================================================================
// Agent Header Component
// ============================================================================

export function AgentHeader({
  agent,
  onPause,
  onResume,
  onStop,
  isActing,
}: AgentHeaderProps) {
  const defaultConfig = { color: "text-zinc-400", bgColor: "bg-zinc-500/10", label: "Unknown" };
  const config = statusConfig[agent.status] ?? defaultConfig;
  const elapsed = useElapsedTime(agent.startedAt);

  const isWorking = agent.status === "WORKING";
  const isPaused = agent.status === "PAUSED";
  const canPause = isWorking;
  const canResume = isPaused;
  const canStop = isWorking || isPaused;

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link
          href="/agents"
          className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Agents
        </Link>
        <span className="text-zinc-600">/</span>
        <span className="text-zinc-300">{agent.name}</span>
      </div>

      {/* Main Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {/* Left Side */}
        <div className="space-y-3">
          {/* Status Badge */}
          <div
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${config.bgColor}`}
          >
            <span
              className={`h-2 w-2 rounded-full ${config.dotColor} ${isWorking ? "animate-pulse" : ""}`}
            />
            <span className={`text-sm font-medium ${config.color}`}>
              {config.label}
            </span>
          </div>

          {/* Agent Name */}
          <h1 className="text-2xl font-semibold text-zinc-100">{agent.name}</h1>

          {/* Current Task */}
          {agent.currentTask ? (
            <div className="text-sm">
              <span className="text-zinc-500">Current task: </span>
              <Link
                href={`/tasks/${agent.currentTask.id}`}
                className="text-blue-400 hover:text-blue-300"
              >
                {agent.currentTask.title}
              </Link>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">No active task</p>
          )}

          {/* Stats Row */}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {/* Elapsed Time */}
            {isWorking && elapsed && (
              <div className="flex items-center gap-1.5 text-zinc-400">
                <Clock className="h-4 w-4 text-zinc-500" />
                <span>Running for {elapsed}</span>
              </div>
            )}

            {/* Tokens Used */}
            <div className="flex items-center gap-1.5 text-zinc-400">
              <Zap className="h-4 w-4 text-zinc-500" />
              <span>{agent.totalTokensUsed.toLocaleString()} tokens</span>
            </div>

            {/* Tasks Stats */}
            <div className="flex items-center gap-2">
              <span className="text-emerald-500">
                {agent.tasksCompleted} completed
              </span>
              {agent.tasksFailed > 0 && (
                <>
                  <span className="text-zinc-600">·</span>
                  <span className="text-red-500">
                    {agent.tasksFailed} failed
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Side - Actions */}
        <div className="flex items-center gap-2">
          {canPause && onPause && (
            <button
              onClick={onPause}
              disabled={isActing}
              className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isActing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Pause className="h-4 w-4" />
              )}
              Pause
            </button>
          )}

          {canResume && onResume && (
            <button
              onClick={onResume}
              disabled={isActing}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isActing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Resume
            </button>
          )}

          {canStop && onStop && (
            <button
              onClick={onStop}
              disabled={isActing}
              className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isActing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              Stop
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
