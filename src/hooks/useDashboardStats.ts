"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ============================================================================
// Types
// ============================================================================

export interface DashboardStats {
  agents: {
    total: number;
    working: number;
    idle: number;
    paused: number;
    failed: number;
    stuck: number;
  };
  tasks: {
    total: number;
    queued: number;
    inProgress: number;
    completed: number;
    failed: number;
    verifying: number;
    cancelled: number;
  };
  exceptions: {
    total: number;
    unresolved: number;
    bySeverity: {
      critical: number;
      error: number;
      warning: number;
      info: number;
    };
  };
  performance: {
    avgCompletionTime: number | null;
    successRate: number | null;
    todayCompleted: number;
    todayFailed: number;
  };
}

export interface RecentActivity {
  id: string;
  type: "agent_started" | "task_completed" | "task_failed" | "exception_created" | "agent_stopped";
  description: string;
  timestamp: string;
  entityId?: string;
  entityType?: "agent" | "task" | "exception";
}

export interface AgentStatus {
  id: string;
  name: string;
  status: "IDLE" | "WORKING" | "PAUSED" | "FAILED" | "STUCK";
  currentTaskId: string | null;
  currentTaskTitle: string | null;
}

interface UseDashboardStatsResult {
  stats: DashboardStats | null;
  recentActivity: RecentActivity[];
  agents: AgentStatus[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  isPolling: boolean;
  refetch: () => Promise<void>;
}

// ============================================================================
// Constants
// ============================================================================

const POLL_INTERVAL = 5000; // 5 seconds

// ============================================================================
// Hook
// ============================================================================

export function useDashboardStats(): UseDashboardStatsResult {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isVisibleRef = useRef(true);
  const isFetchingRef = useRef(false);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) return;

    try {
      isFetchingRef.current = true;
      setIsPolling(true);

      // Fetch all data in parallel
      const [statsRes, agentsRes, exceptionsRes, tasksRes] = await Promise.all([
        fetch("/api/dashboard/stats"),
        fetch("/api/agents?limit=50"),
        fetch("/api/exceptions?limit=10&status=OPEN"),
        fetch("/api/tasks?limit=20&sortBy=updatedAt&sortOrder=desc"),
      ]);

      if (!mountedRef.current) return;

      if (!statsRes.ok) {
        throw new Error("Failed to fetch dashboard stats");
      }

      const statsData = await statsRes.json();
      setStats(statsData.data);

      // Process agents
      if (agentsRes.ok) {
        const agentsData = await agentsRes.json();
        const agentList: AgentStatus[] = (agentsData.data || []).map(
          (agent: {
            id: string;
            name: string;
            status: string;
            currentTaskId: string | null;
            currentTask?: { title: string } | null;
          }) => ({
            id: agent.id,
            name: agent.name,
            status: agent.status,
            currentTaskId: agent.currentTaskId,
            currentTaskTitle: agent.currentTask?.title ?? null,
          })
        );
        setAgents(agentList);
      }

      // Build recent activity from multiple sources
      const activities: RecentActivity[] = [];

      // Get recent exceptions
      if (exceptionsRes.ok) {
        const exceptionsData = await exceptionsRes.json();
        for (const exc of exceptionsData.data || []) {
          activities.push({
            id: `exc-${exc.id}`,
            type: "exception_created",
            description: exc.title,
            timestamp: exc.createdAt,
            entityId: exc.id,
            entityType: "exception",
          });
        }
      }

      // Get recent task completions/failures
      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        for (const task of tasksData.data || []) {
          if (task.status === "COMPLETED") {
            activities.push({
              id: `task-complete-${task.id}`,
              type: "task_completed",
              description: task.title,
              timestamp: task.completedAt || task.updatedAt,
              entityId: task.id,
              entityType: "task",
            });
          } else if (task.status === "FAILED") {
            activities.push({
              id: `task-failed-${task.id}`,
              type: "task_failed",
              description: task.title,
              timestamp: task.completedAt || task.updatedAt,
              entityId: task.id,
              entityType: "task",
            });
          }
        }
      }

      // Sort by timestamp and take top 20
      activities.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setRecentActivity(activities.slice(0, 20));

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

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = document.visibilityState === "visible";

      // If becoming visible, fetch immediately
      if (isVisibleRef.current) {
        fetchData();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchData]);

  // Setup polling
  useEffect(() => {
    mountedRef.current = true;

    // Initial fetch
    fetchData();

    // Setup interval
    intervalRef.current = setInterval(() => {
      // Only poll when tab is visible
      if (isVisibleRef.current) {
        fetchData();
      }
    }, POLL_INTERVAL);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchData]);

  return {
    stats,
    recentActivity,
    agents,
    isLoading,
    error,
    lastUpdated,
    isPolling,
    refetch: fetchData,
  };
}
