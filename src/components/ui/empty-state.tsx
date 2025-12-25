"use client";

import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardList,
  FileSearch,
  Inbox,
  Plus,
  Search,
} from "lucide-react";
import Link from "next/link";
import { memo, ReactNode } from "react";

// ============================================================================
// Empty State Component
// ============================================================================

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  className?: string;
}

export const EmptyState = memo(function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex min-h-[300px] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/50 p-8 text-center ${className}`}
    >
      {icon && (
        <div className="rounded-full bg-zinc-800 p-4" aria-hidden="true">
          {icon}
        </div>
      )}

      <div className="space-y-1">
        <h3 className="text-lg font-medium text-zinc-100">{title}</h3>
        <p className="max-w-md text-sm text-zinc-400">{description}</p>
      </div>

      {action && (
        <>
          {action.href ? (
            <Link
              href={action.href}
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {action.label}
            </Link>
          ) : (
            <button
              onClick={action.onClick}
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {action.label}
            </button>
          )}
        </>
      )}
    </div>
  );
});

// ============================================================================
// Preset Empty States
// ============================================================================

interface PresetEmptyStateProps {
  onAction?: () => void;
  actionHref?: string;
}

// No Agents Running
export const NoAgentsEmpty = memo(function NoAgentsEmpty({
  onAction,
}: PresetEmptyStateProps) {
  return (
    <EmptyState
      icon={<Bot className="h-8 w-8 text-zinc-500" />}
      title="No agents running"
      description="Spawn an agent to start working on tasks. Agents will automatically pick up queued tasks and begin coding."
      action={onAction ? { label: "Spawn Agent", onClick: onAction } : undefined}
    />
  );
});

// No Tasks
export const NoTasksEmpty = memo(function NoTasksEmpty({
  onAction,
  actionHref,
}: PresetEmptyStateProps) {
  return (
    <EmptyState
      icon={<ClipboardList className="h-8 w-8 text-zinc-500" />}
      title="No tasks yet"
      description="Create your first task to get started. Tasks define the work that agents will complete."
      action={{
        label: "Create Task",
        onClick: onAction,
        href: actionHref,
      }}
    />
  );
});

// No Exceptions
export const NoExceptionsEmpty = memo(function NoExceptionsEmpty() {
  return (
    <EmptyState
      icon={<CheckCircle2 className="h-8 w-8 text-emerald-500" />}
      title="All clear!"
      description="No exceptions require your attention. Everything is running smoothly."
    />
  );
});

// No Search Results
export const NoSearchResultsEmpty = memo(function NoSearchResultsEmpty({
  query,
  onClear,
}: {
  query?: string;
  onClear?: () => void;
}) {
  return (
    <EmptyState
      icon={<Search className="h-8 w-8 text-zinc-500" />}
      title="No results found"
      description={
        query
          ? `No items match "${query}". Try adjusting your search or filters.`
          : "No items match your current filters."
      }
      action={onClear ? { label: "Clear filters", onClick: onClear } : undefined}
    />
  );
});

// No Logs
export const NoLogsEmpty = memo(function NoLogsEmpty() {
  return (
    <EmptyState
      icon={<FileSearch className="h-8 w-8 text-zinc-500" />}
      title="No logs yet"
      description="Activity logs will appear here once the agent starts working on tasks."
    />
  );
});

// No File Locks
export const NoLocksEmpty = memo(function NoLocksEmpty() {
  return (
    <EmptyState
      icon={<Inbox className="h-8 w-8 text-zinc-500" />}
      title="No active file locks"
      description="File locks are automatically created when agents modify files to prevent conflicts."
    />
  );
});

// Filtered Results Empty
export const FilteredEmpty = memo(function FilteredEmpty({
  filterName,
  onClear,
}: {
  filterName: string;
  onClear?: () => void;
}) {
  return (
    <EmptyState
      icon={<AlertTriangle className="h-8 w-8 text-amber-500" />}
      title={`No ${filterName} items`}
      description={`There are no items matching your "${filterName}" filter.`}
      action={onClear ? { label: "Show all", onClick: onClear } : undefined}
    />
  );
});

// Queued Tasks Empty
export const QueuedTasksEmpty = memo(function QueuedTasksEmpty({
  onAction,
}: PresetEmptyStateProps) {
  return (
    <EmptyState
      icon={<ClipboardList className="h-8 w-8 text-zinc-500" />}
      title="Queue is empty"
      description="No tasks are waiting to be processed. Create a new task or check completed tasks."
      action={onAction ? { label: "Create Task", onClick: onAction } : undefined}
    />
  );
});
