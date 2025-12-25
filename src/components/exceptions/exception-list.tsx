"use client";

import { CheckCircle2, Filter, Loader2, X } from "lucide-react";
import { useMemo, useState } from "react";

import type {
  ExceptionData,
  ExceptionSeverity,
  ExceptionStatus,
  ExceptionType,
} from "@/hooks/useExceptions";
import { ExceptionCard } from "./exception-card";

// ============================================================================
// Types
// ============================================================================

interface ExceptionListProps {
  exceptions: ExceptionData[];
  isLoading: boolean;
  onAcknowledge: (id: string) => void;
  onResolve: (exception: ExceptionData) => void;
  statusFilter: ExceptionStatus | "all";
  severityFilter: ExceptionSeverity | "all";
  typeFilter: ExceptionType | "all";
  onStatusFilterChange: (status: ExceptionStatus | "all") => void;
  onSeverityFilterChange: (severity: ExceptionSeverity | "all") => void;
  onTypeFilterChange: (type: ExceptionType | "all") => void;
  isActing?: boolean;
}

// ============================================================================
// Config
// ============================================================================

const statusOptions: { value: ExceptionStatus | "all"; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "OPEN", label: "Open" },
  { value: "ACKNOWLEDGED", label: "Acknowledged" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "DISMISSED", label: "Dismissed" },
];

const severityOptions: { value: ExceptionSeverity | "all"; label: string }[] = [
  { value: "all", label: "All Severities" },
  { value: "CRITICAL", label: "Critical" },
  { value: "ERROR", label: "Error" },
  { value: "WARNING", label: "Warning" },
  { value: "INFO", label: "Info" },
];

const typeOptions: { value: ExceptionType | "all"; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "AGENT_CRASH", label: "Agent Crash" },
  { value: "TASK_FAILURE", label: "Task Failure" },
  { value: "VERIFICATION_FAILURE", label: "Verification Failed" },
  { value: "FILE_CONFLICT", label: "File Conflict" },
  { value: "RESOURCE_LIMIT", label: "Resource Limit" },
  { value: "API_ERROR", label: "API Error" },
  { value: "UNKNOWN", label: "Unknown" },
];

// ============================================================================
// Filter Bar Component
// ============================================================================

function FilterBar({
  statusFilter,
  severityFilter,
  typeFilter,
  onStatusFilterChange,
  onSeverityFilterChange,
  onTypeFilterChange,
}: {
  statusFilter: ExceptionStatus | "all";
  severityFilter: ExceptionSeverity | "all";
  typeFilter: ExceptionType | "all";
  onStatusFilterChange: (status: ExceptionStatus | "all") => void;
  onSeverityFilterChange: (severity: ExceptionSeverity | "all") => void;
  onTypeFilterChange: (type: ExceptionType | "all") => void;
}) {
  const hasFilters = statusFilter !== "all" || severityFilter !== "all" || typeFilter !== "all";

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-center gap-2 text-zinc-500">
        <Filter className="h-4 w-4" />
        <span className="text-sm font-medium">Filters</span>
      </div>

      {/* Status Filter */}
      <select
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value as ExceptionStatus | "all")}
        className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
      >
        {statusOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {/* Severity Filter */}
      <select
        value={severityFilter}
        onChange={(e) => onSeverityFilterChange(e.target.value as ExceptionSeverity | "all")}
        className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
      >
        {severityOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {/* Type Filter */}
      <select
        value={typeFilter}
        onChange={(e) => onTypeFilterChange(e.target.value as ExceptionType | "all")}
        className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
      >
        {typeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {/* Clear Filters */}
      {hasFilters && (
        <button
          onClick={() => {
            onStatusFilterChange("all");
            onSeverityFilterChange("all");
            onTypeFilterChange("all");
          }}
          className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Group Header Component
// ============================================================================

function GroupHeader({
  title,
  count,
  color,
}: {
  title: string;
  count: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 py-2">
      <div className={`h-1.5 w-1.5 rounded-full ${color}`} />
      <span className="text-sm font-medium text-zinc-400">{title}</span>
      <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-500">
        {count}
      </span>
    </div>
  );
}

// ============================================================================
// Empty State Component
// ============================================================================

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
      </div>
      <h3 className="mt-4 text-lg font-medium text-zinc-100">
        {hasFilters ? "No matching exceptions" : "No open exceptions"}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-zinc-500">
        {hasFilters
          ? "Try adjusting your filters to see more results"
          : "All systems are running smoothly. No exceptions require your attention."}
      </p>
    </div>
  );
}

// ============================================================================
// Exception List Component
// ============================================================================

export function ExceptionList({
  exceptions,
  isLoading,
  onAcknowledge,
  onResolve,
  statusFilter,
  severityFilter,
  typeFilter,
  onStatusFilterChange,
  onSeverityFilterChange,
  onTypeFilterChange,
  isActing = false,
}: ExceptionListProps) {
  // Group exceptions by status
  const groupedExceptions = useMemo(() => {
    const groups: Record<string, ExceptionData[]> = {
      OPEN: [],
      ACKNOWLEDGED: [],
      RESOLVED_DISMISSED: [],
    };

    exceptions.forEach((exception) => {
      if (exception.status === "OPEN") {
        groups.OPEN.push(exception);
      } else if (exception.status === "ACKNOWLEDGED") {
        groups.ACKNOWLEDGED.push(exception);
      } else {
        groups.RESOLVED_DISMISSED.push(exception);
      }
    });

    return groups;
  }, [exceptions]);

  const hasFilters = statusFilter !== "all" || severityFilter !== "all" || typeFilter !== "all";

  if (isLoading) {
    return (
      <div className="space-y-4">
        <FilterBar
          statusFilter={statusFilter}
          severityFilter={severityFilter}
          typeFilter={typeFilter}
          onStatusFilterChange={onStatusFilterChange}
          onSeverityFilterChange={onSeverityFilterChange}
          onTypeFilterChange={onTypeFilterChange}
        />
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <FilterBar
        statusFilter={statusFilter}
        severityFilter={severityFilter}
        typeFilter={typeFilter}
        onStatusFilterChange={onStatusFilterChange}
        onSeverityFilterChange={onSeverityFilterChange}
        onTypeFilterChange={onTypeFilterChange}
      />

      {/* Empty State */}
      {exceptions.length === 0 && <EmptyState hasFilters={hasFilters} />}

      {/* Grouped Exceptions */}
      {exceptions.length > 0 && (
        <div className="space-y-6">
          {/* Open Exceptions */}
          {groupedExceptions.OPEN.length > 0 && (
            <div>
              <GroupHeader
                title="Open"
                count={groupedExceptions.OPEN.length}
                color="bg-red-500"
              />
              <div className="space-y-3">
                {groupedExceptions.OPEN.map((exception) => (
                  <ExceptionCard
                    key={exception.id}
                    exception={exception}
                    onAcknowledge={onAcknowledge}
                    onResolve={onResolve}
                    isActing={isActing}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Acknowledged Exceptions */}
          {groupedExceptions.ACKNOWLEDGED.length > 0 && (
            <div>
              <GroupHeader
                title="Acknowledged"
                count={groupedExceptions.ACKNOWLEDGED.length}
                color="bg-amber-500"
              />
              <div className="space-y-3">
                {groupedExceptions.ACKNOWLEDGED.map((exception) => (
                  <ExceptionCard
                    key={exception.id}
                    exception={exception}
                    onAcknowledge={onAcknowledge}
                    onResolve={onResolve}
                    isActing={isActing}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Resolved/Dismissed Exceptions */}
          {groupedExceptions.RESOLVED_DISMISSED.length > 0 && (
            <div>
              <GroupHeader
                title="Resolved / Dismissed"
                count={groupedExceptions.RESOLVED_DISMISSED.length}
                color="bg-zinc-500"
              />
              <div className="space-y-3">
                {groupedExceptions.RESOLVED_DISMISSED.map((exception) => (
                  <ExceptionCard
                    key={exception.id}
                    exception={exception}
                    onAcknowledge={onAcknowledge}
                    onResolve={onResolve}
                    isActing={isActing}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
