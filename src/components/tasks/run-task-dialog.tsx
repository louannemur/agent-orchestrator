"use client";

import { AlertCircle, Folder, Loader2, X } from "lucide-react";
import { useState } from "react";

// ============================================================================
// Types
// ============================================================================

interface RunTaskDialogProps {
  isOpen: boolean;
  taskId?: string | null;
  taskTitle: string;
  onClose: () => void;
  onRun?: (taskId: string, workingDir: string) => Promise<boolean>;
  onConfirm?: (workingDir: string) => Promise<void>;
  isRunning?: boolean;
  mode?: "run" | "retry" | "auto-retry";
}

const modeConfig = {
  run: { title: "Run Task", button: "Run Task", buttonActive: "Starting..." },
  retry: { title: "Retry Task", button: "Retry Task", buttonActive: "Retrying..." },
  "auto-retry": { title: "Auto Retry Task", button: "Auto Retry", buttonActive: "Retrying..." },
};

// ============================================================================
// Run Task Dialog Component
// ============================================================================

export function RunTaskDialog({
  isOpen,
  taskId,
  taskTitle,
  onClose,
  onRun,
  onConfirm,
  isRunning = false,
  mode = "run",
}: RunTaskDialogProps) {
  const [workingDir, setWorkingDir] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const config = modeConfig[mode];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!workingDir.trim()) {
      setError("Please enter a working directory");
      return;
    }

    // Basic path validation
    if (!workingDir.startsWith("/") && !workingDir.match(/^[A-Za-z]:\\/)) {
      setError("Please enter an absolute path");
      return;
    }

    setIsSubmitting(true);

    try {
      if (onConfirm) {
        await onConfirm(workingDir);
        setWorkingDir("");
        onClose();
      } else if (onRun && taskId) {
        const success = await onRun(taskId, workingDir);
        if (success) {
          setWorkingDir("");
          onClose();
        } else {
          setError("Failed to start task. Please try again.");
        }
      }
    } catch {
      setError("Failed to start task. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isRunning && !isSubmitting) {
      setError(null);
      setWorkingDir("");
      onClose();
    }
  };

  if (!isOpen) return null;
  if (!onConfirm && !taskId) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-100">{config.title}</h2>
          <button
            onClick={handleClose}
            disabled={isRunning || isSubmitting}
            className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 disabled:cursor-not-allowed"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Task Info */}
          <div className="mb-4 rounded-lg bg-zinc-800/50 px-4 py-3">
            <p className="text-xs text-zinc-500">Task</p>
            <p className="mt-0.5 text-sm font-medium text-zinc-200">
              {taskTitle}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

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
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2.5 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                disabled={isRunning || isSubmitting}
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
              onClick={handleClose}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isRunning || isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isRunning || isSubmitting}
            >
              {isRunning || isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {config.buttonActive}
                </>
              ) : (
                config.button
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
