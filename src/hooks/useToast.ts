"use client";

import { useCallback, useContext } from "react";

import { ToastContext } from "@/contexts/toast-context";
import type { ToastVariant } from "@/components/ui/toast";

// ============================================================================
// Types
// ============================================================================

interface ToastOptions {
  variant: ToastVariant;
  title: string;
  message?: string;
  duration?: number;
}

interface UseToastResult {
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
  warning: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
}

// ============================================================================
// Hook
// ============================================================================

export function useToast(): UseToastResult {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }

  const { addToast, dismissToast, dismissAllToasts } = context;

  const toast = useCallback(
    (options: ToastOptions): string => {
      return addToast(options);
    },
    [addToast]
  );

  const dismiss = useCallback(
    (id: string) => {
      dismissToast(id);
    },
    [dismissToast]
  );

  const dismissAll = useCallback(() => {
    dismissAllToasts();
  }, [dismissAllToasts]);

  const success = useCallback(
    (title: string, message?: string): string => {
      return addToast({ variant: "success", title, message });
    },
    [addToast]
  );

  const error = useCallback(
    (title: string, message?: string): string => {
      return addToast({ variant: "error", title, message });
    },
    [addToast]
  );

  const warning = useCallback(
    (title: string, message?: string): string => {
      return addToast({ variant: "warning", title, message });
    },
    [addToast]
  );

  const info = useCallback(
    (title: string, message?: string): string => {
      return addToast({ variant: "info", title, message });
    },
    [addToast]
  );

  return {
    toast,
    dismiss,
    dismissAll,
    success,
    error,
    warning,
    info,
  };
}
