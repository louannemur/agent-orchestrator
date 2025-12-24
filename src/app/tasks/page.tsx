"use client";

import { Plus, RefreshCw } from "lucide-react";
import { useState } from "react";

import { MainLayout } from "@/components/layout";
import {
  CreateTaskDialog,
  RunTaskDialog,
  TaskTable,
} from "@/components/tasks";
import {
  useCreateTask,
  useNotifications,
  useTaskActions,
  useTasks,
  type TaskSortOption,
  type TaskStatusType,
} from "@/hooks";

// ============================================================================
// Tasks Page
// ============================================================================

export default function TasksPage() {
  // Filter and sort state
  const [statusFilter, setStatusFilter] = useState<TaskStatusType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<TaskSortOption>("created");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Dialog state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [runDialogTask, setRunDialogTask] = useState<{
    id: string;
    title: string;
  } | null>(null);

  // Hooks
  const {
    tasks,
    filteredTasks,
    isLoading,
    error,
    refetch,
    pagination,
    totalCount,
  } = useTasks({
    statusFilter,
    searchQuery,
    sortBy,
    sortOrder,
  });

  const { createTask, isCreating } = useCreateTask();
  const { runTask, cancelTask, retryTask, isActing } = useTaskActions();

  // Enable notifications for task changes
  useNotifications({ tasks });

  // Handlers
  const handleCreate = async (input: Parameters<typeof createTask>[0]) => {
    const result = await createTask(input);
    if (result) {
      refetch();
    }
    return result;
  };

  const handleRun = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      setRunDialogTask({ id: task.id, title: task.title });
    }
  };

  const handleRunConfirm = async (taskId: string, workingDir: string) => {
    const success = await runTask(taskId, workingDir);
    if (success) {
      refetch();
    }
    return success;
  };

  const handleCancel = async (taskId: string) => {
    await cancelTask(taskId);
    refetch();
  };

  const handleRetry = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      setRunDialogTask({ id: task.id, title: task.title });
    }
  };

  const handleSortOrderToggle = () => {
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  return (
    <MainLayout title="Tasks">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-medium text-zinc-100">Task Queue</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Manage and monitor tasks assigned to agents
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Refresh Button */}
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
              disabled={isLoading}
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Create Task Button */}
            <button
              onClick={() => setIsCreateDialogOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Create Task
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Task Table */}
        <TaskTable
          tasks={filteredTasks}
          isLoading={isLoading}
          statusFilter={statusFilter}
          searchQuery={searchQuery}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onStatusFilterChange={setStatusFilter}
          onSearchChange={setSearchQuery}
          onSortChange={setSortBy}
          onSortOrderToggle={handleSortOrderToggle}
          onRun={handleRun}
          onCancel={handleCancel}
          onRetry={handleRetry}
          isActing={isActing}
          pagination={pagination}
          totalCount={totalCount}
        />
      </div>

      {/* Create Task Dialog */}
      <CreateTaskDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onCreate={handleCreate}
        isCreating={isCreating}
      />

      {/* Run Task Dialog */}
      <RunTaskDialog
        isOpen={!!runDialogTask}
        taskId={runDialogTask?.id || null}
        taskTitle={runDialogTask?.title || ""}
        onClose={() => setRunDialogTask(null)}
        onRun={handleRunConfirm}
        isRunning={isActing}
      />
    </MainLayout>
  );
}
