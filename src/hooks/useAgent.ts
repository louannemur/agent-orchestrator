"use client";

import { useCallback, useEffect, useState } from "react";

// ============================================================================
// Types
// ============================================================================

export interface AgentDetail {
  id: string;
  name: string;
  status: "IDLE" | "WORKING" | "PAUSED" | "FAILED" | "STUCK";
  currentTaskId: string | null;
  currentTask: {
    id: string;
    title: string;
    description: string;
    status: string;
    priority: number;
    riskLevel: string;
  } | null;
  totalTokensUsed: number;
  tasksCompleted: number;
  tasksFailed: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  lastActivityAt: string | null;
  fileLocks: Array<{
    id: string;
    filePath: string;
    acquiredAt: string;
  }>;
}

interface UseAgentResult {
  agent: AgentDetail | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// ============================================================================
// Hook
// ============================================================================

export function useAgent(agentId: string): UseAgentResult {
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgent = useCallback(async () => {
    try {
      const response = await fetch(`/api/agents/${agentId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Agent not found");
        }
        throw new Error("Failed to fetch agent");
      }
      const { data } = await response.json();
      setAgent(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchAgent();

    // Faster refresh when agent is working
    const interval = setInterval(
      fetchAgent,
      agent?.status === "WORKING" ? 3000 : 10000
    );

    return () => clearInterval(interval);
  }, [fetchAgent, agent?.status]);

  return { agent, isLoading, error, refetch: fetchAgent };
}
