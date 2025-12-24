"use client";

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Info,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

// ============================================================================
// Types
// ============================================================================

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface ToastData {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

// ============================================================================
// Config
// ============================================================================

const variantConfig: Record<
  ToastVariant,
  { icon: React.ReactNode; bgColor: string; borderColor: string; iconColor: string }
> = {
  success: {
    icon: <CheckCircle className="h-5 w-5" />,
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    iconColor: "text-emerald-500",
  },
  error: {
    icon: <AlertCircle className="h-5 w-5" />,
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
    iconColor: "text-red-500",
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5" />,
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    iconColor: "text-amber-500",
  },
  info: {
    icon: <Info className="h-5 w-5" />,
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    iconColor: "text-blue-500",
  },
};

// ============================================================================
// Toast Component
// ============================================================================

export function Toast({ toast, onDismiss }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const config = variantConfig[toast.variant];
  const duration = toast.duration ?? 5000;

  // Animate in
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // Auto-dismiss
  useEffect(() => {
    if (duration === 0) return; // 0 means no auto-dismiss

    const timer = setTimeout(() => {
      handleDismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  const handleDismiss = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onDismiss(toast.id);
    }, 200);
  };

  return (
    <div
      className={`pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg border shadow-lg transition-all duration-200 ${
        config.bgColor
      } ${config.borderColor} ${
        isVisible && !isLeaving
          ? "translate-x-0 opacity-100"
          : "translate-x-full opacity-0"
      }`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <span className={`shrink-0 ${config.iconColor}`}>{config.icon}</span>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-100">{toast.title}</p>
            {toast.message && (
              <p className="mt-1 text-sm text-zinc-400">{toast.message}</p>
            )}
          </div>

          {/* Dismiss Button */}
          <button
            onClick={handleDismiss}
            className="shrink-0 rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Progress bar for auto-dismiss */}
      {duration > 0 && (
        <div className="h-1 w-full bg-zinc-800">
          <div
            className={`h-full ${
              toast.variant === "success"
                ? "bg-emerald-500"
                : toast.variant === "error"
                  ? "bg-red-500"
                  : toast.variant === "warning"
                    ? "bg-amber-500"
                    : "bg-blue-500"
            }`}
            style={{
              animation: `shrink ${duration}ms linear forwards`,
            }}
          />
        </div>
      )}

      <style jsx>{`
        @keyframes shrink {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
}
