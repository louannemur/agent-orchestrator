"use client";

import { useCallback, useEffect, useRef } from "react";

import type { AgentData } from "./useAgents";
import type { ExceptionData } from "./useExceptions";
import type { TaskData } from "./useTasks";
import { useToast } from "./useToast";

// ============================================================================
// Types
// ============================================================================

interface UseNotificationsOptions {
  agents?: AgentData[];
  tasks?: TaskData[];
  exceptions?: ExceptionData[];
  enabled?: boolean;
}

// ============================================================================
// Hook
// ============================================================================

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { agents = [], tasks = [], exceptions = [], enabled = true } = options;

  const { success, error, warning, info } = useToast();

  // Store previous state
  const prevAgentsRef = useRef<Map<string, AgentData>>(new Map());
  const prevTasksRef = useRef<Map<string, TaskData>>(new Map());
  const prevExceptionsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  // Check for agent changes
  const checkAgentChanges = useCallback(
    (currentAgents: AgentData[]) => {
      if (!enabled) return;

      const prevAgents = prevAgentsRef.current;
      const currentMap = new Map(currentAgents.map((a) => [a.id, a]));

      currentAgents.forEach((agent) => {
        const prev = prevAgents.get(agent.id);

        if (!prev) {
          // New agent
          if (agent.status === "WORKING" && agent.currentTask) {
            info(
              "Agent started",
              `${agent.name} is working on "${agent.currentTask.title}"`
            );
          }
        } else if (prev.status !== agent.status) {
          // Status changed
          if (agent.status === "WORKING" && agent.currentTask) {
            info(
              "Agent started",
              `${agent.name} is working on "${agent.currentTask.title}"`
            );
          } else if (prev.status === "WORKING" && agent.status === "IDLE") {
            // Completed work
            if (prev.currentTask) {
              success(
                "Agent completed",
                `${agent.name} finished "${prev.currentTask.title}"`
              );
            }
          } else if (agent.status === "FAILED") {
            error(
              "Agent failed",
              `${agent.name} encountered an error${
                prev.currentTask ? ` on "${prev.currentTask.title}"` : ""
              }`
            );
          } else if (agent.status === "STUCK") {
            warning(
              "Agent stuck",
              `${agent.name} appears to be stuck${
                agent.currentTask ? ` on "${agent.currentTask.title}"` : ""
              }`
            );
          }
        }
      });

      // Update ref with current state
      prevAgentsRef.current = currentMap;
    },
    [enabled, success, error, warning, info]
  );

  // Check for task changes
  const checkTaskChanges = useCallback(
    (currentTasks: TaskData[]) => {
      if (!enabled) return;

      const prevTasks = prevTasksRef.current;
      const currentMap = new Map(currentTasks.map((t) => [t.id, t]));

      currentTasks.forEach((task) => {
        const prev = prevTasks.get(task.id);

        if (!prev) {
          // New task - only notify if it was just created (within last 10 seconds)
          const createdAt = new Date(task.createdAt).getTime();
          const now = Date.now();
          if (now - createdAt < 10000) {
            info("Task created", `"${task.title}" has been added to the queue`);
          }
        } else if (prev.status !== task.status) {
          // Status changed
          if (task.status === "COMPLETED") {
            success("Task completed", `"${task.title}" has been completed`);
          } else if (task.status === "FAILED") {
            error("Task failed", `"${task.title}" has failed`);
          } else if (task.status === "IN_PROGRESS" && prev.status === "QUEUED") {
            info("Task started", `"${task.title}" is now in progress`);
          } else if (task.status === "VERIFYING") {
            info("Task verifying", `"${task.title}" is being verified`);
          }
        }
      });

      // Update ref with current state
      prevTasksRef.current = currentMap;
    },
    [enabled, success, error, info]
  );

  // Check for new exceptions
  const checkExceptionChanges = useCallback(
    (currentExceptions: ExceptionData[]) => {
      if (!enabled) return;

      const prevExceptions = prevExceptionsRef.current;
      const currentIds = new Set(currentExceptions.map((e) => e.id));

      currentExceptions.forEach((exception) => {
        if (!prevExceptions.has(exception.id)) {
          // New exception
          const createdAt = new Date(exception.createdAt).getTime();
          const now = Date.now();
          // Only notify for exceptions created in the last 10 seconds
          if (now - createdAt < 10000) {
            if (exception.severity === "CRITICAL") {
              error("Critical exception", exception.title);
            } else if (exception.severity === "ERROR") {
              error("Exception occurred", exception.title);
            } else {
              warning("New exception", exception.title);
            }
          }
        }
      });

      // Update ref with current state
      prevExceptionsRef.current = currentIds;
    },
    [enabled, error, warning]
  );

  // Initialize on first data load (skip notifications for existing data)
  useEffect(() => {
    if (!initializedRef.current && (agents.length > 0 || tasks.length > 0 || exceptions.length > 0)) {
      prevAgentsRef.current = new Map(agents.map((a) => [a.id, a]));
      prevTasksRef.current = new Map(tasks.map((t) => [t.id, t]));
      prevExceptionsRef.current = new Set(exceptions.map((e) => e.id));
      initializedRef.current = true;
    }
  }, [agents, tasks, exceptions]);

  // Check for changes after initialization
  useEffect(() => {
    if (!initializedRef.current) return;
    checkAgentChanges(agents);
  }, [agents, checkAgentChanges]);

  useEffect(() => {
    if (!initializedRef.current) return;
    checkTaskChanges(tasks);
  }, [tasks, checkTaskChanges]);

  useEffect(() => {
    if (!initializedRef.current) return;
    checkExceptionChanges(exceptions);
  }, [exceptions, checkExceptionChanges]);
}
