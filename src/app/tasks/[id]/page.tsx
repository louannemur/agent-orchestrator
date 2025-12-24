"use client";

import { Activity, AlertCircle, FileText } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";

import { MainLayout } from "@/components/layout";
import {
  RunTaskDialog,
  TaskDescription,
  TaskHeader,
  VerificationHistory,
} from "@/components/tasks";
import { useTask, useTaskActions } from "@/hooks";

// ============================================================================
// Log Entry Component (for related logs)
// ============================================================================

function LogEntry({ log }: { log: { id: string; logType: string; content: string; createdAt: string; agentName?: string } }) {
  const typeColors: Record<string, string> = {
    THINKING: "text-purple-400 bg-purple-500/10",
    TOOL_CALL: "text-blue-400 bg-blue-500/10",
    TOOL_RESULT: "text-cyan-400 bg-cyan-500/10",
    ERROR: "text-red-400 bg-red-500/10",
    INFO: "text-zinc-400 bg-zinc-500/10",
    STATUS_CHANGE: "text-amber-400 bg-amber-500/10",
  };

  const color = typeColors[log.logType] || typeColors.INFO;

  return (
    <div className="border-b border-zinc-800/50 px-4 py-3 hover:bg-zinc-800/30">
      <div className="flex items-start gap-3">
        <span className="shrink-0 font-mono text-xs text-zinc-600">
          {new Date(log.createdAt).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          })}
        </span>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${color}`}>
          {log.logType}
        </span>
        {log.agentName && (
          <span className="shrink-0 text-xs text-zinc-500">
            {log.agentName}
          </span>
        )}
        <pre className="min-w-0 flex-1 whitespace-pre-wrap break-words font-mono text-sm text-zinc-300">
          {log.content.length > 300 ? log.content.slice(0, 300) + "..." : log.content}
        </pre>
      </div>
    </div>
  );
}

// ============================================================================
// Task Detail Page
// ============================================================================

export default function TaskDetailPage() {
  const params = useParams();
  const taskId = params.id as string;

  // State
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [runDialogMode, setRunDialogMode] = useState<"run" | "retry" | "auto-retry">("run");

  // Hooks
  const { task, isLoading, error, refetch } = useTask(taskId);
  const { runTask, cancelTask, retryTask, autoRetryTask, isActing } = useTaskActions();

  // Handlers
  const handleRun = () => {
    setRunDialogMode("run");
    setRunDialogOpen(true);
  };

  const handleRetry = () => {
    setRunDialogMode("retry");
    setRunDialogOpen(true);
  };

  const handleAutoRetry = () => {
    setRunDialogMode("auto-retry");
    setRunDialogOpen(true);
  };

  const handleRunConfirm = async (workingDirectory: string) => {
    if (runDialogMode === "run") {
      await runTask(taskId, workingDirectory);
    } else if (runDialogMode === "auto-retry") {
      await autoRetryTask(taskId, workingDirectory);
    } else {
      await retryTask(taskId, workingDirectory);
    }
    setRunDialogOpen(false);
    refetch();
  };

  const handleCancel = async () => {
    await cancelTask(taskId);
    refetch();
  };

  // Loading state
  if (isLoading) {
    return (
      <MainLayout title="Task Details">
        <div className="flex h-64 items-center justify-center">
          <div className="flex items-center gap-3 text-zinc-400">
            <Activity className="h-5 w-5 animate-pulse" />
            <span>Loading task...</span>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Error state
  if (error || !task) {
    return (
      <MainLayout title="Task Details">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <h2 className="mt-4 text-xl font-semibold text-zinc-100">
            {error === "Task not found" ? "Task Not Found" : "Error Loading Task"}
          </h2>
          <p className="mt-2 text-zinc-400">
            {error || "The task you're looking for doesn't exist."}
          </p>
          <a
            href="/tasks"
            className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Back to Tasks
          </a>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title={task.title}>
      <div className="space-y-6">
        {/* Header */}
        <TaskHeader
          task={task}
          onRun={handleRun}
          onCancel={handleCancel}
          onRetry={handleRetry}
          onAutoRetry={handleAutoRetry}
          isActing={isActing}
        />

        {/* Main Content - Two Column Layout */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left: Description (2/3) */}
          <div className="lg:col-span-2">
            <TaskDescription task={task} />
          </div>

          {/* Right: Verification History (1/3) */}
          <div className="lg:col-span-1">
            <VerificationHistory
              results={task.verificationResults}
              verificationStatus={task.verificationStatus}
            />
          </div>
        </div>

        {/* Related Logs */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50">
          <div className="border-b border-zinc-800 p-4">
            <h3 className="text-sm font-medium text-zinc-100">Related Logs</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Activity logs from agents working on this task
            </p>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {task.logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-10 w-10 text-zinc-700" />
                <p className="mt-3 text-sm text-zinc-500">No logs yet</p>
                <p className="mt-1 text-xs text-zinc-600">
                  Logs will appear when an agent starts working on this task
                </p>
              </div>
            ) : (
              task.logs.map((log) => <LogEntry key={log.id} log={log} />)
            )}
          </div>

          {task.logs.length > 0 && (
            <div className="border-t border-zinc-800 px-4 py-2">
              <p className="text-xs text-zinc-500">
                {task.logs.length} log entries
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Run/Retry Dialog */}
      <RunTaskDialog
        isOpen={runDialogOpen}
        onClose={() => setRunDialogOpen(false)}
        onConfirm={handleRunConfirm}
        taskTitle={task.title}
        mode={runDialogMode}
      />
    </MainLayout>
  );
}
