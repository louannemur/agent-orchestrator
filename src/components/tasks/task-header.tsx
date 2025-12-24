"use client";

import {
  ArrowLeft,
  Calendar,
  Clock,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  XCircle,
} from "lucide-react";
import Link from "next/link";

import type { TaskDetail } from "@/hooks/useTask";

// ============================================================================
// Types
// ============================================================================

interface TaskHeaderProps {
  task: TaskDetail;
  onRun?: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
  onAutoRetry?: () => void;
  isActing?: boolean;
}

// ============================================================================
// Status & Priority Config
// ============================================================================

const statusConfig: Record<
  string,
  { color: string; bgColor: string; label: string }
> = {
  QUEUED: {
    color: "text-amber-400",
    bgColor: "bg-amber-500/10 border-amber-500/20",
    label: "Queued",
  },
  IN_PROGRESS: {
    color: "text-blue-400",
    bgColor: "bg-blue-500/10 border-blue-500/20",
    label: "In Progress",
  },
  VERIFYING: {
    color: "text-purple-400",
    bgColor: "bg-purple-500/10 border-purple-500/20",
    label: "Verifying",
  },
  COMPLETED: {
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10 border-emerald-500/20",
    label: "Completed",
  },
  FAILED: {
    color: "text-red-400",
    bgColor: "bg-red-500/10 border-red-500/20",
    label: "Failed",
  },
  CANCELLED: {
    color: "text-zinc-400",
    bgColor: "bg-zinc-500/10 border-zinc-500/20",
    label: "Cancelled",
  },
};

const priorityConfig: Record<number, { color: string; bgColor: string; label: string }> = {
  0: { color: "text-red-400", bgColor: "bg-red-500/10", label: "Urgent" },
  1: { color: "text-orange-400", bgColor: "bg-orange-500/10", label: "High" },
  2: { color: "text-blue-400", bgColor: "bg-blue-500/10", label: "Normal" },
  3: { color: "text-zinc-400", bgColor: "bg-zinc-500/10", label: "Low" },
};

const riskConfig: Record<string, { color: string; bgColor: string }> = {
  LOW: { color: "text-green-400", bgColor: "bg-green-500/10" },
  MEDIUM: { color: "text-amber-400", bgColor: "bg-amber-500/10" },
  HIGH: { color: "text-orange-400", bgColor: "bg-orange-500/10" },
  CRITICAL: { color: "text-red-400", bgColor: "bg-red-500/10" },
};

// ============================================================================
// Helpers
// ============================================================================

function formatDate(dateString: string | null): string {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================================================
// Task Header Component
// ============================================================================

export function TaskHeader({
  task,
  onRun,
  onCancel,
  onRetry,
  onAutoRetry,
  isActing,
}: TaskHeaderProps) {
  const statusCfg = statusConfig[task.status] || statusConfig.QUEUED;
  const priorityCfg = priorityConfig[task.priority] || priorityConfig[2];
  const riskCfg = riskConfig[task.riskLevel] || riskConfig.MEDIUM;

  const canRun = task.status === "QUEUED";
  const canCancel = task.status === "QUEUED";
  const canRetry = task.status === "FAILED" || task.status === "CANCELLED";
  const canAutoRetry = task.status === "FAILED" && (task.retryCount ?? 0) < 3;

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link
          href="/tasks"
          className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Tasks
        </Link>
        <span className="text-zinc-600">/</span>
        <span className="truncate text-zinc-300">{task.title}</span>
      </div>

      {/* Main Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        {/* Left Side */}
        <div className="space-y-3">
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status */}
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${statusCfg.bgColor} ${statusCfg.color}`}
            >
              {statusCfg.label}
            </span>

            {/* Priority */}
            <span
              className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${priorityCfg.bgColor} ${priorityCfg.color}`}
            >
              {priorityCfg.label}
            </span>

            {/* Risk Level */}
            <span
              className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${riskCfg.bgColor} ${riskCfg.color}`}
            >
              {task.riskLevel} Risk
            </span>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-semibold text-zinc-100">{task.title}</h1>

          {/* Timestamps */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-500">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>Created {formatDate(task.createdAt)}</span>
            </div>
            {task.startedAt && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                <span>Started {formatDate(task.startedAt)}</span>
              </div>
            )}
            {task.completedAt && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                <span>Completed {formatDate(task.completedAt)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side - Actions */}
        <div className="flex items-center gap-2">
          {canRun && onRun && (
            <button
              onClick={onRun}
              disabled={isActing}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isActing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Run Task
            </button>
          )}

          {canRetry && onRetry && (
            <button
              onClick={onRetry}
              disabled={isActing}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isActing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Retry Task
            </button>
          )}

          {canAutoRetry && onAutoRetry && (
            <button
              onClick={onAutoRetry}
              disabled={isActing}
              className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-400 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              title={`Auto retry with supervisor strategy (${task.retryCount ?? 0}/3 attempts used)`}
            >
              {isActing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Auto Retry ({(task.retryCount ?? 0) + 1}/3)
            </button>
          )}

          {canCancel && onCancel && (
            <button
              onClick={onCancel}
              disabled={isActing}
              className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isActing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
