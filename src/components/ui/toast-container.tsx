"use client";

import { Toast, type ToastData } from "./toast";

// ============================================================================
// Types
// ============================================================================

interface ToastContainerProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

// ============================================================================
// Toast Container Component
// ============================================================================

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed bottom-0 right-0 z-50 flex flex-col gap-3 p-4 sm:p-6"
      style={{ maxHeight: "100vh" }}
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
