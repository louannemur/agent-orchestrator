"use client";

import { createContext, useCallback, useState, type ReactNode } from "react";

import { ToastContainer } from "@/components/ui/toast-container";
import type { ToastData, ToastVariant } from "@/components/ui/toast";

// ============================================================================
// Types
// ============================================================================

interface ToastInput {
  variant: ToastVariant;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: ToastData[];
  addToast: (input: ToastInput) => string;
  dismissToast: (id: string) => void;
  dismissAllToasts: () => void;
}

// ============================================================================
// Context
// ============================================================================

export const ToastContext = createContext<ToastContextValue | null>(null);

// ============================================================================
// Helper
// ============================================================================

let toastCounter = 0;

function generateToastId(): string {
  return `toast-${Date.now()}-${++toastCounter}`;
}

// ============================================================================
// Provider
// ============================================================================

interface ToastProviderProps {
  children: ReactNode;
  maxToasts?: number;
}

export function ToastProvider({ children, maxToasts = 5 }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback(
    (input: ToastInput): string => {
      const id = generateToastId();
      const newToast: ToastData = {
        id,
        variant: input.variant,
        title: input.title,
        message: input.message,
        duration: input.duration,
      };

      setToasts((prev) => {
        // Keep only the most recent maxToasts
        const updated = [...prev, newToast];
        if (updated.length > maxToasts) {
          return updated.slice(-maxToasts);
        }
        return updated;
      });

      return id;
    },
    [maxToasts]
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const dismissAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider
      value={{ toasts, addToast, dismissToast, dismissAllToasts }}
    >
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}
