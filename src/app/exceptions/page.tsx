"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useState } from "react";

import { ExceptionList, ResolveDialog } from "@/components/exceptions";
import { MainLayout } from "@/components/layout";
import {
  useExceptions,
  useNotifications,
  type ExceptionData,
  type ExceptionSeverity,
  type ExceptionStatus,
  type ExceptionType,
} from "@/hooks";

// ============================================================================
// Exceptions Page
// ============================================================================

export default function ExceptionsPage() {
  // Filter state
  const [statusFilter, setStatusFilter] = useState<ExceptionStatus | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<ExceptionSeverity | "all">("all");
  const [typeFilter, setTypeFilter] = useState<ExceptionType | "all">("all");

  // Dialog state
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedException, setSelectedException] = useState<ExceptionData | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<"RESOLVED" | "DISMISSED">("RESOLVED");

  // Data hook
  const { exceptions, isLoading, error, refetch, acknowledge, resolve } = useExceptions({
    statusFilter,
    severityFilter,
    typeFilter,
  });

  // Enable notifications for new exceptions
  useNotifications({ exceptions });

  // Count stats
  const openCount = exceptions.filter((e) => e.status === "OPEN").length;
  const criticalCount = exceptions.filter(
    (e) => e.severity === "CRITICAL" && (e.status === "OPEN" || e.status === "ACKNOWLEDGED")
  ).length;

  // Handlers
  const handleAcknowledge = async (id: string) => {
    try {
      await acknowledge(id);
    } catch (err) {
      console.error("Failed to acknowledge exception:", err);
    }
  };

  const handleResolveClick = (exception: ExceptionData) => {
    setSelectedException(exception);
    // If the exception was passed with DISMISSED status, default to DISMISSED
    setDefaultStatus(exception.status === "DISMISSED" ? "DISMISSED" : "RESOLVED");
    setResolveDialogOpen(true);
  };

  const handleResolveConfirm = async (status: "RESOLVED" | "DISMISSED", notes: string) => {
    if (!selectedException) return;
    await resolve(selectedException.id, status, notes);
  };

  return (
    <MainLayout title="Exceptions">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-zinc-100">Exceptions</h1>
                {openCount > 0 && (
                  <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400">
                    {openCount} open
                  </span>
                )}
                {criticalCount > 0 && (
                  <span className="animate-pulse rounded-full bg-red-500 px-2 py-0.5 text-xs font-medium text-white">
                    {criticalCount} critical
                  </span>
                )}
              </div>
              <p className="text-sm text-zinc-500">
                Monitor and triage system exceptions
              </p>
            </div>
          </div>

          <button
            onClick={refetch}
            className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Exception List */}
        <ExceptionList
          exceptions={exceptions}
          isLoading={isLoading}
          onAcknowledge={handleAcknowledge}
          onResolve={handleResolveClick}
          statusFilter={statusFilter}
          severityFilter={severityFilter}
          typeFilter={typeFilter}
          onStatusFilterChange={setStatusFilter}
          onSeverityFilterChange={setSeverityFilter}
          onTypeFilterChange={setTypeFilter}
        />
      </div>

      {/* Resolve Dialog */}
      <ResolveDialog
        isOpen={resolveDialogOpen}
        onClose={() => {
          setResolveDialogOpen(false);
          setSelectedException(null);
        }}
        onConfirm={handleResolveConfirm}
        exception={selectedException}
        defaultStatus={defaultStatus}
      />
    </MainLayout>
  );
}
