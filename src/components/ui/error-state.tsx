"use client";

import { AlertCircle, RefreshCw, WifiOff } from "lucide-react";
import { memo } from "react";

// ============================================================================
// Error State Component
// ============================================================================

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  icon?: "alert" | "offline";
  className?: string;
}

export const ErrorState = memo(function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  retryLabel = "Try again",
  icon = "alert",
  className = "",
}: ErrorStateProps) {
  const IconComponent = icon === "offline" ? WifiOff : AlertCircle;

  return (
    <div
      className={`flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center ${className}`}
      role="alert"
    >
      <div className="rounded-full bg-red-500/10 p-3">
        <IconComponent className="h-6 w-6 text-red-400" aria-hidden="true" />
      </div>

      <div className="space-y-1">
        <h3 className="text-lg font-medium text-zinc-100">{title}</h3>
        <p className="max-w-md text-sm text-zinc-400">{message}</p>
      </div>

      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
          aria-label={retryLabel}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {retryLabel}
        </button>
      )}
    </div>
  );
});

// ============================================================================
// Inline Error
// ============================================================================

interface InlineErrorProps {
  message: string;
  className?: string;
}

export const InlineError = memo(function InlineError({
  message,
  className = "",
}: InlineErrorProps) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400 ${className}`}
      role="alert"
    >
      <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
});

// ============================================================================
// Error Boundary Fallback
// ============================================================================

interface ErrorBoundaryFallbackProps {
  error: Error;
  resetErrorBoundary?: () => void;
}

export const ErrorBoundaryFallback = memo(function ErrorBoundaryFallback({
  error,
  resetErrorBoundary,
}: ErrorBoundaryFallbackProps) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-6 p-8">
      <div className="rounded-full bg-red-500/10 p-4">
        <AlertCircle className="h-8 w-8 text-red-400" />
      </div>

      <div className="space-y-2 text-center">
        <h2 className="text-xl font-semibold text-zinc-100">
          Oops! Something went wrong
        </h2>
        <p className="max-w-md text-sm text-zinc-400">
          An unexpected error occurred. Please try refreshing the page.
        </p>
        {process.env.NODE_ENV === "development" && (
          <pre className="mt-4 max-w-lg overflow-auto rounded-lg bg-zinc-800 p-4 text-left text-xs text-red-400">
            {error.message}
          </pre>
        )}
      </div>

      <div className="flex gap-3">
        {resetErrorBoundary && (
          <button
            onClick={resetErrorBoundary}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        )}
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
        >
          Refresh page
        </button>
      </div>
    </div>
  );
});

// ============================================================================
// API Error Handler
// ============================================================================

interface ApiErrorProps {
  status?: number;
  message?: string;
  onRetry?: () => void;
}

export const ApiError = memo(function ApiError({
  status,
  message,
  onRetry,
}: ApiErrorProps) {
  const errorConfig = {
    400: {
      title: "Invalid Request",
      description: message || "The request was invalid. Please check your input.",
    },
    401: {
      title: "Unauthorized",
      description: "You need to be logged in to access this resource.",
    },
    403: {
      title: "Access Denied",
      description: "You don't have permission to access this resource.",
    },
    404: {
      title: "Not Found",
      description: message || "The requested resource could not be found.",
    },
    429: {
      title: "Too Many Requests",
      description: "You've made too many requests. Please wait a moment and try again.",
    },
    500: {
      title: "Server Error",
      description: "An unexpected error occurred. Our team has been notified.",
    },
  };

  const config = status
    ? errorConfig[status as keyof typeof errorConfig]
    : null;

  return (
    <ErrorState
      title={config?.title || "Error"}
      message={config?.description || message || "An unexpected error occurred."}
      onRetry={onRetry}
    />
  );
});
