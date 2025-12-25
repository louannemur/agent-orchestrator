"use client";

import {
  ArrowUpDown,
  Bot,
  ChevronLeft,
  ChevronRight,
  Eye,
  MoreVertical,
  Play,
  RefreshCw,
  Search,
  X,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { TaskData, TaskSortOption, TaskStatusType } from "@/hooks/useTasks";

// ============================================================================
// Types
// ============================================================================

interface TaskTableProps {
  tasks: TaskData[];
  isLoading: boolean;
  statusFilter: TaskStatusType | "all";
  searchQuery: string;
  sortBy: TaskSortOption;
  sortOrder: "asc" | "desc";
  onStatusFilterChange: (status: TaskStatusType | "all") => void;
  onSearchChange: (query: string) => void;
  onSortChange: (sort: TaskSortOption) => void;
  onSortOrderToggle: () => void;
  onRun?: (taskId: string) => void;
  onCancel?: (taskId: string) => void;
  onRetry?: (taskId: string) => void;
  isActing?: boolean;
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    setPage: (page: number) => void;
  };
  totalCount: number;
}

// ============================================================================
// Status & Priority Config
// ============================================================================

const statusConfig: Record<
  TaskStatusType,
  { color: string; bgColor: string; label: string }
> = {
  QUEUED: {
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    label: "Queued",
  },
  IN_PROGRESS: {
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    label: "In Progress",
  },
  VERIFYING: {
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    label: "Verifying",
  },
  COMPLETED: {
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    label: "Completed",
  },
  FAILED: {
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    label: "Failed",
  },
  CANCELLED: {
    color: "text-zinc-400",
    bgColor: "bg-zinc-500/10",
    label: "Cancelled",
  },
};

const priorityConfig: Record<number, { color: string; bgColor: string; label: string }> = {
  0: { color: "text-red-400", bgColor: "bg-red-500/10", label: "P0" },
  1: { color: "text-orange-400", bgColor: "bg-orange-500/10", label: "P1" },
  2: { color: "text-blue-400", bgColor: "bg-blue-500/10", label: "P2" },
  3: { color: "text-zinc-400", bgColor: "bg-zinc-500/10", label: "P3" },
};

const statusOptions: { value: TaskStatusType | "all"; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "QUEUED", label: "Queued" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "VERIFYING", label: "Verifying" },
  { value: "COMPLETED", label: "Completed" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELLED", label: "Cancelled" },
];

// ============================================================================
// Helpers
// ============================================================================

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + "…";
}

// ============================================================================
// Task Row Component
// ============================================================================

function TaskRow({
  task,
  onRun,
  onCancel,
  onRetry,
  isActing,
}: {
  task: TaskData;
  onRun?: (taskId: string) => void;
  onCancel?: (taskId: string) => void;
  onRetry?: (taskId: string) => void;
  isActing?: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const defaultStatus = { color: "text-zinc-400", bgColor: "bg-zinc-500/10", label: "Unknown" };
  const defaultPriority = { color: "text-zinc-400", bgColor: "bg-zinc-500/10", label: "Normal" };
  const statusCfg = statusConfig[task.status] ?? defaultStatus;
  const priorityCfg = priorityConfig[task.priority] ?? defaultPriority;

  const canRun = task.status === "QUEUED";
  const canCancel = task.status === "QUEUED";
  const canRetry = task.status === "FAILED" || task.status === "CANCELLED";

  return (
    <tr className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
      {/* Priority */}
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${priorityCfg.bgColor} ${priorityCfg.color}`}
        >
          {priorityCfg.label}
        </span>
      </td>

      {/* Title */}
      <td className="px-4 py-3">
        <Link
          href={`/tasks/${task.id}`}
          className="text-sm font-medium text-zinc-200 hover:text-blue-400"
        >
          {truncate(task.title, 50)}
        </Link>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCfg.bgColor} ${statusCfg.color}`}
        >
          {statusCfg.label}
        </span>
      </td>

      {/* Agent */}
      <td className="px-4 py-3">
        {task.assignedAgent ? (
          <Link
            href={`/agents/${task.assignedAgent.id}`}
            className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200"
          >
            <Bot className="h-3.5 w-3.5" />
            {truncate(task.assignedAgent.name, 20)}
          </Link>
        ) : (
          <span className="text-sm text-zinc-600">Unassigned</span>
        )}
      </td>

      {/* Created */}
      <td className="px-4 py-3 text-sm text-zinc-500">
        {formatDate(task.createdAt)}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
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
                  href={`/tasks/${task.id}`}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700"
                  onClick={() => setShowMenu(false)}
                >
                  <Eye className="h-4 w-4" />
                  View Details
                </Link>

                {canRun && onRun && (
                  <button
                    onClick={() => {
                      onRun(task.id);
                      setShowMenu(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700"
                    disabled={isActing}
                  >
                    <Play className="h-4 w-4" />
                    Run
                  </button>
                )}

                {canRetry && onRetry && (
                  <button
                    onClick={() => {
                      onRetry(task.id);
                      setShowMenu(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700"
                    disabled={isActing}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Retry
                  </button>
                )}

                {canCancel && onCancel && (
                  <button
                    onClick={() => {
                      onCancel(task.id);
                      setShowMenu(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-400 hover:bg-zinc-700"
                    disabled={isActing}
                  >
                    <XCircle className="h-4 w-4" />
                    Cancel
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

// ============================================================================
// Pagination Component
// ============================================================================

function Pagination({
  page,
  totalPages,
  setPage,
}: {
  page: number;
  totalPages: number;
  setPage: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-3">
      <p className="text-sm text-zinc-500">
        Page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPage(page - 1)}
          disabled={page <= 1}
          className="rounded-lg border border-zinc-700 p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => setPage(page + 1)}
          disabled={page >= totalPages}
          className="rounded-lg border border-zinc-700 p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Task Table Component
// ============================================================================

export function TaskTable({
  tasks,
  isLoading,
  statusFilter,
  searchQuery,
  sortBy,
  sortOrder: _sortOrder,
  onStatusFilterChange,
  onSearchChange,
  onSortChange,
  onSortOrderToggle,
  onRun,
  onCancel,
  onRetry,
  isActing,
  pagination,
  totalCount,
}: TaskTableProps) {
  const SortButton = ({
    column,
    label,
  }: {
    column: TaskSortOption;
    label: string;
  }) => (
    <button
      onClick={() => {
        if (sortBy === column) {
          onSortOrderToggle();
        } else {
          onSortChange(column);
        }
      }}
      className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-zinc-400 hover:text-zinc-200"
    >
      {label}
      <ArrowUpDown
        className={`h-3 w-3 ${sortBy === column ? "text-blue-400" : ""}`}
      />
    </button>
  );

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50">
      {/* Filter Bar */}
      <div className="flex flex-col gap-3 border-b border-zinc-800 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-9 pr-8 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) =>
              onStatusFilterChange(e.target.value as TaskStatusType | "all")
            }
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <p className="text-sm text-zinc-500">{totalCount} tasks</p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800 text-left">
              <th className="px-4 py-3">
                <SortButton column="priority" label="Priority" />
              </th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-400">
                Title
              </th>
              <th className="px-4 py-3">
                <SortButton column="status" label="Status" />
              </th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-400">
                Agent
              </th>
              <th className="px-4 py-3">
                <SortButton column="created" label="Created" />
              </th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }, (_, i) => (
                <tr key={i} className="border-b border-zinc-800/50">
                  {Array.from({ length: 6 }, (_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 w-20 animate-pulse rounded bg-zinc-800" />
                    </td>
                  ))}
                </tr>
              ))
            ) : tasks.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <p className="text-zinc-500">No tasks found</p>
                </td>
              </tr>
            ) : (
              tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onRun={onRun}
                  onCancel={onCancel}
                  onRetry={onRetry}
                  isActing={isActing}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        setPage={pagination.setPage}
      />
    </div>
  );
}
