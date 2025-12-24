"use client";

import {
  Calendar,
  CheckCircle2,
  Clock,
  FileCode,
  Lock,
  XCircle,
  Zap,
} from "lucide-react";
import Link from "next/link";

import type { AgentDetail } from "@/hooks/useAgent";

// ============================================================================
// Types
// ============================================================================

interface AgentStatsProps {
  agent: AgentDetail;
}

// ============================================================================
// Helpers
// ============================================================================

function formatDate(dateString: string | null): string {
  if (!dateString) return "N/A";

  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return "";

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${diffDay}d ago`;
}

// ============================================================================
// Stat Row Component
// ============================================================================

function StatRow({
  icon,
  label,
  value,
  subValue,
  color = "text-zinc-300",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  color?: string;
}) {
  return (
    <div className="flex items-start justify-between py-3">
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-right">
        <p className={`text-sm font-medium ${color}`}>{value}</p>
        {subValue && <p className="text-xs text-zinc-500">{subValue}</p>}
      </div>
    </div>
  );
}

// ============================================================================
// Agent Stats Component
// ============================================================================

export function AgentStats({ agent }: AgentStatsProps) {
  return (
    <div className="space-y-4">
      {/* Performance Stats */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h3 className="mb-3 text-sm font-medium text-zinc-100">Performance</h3>

        <div className="divide-y divide-zinc-800/50">
          <StatRow
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
            label="Tasks Completed"
            value={agent.tasksCompleted}
            color="text-emerald-400"
          />

          <StatRow
            icon={<XCircle className="h-4 w-4 text-red-500" />}
            label="Tasks Failed"
            value={agent.tasksFailed}
            color={agent.tasksFailed > 0 ? "text-red-400" : "text-zinc-400"}
          />

          <StatRow
            icon={<Zap className="h-4 w-4 text-amber-500" />}
            label="Tokens Used"
            value={agent.totalTokensUsed.toLocaleString()}
            color="text-amber-400"
          />
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h3 className="mb-3 text-sm font-medium text-zinc-100">Timeline</h3>

        <div className="divide-y divide-zinc-800/50">
          <StatRow
            icon={<Calendar className="h-4 w-4 text-zinc-500" />}
            label="Created"
            value={formatDate(agent.createdAt)}
            subValue={formatRelativeTime(agent.createdAt)}
          />

          <StatRow
            icon={<Clock className="h-4 w-4 text-zinc-500" />}
            label="Started"
            value={agent.startedAt ? formatDate(agent.startedAt) : "Not started"}
            subValue={agent.startedAt ? formatRelativeTime(agent.startedAt) : undefined}
          />

          {agent.completedAt && (
            <StatRow
              icon={<CheckCircle2 className="h-4 w-4 text-zinc-500" />}
              label="Completed"
              value={formatDate(agent.completedAt)}
              subValue={formatRelativeTime(agent.completedAt)}
            />
          )}

          <StatRow
            icon={<Clock className="h-4 w-4 text-zinc-500" />}
            label="Last Activity"
            value={
              agent.lastActivityAt
                ? formatRelativeTime(agent.lastActivityAt)
                : "No activity"
            }
          />
        </div>
      </div>

      {/* File Locks */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-zinc-100">Locked Files</h3>
          <span className="text-xs text-zinc-500">
            {agent.fileLocks.length} file{agent.fileLocks.length !== 1 ? "s" : ""}
          </span>
        </div>

        {agent.fileLocks.length === 0 ? (
          <p className="py-4 text-center text-sm text-zinc-500">
            No files currently locked
          </p>
        ) : (
          <div className="space-y-2">
            {agent.fileLocks.map((lock) => (
              <div
                key={lock.id}
                className="flex items-start gap-2 rounded-lg bg-zinc-800/50 px-3 py-2"
              >
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-zinc-300">
                    {lock.filePath.split("/").pop()}
                  </p>
                  <p className="truncate text-xs text-zinc-500">
                    {lock.filePath}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Current Task */}
      {agent.currentTask && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <h3 className="mb-3 text-sm font-medium text-zinc-100">Current Task</h3>

          <Link
            href={`/tasks/${agent.currentTask.id}`}
            className="block rounded-lg bg-zinc-800/50 p-3 transition-colors hover:bg-zinc-800"
          >
            <div className="flex items-start gap-2">
              <FileCode className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-200">
                  {agent.currentTask.title}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                  {agent.currentTask.description}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      agent.currentTask.riskLevel === "CRITICAL"
                        ? "bg-red-500/10 text-red-400"
                        : agent.currentTask.riskLevel === "HIGH"
                          ? "bg-orange-500/10 text-orange-400"
                          : agent.currentTask.riskLevel === "MEDIUM"
                            ? "bg-amber-500/10 text-amber-400"
                            : "bg-green-500/10 text-green-400"
                    }`}
                  >
                    {agent.currentTask.riskLevel}
                  </span>
                  <span className="text-xs text-zinc-500">
                    Priority {agent.currentTask.priority}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* Agent ID */}
      <div className="rounded-lg bg-zinc-800/30 px-4 py-3">
        <p className="text-xs text-zinc-500">Agent ID</p>
        <p className="mt-0.5 font-mono text-xs text-zinc-400">{agent.id}</p>
      </div>
    </div>
  );
}
