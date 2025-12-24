"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ============================================================================
// Types
// ============================================================================

export type AgentStatusType =
  | "IDLE"
  | "WORKING"
  | "PAUSED"
  | "FAILED"
  | "STUCK";

export interface AgentData {
  id: string;
  name: string;
  status: AgentStatusType;
  currentTaskId: string | null;
  currentTask: {
    id: string;
    title: string;
    status: string;
  } | null;
  totalTokensUsed: number;
  tasksCompleted: number;
  tasksFailed: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  lastActivityAt: string | null;
}

export type SortOption = "newest" | "oldest" | "status" | "name";

interface UseAgentsOptions {
  statusFilter?: AgentStatusType | "all";
  searchQuery?: string;
  sortBy?: SortOption;
}

interface UseAgentsResult {
  agents: AgentData[];
  filteredAgents: AgentData[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  isPolling: boolean;
  refetch: () => Promise<void>;
  hasWorkingAgents: boolean;
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    setPage: (page: number) => void;
  };
}

// ============================================================================
// Constants
// ============================================================================

const POLL_INTERVAL_ACTIVE = 3000; // 3 seconds when agents are working
const POLL_INTERVAL_IDLE = 10000; // 10 seconds otherwise

// ============================================================================
// Hook
// ============================================================================

export function useAgents(options: UseAgentsOptions = {}): UseAgentsResult {
  const {
    statusFilter = "all",
    searchQuery = "",
    sortBy = "newest",
  } = options;

  const [agents, setAgents] = useState<AgentData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isVisibleRef = useRef(true);
  const isFetchingRef = useRef(false);
  const mountedRef = useRef(true);

  // Check if any agents are working (for faster refresh)
  const hasWorkingAgents = useMemo(
    () => agents.some((agent) => agent.status === "WORKING"),
    [agents]
  );

  const fetchAgents = useCallback(async () => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) return;

    try {
      isFetchingRef.current = true;
      setIsPolling(true);

      const response = await fetch("/api/agents?limit=100");

      if (!mountedRef.current) return;

      if (!response.ok) {
        throw new Error("Failed to fetch agents");
      }

      const { data } = await response.json();
      setAgents(data || []);
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
  }, []);

  // Filter and sort agents
  const filteredAgents = useMemo(() => {
    let result = [...agents];

    // Filter by status
    if (statusFilter !== "all") {
      result = result.filter((agent) => agent.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (agent) =>
          agent.name.toLowerCase().includes(query) ||
          agent.id.toLowerCase().includes(query) ||
          agent.currentTask?.title.toLowerCase().includes(query)
      );
    }

    // Sort
    switch (sortBy) {
      case "newest":
        result.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
      case "oldest":
        result.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        break;
      case "status":
        const statusOrder: Record<AgentStatusType, number> = {
          WORKING: 0,
          PAUSED: 1,
          IDLE: 2,
          STUCK: 3,
          FAILED: 4,
        };
        result.sort(
          (a, b) => statusOrder[a.status] - statusOrder[b.status]
        );
        break;
      case "name":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return result;
  }, [agents, statusFilter, searchQuery, sortBy]);

  // Paginate
  const totalPages = Math.ceil(filteredAgents.length / pageSize);
  const paginatedAgents = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAgents.slice(start, start + pageSize);
  }, [filteredAgents, page, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, searchQuery, sortBy]);

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = document.visibilityState === "visible";

      // If becoming visible, fetch immediately
      if (isVisibleRef.current) {
        fetchAgents();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchAgents]);

  // Setup polling with dynamic interval
  useEffect(() => {
    mountedRef.current = true;

    // Initial fetch
    fetchAgents();

    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Use faster refresh when agents are working
    const pollInterval = hasWorkingAgents ? POLL_INTERVAL_ACTIVE : POLL_INTERVAL_IDLE;

    intervalRef.current = setInterval(() => {
      // Only poll when tab is visible
      if (isVisibleRef.current) {
        fetchAgents();
      }
    }, pollInterval);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchAgents, hasWorkingAgents]);

  return {
    agents,
    filteredAgents: paginatedAgents,
    isLoading,
    error,
    lastUpdated,
    isPolling,
    refetch: fetchAgents,
    hasWorkingAgents,
    pagination: {
      page,
      pageSize,
      totalPages,
      setPage,
    },
  };
}

// ============================================================================
// Spawn Agent Hook
// ============================================================================

interface SpawnAgentResult {
  spawn: (taskId: string, workingDir: string) => Promise<boolean>;
  isSpawning: boolean;
  error: string | null;
}

export function useSpawnAgent(): SpawnAgentResult {
  const [isSpawning, setIsSpawning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spawn = useCallback(
    async (taskId: string, workingDir: string): Promise<boolean> => {
      setIsSpawning(true);
      setError(null);

      try {
        const response = await fetch(`/api/tasks/${taskId}/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workingDir }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || "Failed to spawn agent");
        }

        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        return false;
      } finally {
        setIsSpawning(false);
      }
    },
    []
  );

  return { spawn, isSpawning, error };
}

// ============================================================================
// Agent Actions Hook
// ============================================================================

interface AgentActionsResult {
  stopAgent: (agentId: string) => Promise<boolean>;
  pauseAgent: (agentId: string) => Promise<boolean>;
  resumeAgent: (agentId: string) => Promise<boolean>;
  isActing: boolean;
  error: string | null;
}

export function useAgentActions(): AgentActionsResult {
  const [isActing, setIsActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performAction = useCallback(
    async (
      agentId: string,
      action: "stop" | "pause" | "resume"
    ): Promise<boolean> => {
      setIsActing(true);
      setError(null);

      try {
        const response = await fetch(`/api/agents/${agentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || `Failed to ${action} agent`);
        }

        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        return false;
      } finally {
        setIsActing(false);
      }
    },
    []
  );

  return {
    stopAgent: (agentId: string) => performAction(agentId, "stop"),
    pauseAgent: (agentId: string) => performAction(agentId, "pause"),
    resumeAgent: (agentId: string) => performAction(agentId, "resume"),
    isActing,
    error,
  };
}
