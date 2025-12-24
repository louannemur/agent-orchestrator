"use client";

import {
  AlertCircle,
  ArrowDown,
  Brain,
  ChevronDown,
  Info,
  Loader2,
  Search,
  Terminal,
  Wrench,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { AgentLog, LogType } from "@/hooks/useAgentLogs";

// ============================================================================
// Types
// ============================================================================

interface AgentLogsProps {
  logs: AgentLog[];
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  typeFilter: LogType | "all";
  searchQuery: string;
  onTypeFilterChange: (type: LogType | "all") => void;
  onSearchChange: (query: string) => void;
}

// ============================================================================
// Log Type Config
// ============================================================================

const logTypeConfig: Record<
  LogType,
  { icon: React.ReactNode; color: string; bgColor: string; label: string }
> = {
  THINKING: {
    icon: <Brain className="h-3.5 w-3.5" />,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    label: "Thinking",
  },
  TOOL_CALL: {
    icon: <Wrench className="h-3.5 w-3.5" />,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    label: "Tool Call",
  },
  TOOL_RESULT: {
    icon: <Terminal className="h-3.5 w-3.5" />,
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    label: "Result",
  },
  ERROR: {
    icon: <AlertCircle className="h-3.5 w-3.5" />,
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    label: "Error",
  },
  INFO: {
    icon: <Info className="h-3.5 w-3.5" />,
    color: "text-zinc-400",
    bgColor: "bg-zinc-500/10",
    label: "Info",
  },
  STATUS_CHANGE: {
    icon: <Info className="h-3.5 w-3.5" />,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    label: "Status",
  },
};

const filterOptions: { value: LogType | "all"; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "THINKING", label: "Thinking" },
  { value: "TOOL_CALL", label: "Tool Calls" },
  { value: "TOOL_RESULT", label: "Results" },
  { value: "ERROR", label: "Errors" },
  { value: "INFO", label: "Info" },
  { value: "STATUS_CHANGE", label: "Status" },
];

// ============================================================================
// Helpers
// ============================================================================

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function highlightCode(content: string): string {
  // Simple code detection - if content looks like code, wrap in code styling
  if (
    content.includes("```") ||
    content.includes("function ") ||
    content.includes("const ") ||
    content.includes("import ")
  ) {
    return content;
  }
  return content;
}

// ============================================================================
// Log Entry Component
// ============================================================================

function LogEntry({ log }: { log: AgentLog }) {
  const config = logTypeConfig[log.logType] || logTypeConfig.INFO;
  const [isExpanded, setIsExpanded] = useState(false);

  const content = log.content;
  const isLong = content.length > 500;
  const displayContent = isLong && !isExpanded ? content.slice(0, 500) + "..." : content;

  // Check if content contains code blocks
  const hasCode = content.includes("```");

  return (
    <div className="group border-b border-zinc-800/50 px-4 py-3 hover:bg-zinc-800/30">
      <div className="flex items-start gap-3">
        {/* Timestamp */}
        <span className="shrink-0 font-mono text-xs text-zinc-600">
          {formatTimestamp(log.createdAt)}
        </span>

        {/* Type Badge */}
        <span
          className={`flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${config.bgColor} ${config.color}`}
        >
          {config.icon}
          <span className="hidden sm:inline">{config.label}</span>
        </span>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <pre
            className={`whitespace-pre-wrap break-words font-mono text-sm ${
              log.logType === "ERROR" ? "text-red-300" : "text-zinc-300"
            } ${hasCode ? "bg-zinc-900/50 rounded p-2" : ""}`}
          >
            {highlightCode(displayContent)}
          </pre>

          {isLong && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-2 flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
            >
              <ChevronDown
                className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
              />
              {isExpanded ? "Show less" : "Show more"}
            </button>
          )}

          {/* Metadata */}
          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <div className="mt-2 rounded bg-zinc-900/50 p-2 text-xs">
              <pre className="text-zinc-500">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Agent Logs Component
// ============================================================================

export function AgentLogs({
  logs,
  isLoading,
  hasMore,
  onLoadMore,
  typeFilter,
  searchQuery,
  onTypeFilterChange,
  onSearchChange,
}: AgentLogsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const prevLogsLengthRef = useRef(logs.length);

  // Auto-scroll when new logs appear
  useEffect(() => {
    if (autoScroll && logs.length > prevLogsLengthRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
    prevLogsLengthRef.current = logs.length;
  }, [logs.length, autoScroll]);

  // Detect if user scrolled up
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    setAutoScroll(isAtBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      setAutoScroll(true);
    }
  }, []);

  return (
    <div className="flex h-full flex-col rounded-xl border border-zinc-800 bg-zinc-900/50">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-zinc-800 p-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-medium text-zinc-100">Activity Log</h3>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 sm:w-48">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-1.5 pl-8 pr-7 text-xs text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => onTypeFilterChange(e.target.value as LogType | "all")}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-100 focus:border-blue-500 focus:outline-none"
          >
            {filterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Log List */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
        style={{ maxHeight: "calc(100vh - 400px)", minHeight: "400px" }}
      >
        {/* Load More (at top for older logs) */}
        {hasMore && (
          <div className="border-b border-zinc-800/50 p-3 text-center">
            <button
              onClick={onLoadMore}
              disabled={isLoading}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading...
                </span>
              ) : (
                "Load older logs"
              )}
            </button>
          </div>
        )}

        {/* Logs */}
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Terminal className="h-10 w-10 text-zinc-700" />
            <p className="mt-3 text-sm text-zinc-500">
              {searchQuery || typeFilter !== "all"
                ? "No logs match your filters"
                : "No activity logs yet"}
            </p>
          </div>
        ) : (
          logs.map((log) => <LogEntry key={log.id} log={log} />)
        )}

        {/* Loading indicator */}
        {isLoading && logs.length > 0 && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
          </div>
        )}
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-20 right-8 flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-lg hover:bg-blue-700"
        >
          <ArrowDown className="h-3 w-3" />
          New logs
        </button>
      )}

      {/* Footer */}
      <div className="border-t border-zinc-800 px-4 py-2">
        <p className="text-xs text-zinc-500">
          {logs.length} log entries
          {autoScroll && " · Auto-scrolling"}
        </p>
      </div>
    </div>
  );
}
