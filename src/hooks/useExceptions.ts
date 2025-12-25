"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ============================================================================
// Types
// ============================================================================

export type ExceptionSeverity = "INFO" | "WARNING" | "ERROR" | "CRITICAL";
export type ExceptionStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED";
export type ExceptionType =
  | "AGENT_CRASH"
  | "TASK_FAILURE"
  | "VERIFICATION_FAILURE"
  | "FILE_CONFLICT"
  | "RESOURCE_LIMIT"
  | "API_ERROR"
  | "UNKNOWN";

export interface ExceptionData {
  id: string;
  type: ExceptionType;
  severity: ExceptionSeverity;
  title: string;
  message: string;
  stackTrace: string | null;
  status: ExceptionStatus;
  resolutionNotes: string | null;
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  agent: {
    id: string;
    name: string;
  } | null;
  task: {
    id: string;
    title: string;
  } | null;
}

interface UseExceptionsOptions {
  statusFilter?: ExceptionStatus | "all";
  severityFilter?: ExceptionSeverity | "all";
  typeFilter?: ExceptionType | "all";
}

interface UseExceptionsResult {
  exceptions: ExceptionData[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  isPolling: boolean;
  refetch: () => void;
  acknowledge: (id: string) => Promise<void>;
  resolve: (id: string, status: "RESOLVED" | "DISMISSED", notes: string) => Promise<void>;
}

// ============================================================================
// Constants
// ============================================================================

const POLL_INTERVAL = 10000; // 10 seconds

// ============================================================================
// Hook
// ============================================================================

export function useExceptions(options: UseExceptionsOptions = {}): UseExceptionsResult {
  const { statusFilter = "all", severityFilter = "all", typeFilter = "all" } = options;

  const [exceptions, setExceptions] = useState<ExceptionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isVisibleRef = useRef(true);
  const isFetchingRef = useRef(false);
  const mountedRef = useRef(true);

  const fetchExceptions = useCallback(async () => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) return;

    try {
      isFetchingRef.current = true;
      setIsPolling(true);

      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (severityFilter !== "all") params.append("severity", severityFilter);
      if (typeFilter !== "all") params.append("type", typeFilter);

      const response = await fetch(`/api/exceptions?${params.toString()}`);

      if (!mountedRef.current) return;

      if (!response.ok) {
        throw new Error("Failed to fetch exceptions");
      }

      const data = await response.json();
      setExceptions(data.data?.exceptions || []);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsPolling(false);
      }
      isFetchingRef.current = false;
    }
  }, [statusFilter, severityFilter, typeFilter]);

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = document.visibilityState === "visible";

      // If becoming visible, fetch immediately
      if (isVisibleRef.current) {
        fetchExceptions();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchExceptions]);

  // Setup polling
  useEffect(() => {
    mountedRef.current = true;

    // Initial fetch
    fetchExceptions();

    // Setup interval
    intervalRef.current = setInterval(() => {
      // Only poll when tab is visible
      if (isVisibleRef.current) {
        fetchExceptions();
      }
    }, POLL_INTERVAL);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchExceptions]);

  const acknowledge = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/exceptions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACKNOWLEDGED" }),
      });

      if (!response.ok) {
        throw new Error("Failed to acknowledge exception");
      }

      // Optimistic update
      setExceptions((prev) =>
        prev.map((e) =>
          e.id === id
            ? { ...e, status: "ACKNOWLEDGED" as ExceptionStatus, acknowledgedAt: new Date().toISOString() }
            : e
        )
      );
    } catch (err) {
      throw err;
    }
  }, []);

  const resolve = useCallback(
    async (id: string, status: "RESOLVED" | "DISMISSED", notes: string) => {
      try {
        const response = await fetch(`/api/exceptions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, resolutionNotes: notes }),
        });

        if (!response.ok) {
          throw new Error("Failed to resolve exception");
        }

        // Optimistic update
        setExceptions((prev) =>
          prev.map((e) =>
            e.id === id
              ? {
                  ...e,
                  status: status as ExceptionStatus,
                  resolutionNotes: notes,
                  resolvedAt: new Date().toISOString(),
                }
              : e
          )
        );
      } catch (err) {
        throw err;
      }
    },
    []
  );

  // Sort exceptions: by status (open first), then severity (critical first), then date
  const sortedExceptions = useMemo(() => {
    const statusOrder: Record<ExceptionStatus, number> = {
      OPEN: 0,
      ACKNOWLEDGED: 1,
      RESOLVED: 2,
      DISMISSED: 3,
    };

    const severityOrder: Record<ExceptionSeverity, number> = {
      CRITICAL: 0,
      ERROR: 1,
      WARNING: 2,
      INFO: 3,
    };

    return [...exceptions].sort((a, b) => {
      // First by status
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;

      // Then by severity
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;

      // Then by date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [exceptions]);

  return {
    exceptions: sortedExceptions,
    isLoading,
    error,
    lastUpdated,
    isPolling,
    refetch: fetchExceptions,
    acknowledge,
    resolve,
  };
}
