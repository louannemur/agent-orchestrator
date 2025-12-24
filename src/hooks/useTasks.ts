"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ============================================================================
// Types
// ============================================================================

export type TaskStatusType =
  | "QUEUED"
  | "IN_PROGRESS"
  | "VERIFYING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type RiskLevelType = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface TaskData {
  id: string;
  title: string;
  description: string;
  status: TaskStatusType;
  priority: number;
  riskLevel: RiskLevelType;
  filesHint: string[];
  assignedAgentId: string | null;
  assignedAgent: {
    id: string;
    name: string;
    status: string;
  } | null;
  verificationStatus: string | null;
  verificationAttempts: number;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export type TaskSortOption = "priority" | "status" | "created" | "updated";

interface UseTasksOptions {
  statusFilter?: TaskStatusType | "all";
  searchQuery?: string;
  sortBy?: TaskSortOption;
  sortOrder?: "asc" | "desc";
}

interface UseTasksResult {
  tasks: TaskData[];
  filteredTasks: TaskData[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  isPolling: boolean;
  refetch: () => Promise<void>;
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    setPage: (page: number) => void;
  };
  totalCount: number;
}

// ============================================================================
// Constants
// ============================================================================

const POLL_INTERVAL = 5000; // 5 seconds

// ============================================================================
// useTasks Hook
// ============================================================================

export function useTasks(options: UseTasksOptions = {}): UseTasksResult {
  const {
    statusFilter = "all",
    searchQuery = "",
    sortBy = "created",
    sortOrder = "desc",
  } = options;

  const [tasks, setTasks] = useState<TaskData[]>([]);
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

  const fetchTasks = useCallback(async () => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) return;

    try {
      isFetchingRef.current = true;
      setIsPolling(true);

      const params = new URLSearchParams({
        limit: "100",
        sortBy: sortBy === "created" ? "createdAt" : sortBy === "updated" ? "updatedAt" : sortBy,
        sortOrder,
      });

      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }

      const response = await fetch(`/api/tasks?${params.toString()}`);

      if (!mountedRef.current) return;

      if (!response.ok) {
        throw new Error("Failed to fetch tasks");
      }

      const { data } = await response.json();
      setTasks(data || []);
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
  }, [statusFilter, sortBy, sortOrder]);

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (task) =>
          task.title.toLowerCase().includes(query) ||
          task.description.toLowerCase().includes(query)
      );
    }

    return result;
  }, [tasks, searchQuery]);

  // Paginate
  const totalPages = Math.ceil(filteredTasks.length / pageSize);
  const paginatedTasks = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTasks.slice(start, start + pageSize);
  }, [filteredTasks, page, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, searchQuery, sortBy, sortOrder]);

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = document.visibilityState === "visible";

      // If becoming visible, fetch immediately
      if (isVisibleRef.current) {
        fetchTasks();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchTasks]);

  // Setup polling
  useEffect(() => {
    mountedRef.current = true;

    // Initial fetch
    fetchTasks();

    // Setup interval
    intervalRef.current = setInterval(() => {
      // Only poll when tab is visible
      if (isVisibleRef.current) {
        fetchTasks();
      }
    }, POLL_INTERVAL);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchTasks]);

  return {
    tasks,
    filteredTasks: paginatedTasks,
    isLoading,
    error,
    lastUpdated,
    isPolling,
    refetch: fetchTasks,
    pagination: {
      page,
      pageSize,
      totalPages,
      setPage,
    },
    totalCount: filteredTasks.length,
  };
}

// ============================================================================
// useCreateTask Hook
// ============================================================================

interface CreateTaskInput {
  title: string;
  description: string;
  priority: number;
  riskLevel: RiskLevelType;
  filesHint?: string[];
}

interface UseCreateTaskResult {
  createTask: (input: CreateTaskInput) => Promise<TaskData | null>;
  isCreating: boolean;
  error: string | null;
}

export function useCreateTask(): UseCreateTaskResult {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createTask = useCallback(
    async (input: CreateTaskInput): Promise<TaskData | null> => {
      setIsCreating(true);
      setError(null);

      try {
        const response = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || "Failed to create task");
        }

        const { data } = await response.json();
        return data;
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    []
  );

  return { createTask, isCreating, error };
}

// ============================================================================
// useTaskActions Hook
// ============================================================================

interface UseTaskActionsResult {
  runTask: (taskId: string, workingDir: string) => Promise<boolean>;
  cancelTask: (taskId: string) => Promise<boolean>;
  retryTask: (taskId: string, workingDir: string) => Promise<boolean>;
  autoRetryTask: (taskId: string, workingDir: string) => Promise<boolean>;
  isActing: boolean;
  error: string | null;
}

export function useTaskActions(): UseTaskActionsResult {
  const [isActing, setIsActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runTask = useCallback(
    async (taskId: string, workingDir: string): Promise<boolean> => {
      setIsActing(true);
      setError(null);

      try {
        const response = await fetch(`/api/tasks/${taskId}/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workingDir }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || "Failed to run task");
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

  const cancelTask = useCallback(async (taskId: string): Promise<boolean> => {
    setIsActing(true);
    setError(null);

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to cancel task");
      }

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      return false;
    } finally {
      setIsActing(false);
    }
  }, []);

  const retryTask = useCallback(
    async (taskId: string, workingDir: string): Promise<boolean> => {
      setIsActing(true);
      setError(null);

      try {
        const response = await fetch(`/api/tasks/${taskId}/retry`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workingDir }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || "Failed to retry task");
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

  const autoRetryTask = useCallback(
    async (taskId: string, workingDir: string): Promise<boolean> => {
      setIsActing(true);
      setError(null);

      try {
        const response = await fetch(`/api/tasks/${taskId}/auto-retry`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workingDir }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || "Failed to auto-retry task");
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

  return { runTask, cancelTask, retryTask, autoRetryTask, isActing, error };
}
