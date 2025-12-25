"use client";

import { AlertCircle, Folder, Loader2, ListTodo, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

// ============================================================================
// Types
// ============================================================================

interface SpawnAgentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSpawn: (taskId: string, workingDir: string) => Promise<boolean>;
  isSpawning: boolean;
}

interface QueuedTask {
  id: string;
  title: string;
  priority: number;
  riskLevel: string;
  createdAt: string;
}

// ============================================================================
// Spawn Agent Dialog Component
// ============================================================================

export function SpawnAgentDialog({
  isOpen,
  onClose,
  onSpawn,
  isSpawning,
}: SpawnAgentDialogProps) {
  const [tasks, setTasks] = useState<QueuedTask[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [workingDir, setWorkingDir] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Fetch queued tasks
  const fetchTasks = useCallback(async () => {
    setIsLoadingTasks(true);
    try {
      const response = await fetch("/api/tasks?status=QUEUED&limit=50");
      if (response.ok) {
        const { data } = await response.json();
        const taskList = data?.tasks || [];
        setTasks(taskList);
        // Auto-select first task if available
        const firstTask = taskList[0];
        if (firstTask && !selectedTaskId) {
          setSelectedTaskId(firstTask.id);
        }
      }
    } catch {
      setError("Failed to load tasks");
    } finally {
      setIsLoadingTasks(false);
    }
  }, [selectedTaskId]);

  useEffect(() => {
    if (isOpen) {
      fetchTasks();
      setError(null);
    }
  }, [isOpen, fetchTasks]);

  // Reset form when closing
  useEffect(() => {
    if (!isOpen) {
      setSelectedTaskId("");
      setWorkingDir("");
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!selectedTaskId) {
      setError("Please select a task");
      return;
    }

    if (!workingDir.trim()) {
      setError("Please enter a working directory");
      return;
    }

    // Basic path validation
    if (!workingDir.startsWith("/") && !workingDir.match(/^[A-Za-z]:\\/)) {
      setError("Please enter an absolute path");
      return;
    }

    const success = await onSpawn(selectedTaskId, workingDir);
    if (success) {
      onClose();
    } else {
      setError("Failed to spawn agent. Please try again.");
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-100">Spawn Agent</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Error Message */}
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Task Selection */}
          <div className="mb-4">
            <label
              htmlFor="task"
              className="mb-2 block text-sm font-medium text-zinc-300"
            >
              Select Task
            </label>

            {isLoadingTasks ? (
              <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading tasks...
              </div>
            ) : tasks.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-500">
                <ListTodo className="h-4 w-4" />
                No queued tasks available
              </div>
            ) : (
              <select
                id="task"
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select a task...</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title.length > 50
                      ? task.title.slice(0, 50) + "..."
                      : task.title}{" "}
                    (P{task.priority})
                  </option>
                ))}
              </select>
            )}

            {selectedTaskId && (
              <p className="mt-1.5 text-xs text-zinc-500">
                Task ID: {selectedTaskId}
              </p>
            )}
          </div>

          {/* Working Directory */}
          <div className="mb-6">
            <label
              htmlFor="workingDir"
              className="mb-2 block text-sm font-medium text-zinc-300"
            >
              Working Directory
            </label>
            <div className="relative">
              <Folder className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                id="workingDir"
                type="text"
                value={workingDir}
                onChange={(e) => setWorkingDir(e.target.value)}
                placeholder="/path/to/project"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2.5 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <p className="mt-1.5 text-xs text-zinc-500">
              Absolute path to the project directory
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700"
              disabled={isSpawning}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSpawning || isLoadingTasks || tasks.length === 0}
            >
              {isSpawning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Spawning...
                </>
              ) : (
                "Spawn Agent"
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
