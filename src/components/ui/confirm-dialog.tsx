"use client";

import { AlertTriangle, X } from "lucide-react";
import { memo, useCallback, useEffect, useRef } from "react";

import { LoadingButton } from "./loading";

// ============================================================================
// Types
// ============================================================================

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  isLoading?: boolean;
}

// ============================================================================
// Confirm Dialog Component
// ============================================================================

export const ConfirmDialog = memo(function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  isLoading = false,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isLoading) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, isLoading, onClose]);

  // Focus trap and initial focus
  useEffect(() => {
    if (isOpen && cancelButtonRef.current) {
      cancelButtonRef.current.focus();
    }
  }, [isOpen]);

  // Prevent body scroll when dialog is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleConfirm = useCallback(async () => {
    await onConfirm();
  }, [onConfirm]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && !isLoading) {
        onClose();
      }
    },
    [isLoading, onClose]
  );

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: "text-red-400 bg-red-500/10",
      button: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
    },
    warning: {
      icon: "text-amber-400 bg-amber-500/10",
      button: "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500",
    },
    default: {
      icon: "text-blue-400 bg-blue-500/10",
      button: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500",
    },
  };

  const styles = variantStyles[variant];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute right-4 top-4 rounded-lg p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Close dialog"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-6">
          {/* Icon */}
          <div
            className={`mb-4 inline-flex rounded-full p-3 ${styles.icon}`}
            aria-hidden="true"
          >
            <AlertTriangle className="h-6 w-6" />
          </div>

          {/* Content */}
          <h2
            id="confirm-dialog-title"
            className="mb-2 text-lg font-semibold text-zinc-100"
          >
            {title}
          </h2>
          <p
            id="confirm-dialog-description"
            className="mb-6 text-sm text-zinc-400"
          >
            {description}
          </p>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              ref={cancelButtonRef}
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <LoadingButton
              onClick={handleConfirm}
              isLoading={isLoading}
              loadingText="Processing..."
              className={`flex-1 text-white ${styles.button} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900`}
            >
              {confirmLabel}
            </LoadingButton>
          </div>
        </div>
      </div>
    </>
  );
});

// ============================================================================
// Preset Confirm Dialogs
// ============================================================================

interface PresetDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
  itemName?: string;
}

// Stop Agent
export const StopAgentDialog = memo(function StopAgentDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  itemName,
}: PresetDialogProps) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      isLoading={isLoading}
      variant="danger"
      title="Stop Agent"
      description={`Are you sure you want to stop ${itemName || "this agent"}? Any in-progress work may be lost.`}
      confirmLabel="Stop Agent"
    />
  );
});

// Cancel Task
export const CancelTaskDialog = memo(function CancelTaskDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  itemName,
}: PresetDialogProps) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      isLoading={isLoading}
      variant="warning"
      title="Cancel Task"
      description={`Are you sure you want to cancel "${itemName || "this task"}"? This action cannot be undone.`}
      confirmLabel="Cancel Task"
    />
  );
});

// Dismiss Exception
export const DismissExceptionDialog = memo(function DismissExceptionDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}: PresetDialogProps) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      isLoading={isLoading}
      variant="warning"
      title="Dismiss Exception"
      description="Are you sure you want to dismiss this exception without resolving it? The underlying issue may still exist."
      confirmLabel="Dismiss"
    />
  );
});

// Delete Task
export const DeleteTaskDialog = memo(function DeleteTaskDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  itemName,
}: PresetDialogProps) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      isLoading={isLoading}
      variant="danger"
      title="Delete Task"
      description={`Are you sure you want to delete "${itemName || "this task"}"? This action cannot be undone.`}
      confirmLabel="Delete"
    />
  );
});
