"use client";

import {
  AlertCircle,
  AlertTriangle,
  Bot,
  CheckCircle,
  Clock,
  Eye,
  FileText,
  Info,
  MoreHorizontal,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type {
  ExceptionData,
  ExceptionSeverity,
  ExceptionStatus,
  ExceptionType,
} from "@/hooks/useExceptions";

// ============================================================================
// Types
// ============================================================================

interface ExceptionCardProps {
  exception: ExceptionData;
  onAcknowledge: (id: string) => void;
  onResolve: (exception: ExceptionData) => void;
  isActing?: boolean;
}

// ============================================================================
// Config
// ============================================================================

const severityConfig: Record<
  ExceptionSeverity,
  { icon: React.ReactNode; color: string; bgColor: string; borderColor: string }
> = {
  INFO: {
    icon: <Info className="h-4 w-4" />,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
  },
  WARNING: {
    icon: <AlertTriangle className="h-4 w-4" />,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
  },
  ERROR: {
    icon: <AlertCircle className="h-4 w-4" />,
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/20",
  },
  CRITICAL: {
    icon: <XCircle className="h-4 w-4" />,
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
  },
};

const statusConfig: Record<ExceptionStatus, { label: string; color: string; bgColor: string }> = {
  OPEN: { label: "Open", color: "text-red-400", bgColor: "bg-red-500/10" },
  ACKNOWLEDGED: { label: "Acknowledged", color: "text-amber-400", bgColor: "bg-amber-500/10" },
  RESOLVED: { label: "Resolved", color: "text-emerald-400", bgColor: "bg-emerald-500/10" },
  DISMISSED: { label: "Dismissed", color: "text-zinc-400", bgColor: "bg-zinc-500/10" },
};

const typeLabels: Record<ExceptionType, string> = {
  AGENT_CRASH: "Agent Crash",
  TASK_FAILURE: "Task Failure",
  VERIFICATION_FAILURE: "Verification Failed",
  FILE_CONFLICT: "File Conflict",
  RESOURCE_LIMIT: "Resource Limit",
  API_ERROR: "API Error",
  UNKNOWN: "Unknown Error",
};

// ============================================================================
// Helpers
// ============================================================================

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ============================================================================
// Exception Card Component
// ============================================================================

export function ExceptionCard({
  exception,
  onAcknowledge,
  onResolve,
  isActing = false,
}: ExceptionCardProps) {
  const [showActions, setShowActions] = useState(false);

  const defaultSeverity = { color: "text-zinc-400", bgColor: "bg-zinc-500/10", borderColor: "border-zinc-500/20", label: "Unknown" };
  const defaultStatus = { color: "text-zinc-400", bgColor: "bg-zinc-500/10", label: "Unknown" };
  const severity = severityConfig[exception.severity] ?? defaultSeverity;
  const status = statusConfig[exception.status] ?? defaultStatus;

  const isCritical = exception.severity === "CRITICAL";
  const isOpen = exception.status === "OPEN";
  const isAcknowledged = exception.status === "ACKNOWLEDGED";

  return (
    <div
      className={`group relative rounded-xl border p-4 transition-all ${
        isCritical && isOpen
          ? `${severity.borderColor} ${severity.bgColor} ring-1 ring-red-500/30`
          : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
      }`}
    >
      {/* Critical Pulse Indicator */}
      {isCritical && isOpen && (
        <div className="absolute -left-1 top-4 h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
        </div>
      )}

      <div className="flex items-start gap-4">
        {/* Severity Icon */}
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${severity.bgColor}`}>
          <span className={severity.color}>{severity.icon}</span>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Header Row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {/* Type Badge */}
              <span className="text-xs font-medium text-zinc-500">
                {typeLabels[exception.type]}
              </span>

              {/* Title */}
              <h4 className="mt-0.5 text-sm font-medium text-zinc-100">
                {exception.title}
              </h4>
            </div>

            {/* Status Badge */}
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${status.bgColor} ${status.color}`}>
              {status.label}
            </span>
          </div>

          {/* Meta Row */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
            {/* Time */}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatRelativeTime(exception.createdAt)}
            </span>

            {/* Related Agent */}
            {exception.agent && (
              <Link
                href={`/agents/${exception.agent.id}`}
                className="flex items-center gap-1 hover:text-zinc-300"
              >
                <Bot className="h-3 w-3" />
                {exception.agent.name}
              </Link>
            )}

            {/* Related Task */}
            {exception.task && (
              <Link
                href={`/tasks/${exception.task.id}`}
                className="flex items-center gap-1 hover:text-zinc-300"
              >
                <FileText className="h-3 w-3" />
                <span className="max-w-32 truncate">{exception.task.title}</span>
              </Link>
            )}
          </div>

          {/* Resolution Notes (if resolved/dismissed) */}
          {exception.resolutionNotes && (
            <div className="mt-3 rounded-lg bg-zinc-800/50 px-3 py-2">
              <p className="text-xs text-zinc-400">{exception.resolutionNotes}</p>
            </div>
          )}
        </div>

        {/* Actions Menu */}
        <div className="relative">
          <button
            onClick={() => setShowActions(!showActions)}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {showActions && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowActions(false)}
              />

              {/* Dropdown */}
              <div className="absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800 py-1 shadow-lg">
                {/* View Details */}
                <Link
                  href={`/exceptions/${exception.id}`}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700"
                  onClick={() => setShowActions(false)}
                >
                  <Eye className="h-4 w-4" />
                  View Details
                </Link>

                {/* Acknowledge (only for OPEN) */}
                {isOpen && (
                  <button
                    onClick={() => {
                      onAcknowledge(exception.id);
                      setShowActions(false);
                    }}
                    disabled={isActing}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Acknowledge
                  </button>
                )}

                {/* Resolve (for OPEN or ACKNOWLEDGED) */}
                {(isOpen || isAcknowledged) && (
                  <button
                    onClick={() => {
                      onResolve(exception);
                      setShowActions(false);
                    }}
                    disabled={isActing}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
                  >
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                    Resolve
                  </button>
                )}

                {/* Dismiss (for OPEN or ACKNOWLEDGED) */}
                {(isOpen || isAcknowledged) && (
                  <button
                    onClick={() => {
                      onResolve({ ...exception, status: "DISMISSED" });
                      setShowActions(false);
                    }}
                    disabled={isActing}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4 text-zinc-400" />
                    Dismiss
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
