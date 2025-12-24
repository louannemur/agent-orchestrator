"use client";

import { AlertTriangle, Bot, FileCode, Lock } from "lucide-react";
import Link from "next/link";

import type { TaskDetail } from "@/hooks/useTask";

// ============================================================================
// Types
// ============================================================================

interface TaskDescriptionProps {
  task: TaskDetail;
}

// ============================================================================
// Task Description Component
// ============================================================================

export function TaskDescription({ task }: TaskDescriptionProps) {
  return (
    <div className="space-y-4">
      {/* Description */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h3 className="mb-3 text-sm font-medium text-zinc-100">Description</h3>
        <div className="prose prose-sm prose-invert max-w-none">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
            {task.description}
          </p>
        </div>
      </div>

      {/* File Hints */}
      {task.filesHint && task.filesHint.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h3 className="mb-3 text-sm font-medium text-zinc-100">
            File Hints
          </h3>
          <div className="space-y-2">
            {task.filesHint.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 rounded-lg bg-zinc-800/50 px-3 py-2"
              >
                <FileCode className="h-4 w-4 shrink-0 text-blue-500" />
                <span className="truncate font-mono text-sm text-zinc-300">
                  {file}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* File Conflicts Warning */}
      {task.hasFileConflicts && task.lockedFilesHint && task.lockedFilesHint.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-medium text-amber-400">
              File Conflicts
            </h3>
          </div>
          <p className="mb-3 text-sm text-zinc-400">
            Some hinted files are currently locked by other agents:
          </p>
          <div className="space-y-2">
            {task.lockedFilesHint.map((lock, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-2 rounded-lg bg-zinc-800/50 px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Lock className="h-4 w-4 shrink-0 text-amber-500" />
                  <span className="truncate font-mono text-sm text-zinc-300">
                    {lock.filePath}
                  </span>
                </div>
                <Link
                  href={`/agents/${lock.agentId}`}
                  className="shrink-0 text-xs text-zinc-500 hover:text-zinc-300"
                >
                  {lock.agentName || "Unknown agent"}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assigned Agent */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h3 className="mb-3 text-sm font-medium text-zinc-100">
          Assigned Agent
        </h3>
        {task.assignedAgent ? (
          <Link
            href={`/agents/${task.assignedAgent.id}`}
            className="flex items-center gap-3 rounded-lg bg-zinc-800/50 p-3 transition-colors hover:bg-zinc-800"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Bot className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-200">
                {task.assignedAgent.name}
              </p>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span
                  className={
                    task.assignedAgent.status === "WORKING"
                      ? "text-emerald-400"
                      : task.assignedAgent.status === "FAILED"
                        ? "text-red-400"
                        : "text-zinc-400"
                  }
                >
                  {task.assignedAgent.status}
                </span>
                <span>·</span>
                <span>{task.assignedAgent.totalTokensUsed.toLocaleString()} tokens</span>
              </div>
            </div>
          </Link>
        ) : (
          <div className="flex items-center gap-3 rounded-lg bg-zinc-800/30 p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-700/50">
              <Bot className="h-5 w-5 text-zinc-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400">Unassigned</p>
              <p className="text-xs text-zinc-500">
                No agent assigned to this task
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Exceptions */}
      {task.exceptions && task.exceptions.length > 0 && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
          <h3 className="mb-3 text-sm font-medium text-red-400">
            Exceptions ({task.exceptions.length})
          </h3>
          <div className="space-y-2">
            {task.exceptions.slice(0, 5).map((exception) => (
              <Link
                key={exception.id}
                href={`/exceptions/${exception.id}`}
                className="block rounded-lg bg-zinc-800/50 p-3 transition-colors hover:bg-zinc-800"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-zinc-200">
                    {exception.title}
                  </p>
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
                      exception.severity === "CRITICAL"
                        ? "bg-red-500/10 text-red-400"
                        : exception.severity === "ERROR"
                          ? "bg-orange-500/10 text-orange-400"
                          : "bg-amber-500/10 text-amber-400"
                    }`}
                  >
                    {exception.severity}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">{exception.type}</p>
              </Link>
            ))}
            {task.exceptions.length > 5 && (
              <p className="text-center text-xs text-zinc-500">
                +{task.exceptions.length - 5} more exceptions
              </p>
            )}
          </div>
        </div>
      )}

      {/* Task ID */}
      <div className="rounded-lg bg-zinc-800/30 px-4 py-3">
        <p className="text-xs text-zinc-500">Task ID</p>
        <p className="mt-0.5 font-mono text-xs text-zinc-400">{task.id}</p>
      </div>
    </div>
  );
}
