"use client";

import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Shield,
  XCircle,
} from "lucide-react";
import { useState } from "react";

import type { VerificationResultData } from "@/hooks/useTask";

// ============================================================================
// Types
// ============================================================================

interface VerificationHistoryProps {
  results: VerificationResultData[];
  verificationStatus: string | null;
}

// ============================================================================
// Helpers
// ============================================================================

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================================================
// Check Item Component
// ============================================================================

function CheckItem({
  label,
  passed,
  extra,
}: {
  label: string;
  passed: boolean | null;
  extra?: string;
}) {
  if (passed === null) return null;

  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-zinc-400">{label}</span>
      <div className="flex items-center gap-2">
        {extra && <span className="text-xs text-zinc-500">{extra}</span>}
        {passed ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : (
          <XCircle className="h-4 w-4 text-red-500" />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Verification Item Component
// ============================================================================

function VerificationItem({ result }: { result: VerificationResultData }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-800/30">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between p-4"
      >
        <div className="flex items-center gap-3">
          {/* Status Icon */}
          {result.passed ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10">
              <XCircle className="h-4 w-4 text-red-500" />
            </div>
          )}

          <div className="text-left">
            <p className="text-sm font-medium text-zinc-200">
              Attempt #{result.attemptNumber}
            </p>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Clock className="h-3 w-3" />
              {formatDate(result.createdAt)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Confidence Score */}
          {result.confidenceScore !== null && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                result.confidenceScore >= 0.8
                  ? "bg-emerald-500/10 text-emerald-400"
                  : result.confidenceScore >= 0.5
                    ? "bg-amber-500/10 text-amber-400"
                    : "bg-red-500/10 text-red-400"
              }`}
            >
              {Math.round(result.confidenceScore * 100)}% confidence
            </span>
          )}

          <ChevronDown
            className={`h-4 w-4 text-zinc-500 transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-zinc-800 p-4">
          {/* Check Results */}
          <div className="mb-4 space-y-1">
            <CheckItem label="Syntax" passed={result.syntaxPassed} />
            <CheckItem label="TypeScript" passed={result.typesPassed} />
            <CheckItem label="ESLint" passed={result.lintPassed} />
            <CheckItem
              label="Tests"
              passed={result.testsPassed}
              extra={
                result.testsTotal
                  ? `${result.testsTotal - (result.testsFailed || 0)}/${result.testsTotal} passed`
                  : undefined
              }
            />
          </div>

          {/* Semantic Score */}
          {result.semanticScore !== null && (
            <div className="mb-4 rounded-lg bg-zinc-800/50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Semantic Score</span>
                <span className="text-sm font-medium text-zinc-200">
                  {Math.round((result.semanticScore as number) * 100)}%
                </span>
              </div>
              {result.semanticExplanation && (
                <p className="mt-2 text-xs text-zinc-500">
                  {result.semanticExplanation}
                </p>
              )}
            </div>
          )}

          {/* Failures */}
          {result.failures && result.failures.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Failures
              </p>
              <div className="space-y-1">
                {result.failures.slice(0, 10).map((failure, index) => (
                  <div
                    key={index}
                    className="rounded bg-red-500/5 px-3 py-2 font-mono text-xs text-red-300"
                  >
                    {failure.file && failure.line && (
                      <span className="text-zinc-500">
                        {failure.file}:{failure.line}:{" "}
                      </span>
                    )}
                    {failure.message}
                  </div>
                ))}
                {result.failures.length > 10 && (
                  <p className="text-center text-xs text-zinc-500">
                    +{result.failures.length - 10} more failures
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations && result.recommendations.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Recommendations
              </p>
              <ul className="space-y-1">
                {result.recommendations.map((rec, index) => (
                  <li key={index} className="text-xs text-zinc-400">
                    • {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Verification History Component
// ============================================================================

export function VerificationHistory({
  results,
  verificationStatus,
}: VerificationHistoryProps) {
  if (results.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h3 className="mb-3 text-sm font-medium text-zinc-100">
          Verification History
        </h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Shield className="h-10 w-10 text-zinc-700" />
          <p className="mt-3 text-sm text-zinc-500">
            No verification attempts yet
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            Verification runs after an agent completes the task
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-100">
          Verification History
        </h3>
        {verificationStatus && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              verificationStatus === "PASSED"
                ? "bg-emerald-500/10 text-emerald-400"
                : verificationStatus === "FAILED"
                  ? "bg-red-500/10 text-red-400"
                  : "bg-amber-500/10 text-amber-400"
            }`}
          >
            {verificationStatus}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {results.map((result) => (
          <VerificationItem key={result.id} result={result} />
        ))}
      </div>
    </div>
  );
}
