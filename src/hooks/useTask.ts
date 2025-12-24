"use client";

import { useCallback, useEffect, useState } from "react";

// ============================================================================
// Types
// ============================================================================

export interface VerificationResultData {
  id: string;
  attemptNumber: number;
  passed: boolean;
  confidenceScore: number | null;
  syntaxPassed: boolean | null;
  typesPassed: boolean | null;
  lintPassed: boolean | null;
  testsPassed: boolean | null;
  testsTotal: number | null;
  testsFailed: number | null;
  semanticScore: number | null;
  semanticExplanation: string | null;
  failures: Array<{
    type: string;
    message: string;
    file?: string;
    line?: number;
  }> | null;
  recommendations: string[];
  createdAt: string;
}

export interface TaskLogData {
  id: string;
  logType: string;
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  agentId: string;
  agent: {
    name: string;
  } | null;
}

export interface TaskDetail {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  riskLevel: string;
  filesHint: string[];
  assignedAgentId: string | null;
  assignedAgent: {
    id: string;
    name: string;
    status: string;
    totalTokensUsed: number;
    lastActivityAt: string | null;
  } | null;
  verificationStatus: string | null;
  verificationAttempts: number;
  retryCount: number;
  error: string | null;
  verificationResults: VerificationResultData[];
  logs: TaskLogData[];
  exceptions: Array<{
    id: string;
    type: string;
    severity: string;
    title: string;
    createdAt: string;
  }>;
  fileLocks: Array<{
    id: string;
    filePath: string;
    acquiredAt: string;
  }>;
  lockedFilesHint?: Array<{
    filePath: string;
    agentId: string;
    agentName: string | null;
  }>;
  hasFileConflicts?: boolean;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface UseTaskResult {
  task: TaskDetail | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// ============================================================================
// useTask Hook
// ============================================================================

export function useTask(taskId: string): UseTaskResult {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTask = useCallback(async () => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Task not found");
        }
        throw new Error("Failed to fetch task");
      }
      const { data } = await response.json();
      setTask(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchTask();

    // Faster refresh when task is in progress
    const isActive = task?.status === "IN_PROGRESS" || task?.status === "VERIFYING";
    const interval = setInterval(fetchTask, isActive ? 3000 : 10000);

    return () => clearInterval(interval);
  }, [fetchTask, task?.status]);

  return { task, isLoading, error, refetch: fetchTask };
}
