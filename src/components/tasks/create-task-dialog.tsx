"use client";

import { AlertCircle, Loader2, X } from "lucide-react";
import { useState } from "react";

import type { RiskLevelType } from "@/hooks/useTasks";

// ============================================================================
// Types
// ============================================================================

interface CreateTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (input: {
    title: string;
    description: string;
    priority: number;
    riskLevel: RiskLevelType;
    filesHint?: string[];
  }) => Promise<unknown>;
  isCreating: boolean;
}

// ============================================================================
// Priority & Risk Options
// ============================================================================

const priorityOptions = [
  { value: 0, label: "Urgent (P0)", description: "Critical, needs immediate attention" },
  { value: 1, label: "High (P1)", description: "Important, should be done soon" },
  { value: 2, label: "Normal (P2)", description: "Standard priority" },
  { value: 3, label: "Low (P3)", description: "Can be done when time permits" },
];

const riskOptions: { value: RiskLevelType; label: string; description: string }[] = [
  { value: "LOW", label: "Low", description: "Minimal impact, easy to revert" },
  { value: "MEDIUM", label: "Medium", description: "Moderate impact, some caution needed" },
  { value: "HIGH", label: "High", description: "Significant impact, careful review required" },
  { value: "CRITICAL", label: "Critical", description: "Major impact, extensive testing needed" },
];

// ============================================================================
// Create Task Dialog Component
// ============================================================================

export function CreateTaskDialog({
  isOpen,
  onClose,
  onCreate,
  isCreating,
}: CreateTaskDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(2);
  const [riskLevel, setRiskLevel] = useState<RiskLevelType>("MEDIUM");
  const [filesHint, setFilesHint] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    if (!description.trim()) {
      setError("Description is required");
      return;
    }

    // Parse file hints
    const files = filesHint
      .split(",")
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    const result = await onCreate({
      title: title.trim(),
      description: description.trim(),
      priority,
      riskLevel,
      filesHint: files.length > 0 ? files : undefined,
    });

    if (result) {
      // Reset form and close
      setTitle("");
      setDescription("");
      setPriority(2);
      setRiskLevel("MEDIUM");
      setFilesHint("");
      onClose();
    } else {
      setError("Failed to create task. Please try again.");
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setError(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-100">Create Task</h2>
          <button
            onClick={handleClose}
            disabled={isCreating}
            className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 disabled:cursor-not-allowed"
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

          {/* Title */}
          <div className="mb-4">
            <label
              htmlFor="title"
              className="mb-2 block text-sm font-medium text-zinc-300"
            >
              Title <span className="text-red-400">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief description of the task"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
              disabled={isCreating}
            />
          </div>

          {/* Description */}
          <div className="mb-4">
            <label
              htmlFor="description"
              className="mb-2 block text-sm font-medium text-zinc-300"
            >
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed description of what needs to be done..."
              rows={4}
              className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
              disabled={isCreating}
            />
          </div>

          {/* Priority & Risk Level */}
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            {/* Priority */}
            <div>
              <label
                htmlFor="priority"
                className="mb-2 block text-sm font-medium text-zinc-300"
              >
                Priority
              </label>
              <select
                id="priority"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
                disabled={isCreating}
              >
                {priorityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Risk Level */}
            <div>
              <label
                htmlFor="riskLevel"
                className="mb-2 block text-sm font-medium text-zinc-300"
              >
                Risk Level
              </label>
              <select
                id="riskLevel"
                value={riskLevel}
                onChange={(e) => setRiskLevel(e.target.value as RiskLevelType)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
                disabled={isCreating}
              >
                {riskOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* File Hints */}
          <div className="mb-6">
            <label
              htmlFor="filesHint"
              className="mb-2 block text-sm font-medium text-zinc-300"
            >
              File Hints{" "}
              <span className="font-normal text-zinc-500">(optional)</span>
            </label>
            <input
              id="filesHint"
              type="text"
              value={filesHint}
              onChange={(e) => setFilesHint(e.target.value)}
              placeholder="src/components/Button.tsx, src/utils/helpers.ts"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
              disabled={isCreating}
            />
            <p className="mt-1.5 text-xs text-zinc-500">
              Comma-separated list of files the agent should focus on
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isCreating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isCreating}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Task"
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
