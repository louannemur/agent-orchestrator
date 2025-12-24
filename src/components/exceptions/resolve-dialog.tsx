"use client";

import { CheckCircle, Loader2, X, XCircle } from "lucide-react";
import { useState } from "react";

import type { ExceptionData } from "@/hooks/useExceptions";

// ============================================================================
// Types
// ============================================================================

interface ResolveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (status: "RESOLVED" | "DISMISSED", notes: string) => Promise<void>;
  exception: ExceptionData | null;
  defaultStatus?: "RESOLVED" | "DISMISSED";
}

// ============================================================================
// Resolve Dialog Component
// ============================================================================

export function ResolveDialog({
  isOpen,
  onClose,
  onConfirm,
  exception,
  defaultStatus = "RESOLVED",
}: ResolveDialogProps) {
  const [status, setStatus] = useState<"RESOLVED" | "DISMISSED">(defaultStatus);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !exception) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!notes.trim()) {
      setError("Please provide resolution notes");
      return;
    }

    try {
      setIsSubmitting(true);
      await onConfirm(status, notes.trim());
      setNotes("");
      setStatus("RESOLVED");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update exception");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setNotes("");
    setError(null);
    setStatus("RESOLVED");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">
              {status === "RESOLVED" ? "Resolve Exception" : "Dismiss Exception"}
            </h2>
            <p className="mt-0.5 text-sm text-zinc-400">
              {exception.title}
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 px-6 py-4">
            {/* Status Selection */}
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-200">
                Status
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setStatus("RESOLVED")}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                    status === "RESOLVED"
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                      : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600"
                  }`}
                >
                  <CheckCircle className="h-4 w-4" />
                  Resolved
                </button>
                <button
                  type="button"
                  onClick={() => setStatus("DISMISSED")}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                    status === "DISMISSED"
                      ? "border-zinc-500/50 bg-zinc-500/10 text-zinc-300"
                      : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600"
                  }`}
                >
                  <XCircle className="h-4 w-4" />
                  Dismissed
                </button>
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                {status === "RESOLVED"
                  ? "Mark as resolved when the issue has been fixed"
                  : "Mark as dismissed when the issue is not actionable or a false positive"}
              </p>
            </div>

            {/* Resolution Notes */}
            <div>
              <label
                htmlFor="notes"
                className="mb-2 block text-sm font-medium text-zinc-200"
              >
                Resolution Notes <span className="text-red-400">*</span>
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  status === "RESOLVED"
                    ? "Describe how the issue was resolved..."
                    : "Explain why this exception is being dismissed..."
                }
                rows={4}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-zinc-800 px-6 py-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
                status === "RESOLVED"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-zinc-600 hover:bg-zinc-700"
              }`}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {status === "RESOLVED" ? "Mark Resolved" : "Dismiss Exception"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
