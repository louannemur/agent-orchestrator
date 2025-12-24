"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ============================================================================
// Types
// ============================================================================

export type LogType =
  | "THINKING"
  | "TOOL_CALL"
  | "TOOL_RESULT"
  | "ERROR"
  | "INFO"
  | "STATUS_CHANGE";

export interface AgentLog {
  id: string;
  logType: LogType;
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  taskId: string | null;
}

interface UseAgentLogsOptions {
  agentId: string;
  isWorking?: boolean;
  typeFilter?: LogType | "all";
  searchQuery?: string;
}

interface UseAgentLogsResult {
  logs: AgentLog[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  lastUpdated: Date | null;
  isPolling: boolean;
  loadMore: () => Promise<void>;
  refetch: () => Promise<void>;
}

// ============================================================================
// Constants
// ============================================================================

const POLL_INTERVAL_WORKING = 2000; // 2 seconds when agent is working

// ============================================================================
// Hook
// ============================================================================

export function useAgentLogs(options: UseAgentLogsOptions): UseAgentLogsResult {
  const { agentId, isWorking = false, typeFilter = "all", searchQuery = "" } = options;

  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const lastFetchedIdRef = useRef<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isVisibleRef = useRef(true);
  const isFetchingRef = useRef(false);
  const mountedRef = useRef(true);

  const fetchLogs = useCallback(
    async (loadMore = false) => {
      // Prevent concurrent fetches
      if (isFetchingRef.current) return;

      try {
        isFetchingRef.current = true;
        setIsPolling(true);

        const params = new URLSearchParams({
          limit: "50",
        });

        if (loadMore && cursor) {
          params.set("cursor", cursor);
        }

        const response = await fetch(
          `/api/agents/${agentId}/logs?${params.toString()}`
        );

        if (!mountedRef.current) return;

        if (!response.ok) {
          throw new Error("Failed to fetch logs");
        }

        const { data, pagination } = await response.json();
        const newLogs = data || [];

        if (loadMore) {
          setLogs((prev) => [...prev, ...newLogs]);
        } else {
          // For initial load or refresh, check if we have new logs
          if (newLogs.length > 0 && lastFetchedIdRef.current) {
            const lastIndex = newLogs.findIndex(
              (log: AgentLog) => log.id === lastFetchedIdRef.current
            );
            if (lastIndex > 0) {
              // We have new logs, prepend them
              const newEntries = newLogs.slice(0, lastIndex);
              setLogs((prev) => [...newEntries, ...prev]);
            } else if (lastIndex === -1) {
              // Completely new set of logs
              setLogs(newLogs);
            }
            // else lastIndex === 0, no new logs
          } else {
            setLogs(newLogs);
          }
        }

        if (newLogs.length > 0) {
          lastFetchedIdRef.current = newLogs[0].id;
        }

        setCursor(pagination?.nextCursor || null);
        setHasMore(!!pagination?.nextCursor);
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
    },
    [agentId, cursor]
  );

  const loadMore = useCallback(async () => {
    if (hasMore && !isLoading) {
      await fetchLogs(true);
    }
  }, [fetchLogs, hasMore, isLoading]);

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = document.visibilityState === "visible";

      // If becoming visible and agent is working, fetch immediately
      if (isVisibleRef.current && isWorking) {
        fetchLogs(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchLogs, isWorking]);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;
    setLogs([]);
    setCursor(null);
    setHasMore(true);
    lastFetchedIdRef.current = null;
    fetchLogs(false);

    return () => {
      mountedRef.current = false;
    };
  }, [agentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Polling when working
  useEffect(() => {
    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Only poll when agent is working
    if (!isWorking) return;

    intervalRef.current = setInterval(() => {
      // Only poll when tab is visible
      if (isVisibleRef.current) {
        fetchLogs(false);
      }
    }, POLL_INTERVAL_WORKING);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isWorking, fetchLogs]);

  // Filter logs client-side
  const filteredLogs = logs.filter((log) => {
    if (typeFilter !== "all" && log.logType !== typeFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return log.content.toLowerCase().includes(query);
    }
    return true;
  });

  return {
    logs: filteredLogs,
    isLoading,
    error,
    hasMore,
    lastUpdated,
    isPolling,
    loadMore,
    refetch: () => fetchLogs(false),
  };
}
