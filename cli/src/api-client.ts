import chalk from "chalk";

import { loadConfig, type SwarmConfig } from "./config.js";

// ============================================================================
// Types
// ============================================================================

export interface Agent {
  id: string;
  name: string;
  status: string;
  currentTaskId: string | null;
  currentTask?: {
    id: string;
    title: string;
    status: string;
  } | null;
  totalTokensUsed: number;
  tasksCompleted: number;
  tasksFailed: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  lastActivityAt: string | null;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  riskLevel: string;
  assignedAgentId: string | null;
  assignedAgent?: {
    id: string;
    name: string;
    status: string;
  } | null;
  retryCount: number;
  verificationStatus: string | null;
  verificationAttempts: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface AgentLog {
  id: string;
  agentId: string;
  taskId: string | null;
  logType: string;
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface DashboardStats {
  totalAgents: number;
  activeAgents: number;
  idleAgents: number;
  totalTasks: number;
  pendingTasks: number;
  completedTasks: number;
  failedTasks: number;
  openExceptions: number;
}

export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: string;
  message: string;
}

// ============================================================================
// API Client Class
// ============================================================================

export class ApiClient {
  private baseUrl: string;
  private config: SwarmConfig;

  constructor() {
    this.config = loadConfig();
    this.baseUrl = this.config.apiUrl;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        const error = data as ApiError;
        throw new Error(error.message || error.error || `HTTP ${response.status}`);
      }

      return (data as ApiResponse<T>).data;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new Error(
          `Cannot connect to API at ${this.baseUrl}. Is the server running?`
        );
      }
      throw error;
    }
  }

  // ==========================================================================
  // Dashboard
  // ==========================================================================

  async getDashboardStats(): Promise<DashboardStats> {
    return this.request<DashboardStats>("GET", "/api/dashboard");
  }

  // ==========================================================================
  // Agents
  // ==========================================================================

  async getAgents(): Promise<Agent[]> {
    return this.request<Agent[]>("GET", "/api/agents");
  }

  async getAgent(id: string): Promise<Agent> {
    return this.request<Agent>("GET", `/api/agents/${id}`);
  }

  async spawnAgent(
    taskId: string,
    workingDir: string
  ): Promise<{ agentId: string; taskId: string }> {
    return this.request<{ agentId: string; taskId: string }>(
      "POST",
      "/api/agents/spawn",
      { taskId, workingDir }
    );
  }

  async stopAgent(id: string): Promise<Agent> {
    return this.request<Agent>("PATCH", `/api/agents/${id}`, {
      action: "stop",
    });
  }

  async pauseAgent(id: string): Promise<Agent> {
    return this.request<Agent>("PATCH", `/api/agents/${id}`, {
      action: "pause",
    });
  }

  async resumeAgent(id: string): Promise<Agent> {
    return this.request<Agent>("PATCH", `/api/agents/${id}`, {
      action: "resume",
    });
  }

  async getAgentLogs(
    agentId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<AgentLog[]> {
    const params = new URLSearchParams();
    if (options.limit) params.set("limit", options.limit.toString());
    if (options.offset) params.set("offset", options.offset.toString());

    const query = params.toString();
    const path = `/api/agents/${agentId}/logs${query ? `?${query}` : ""}`;

    return this.request<AgentLog[]>("GET", path);
  }

  // ==========================================================================
  // Tasks
  // ==========================================================================

  async getTasks(): Promise<Task[]> {
    return this.request<Task[]>("GET", "/api/tasks");
  }

  async getTask(id: string): Promise<Task> {
    return this.request<Task>("GET", `/api/tasks/${id}`);
  }

  async createTask(task: {
    title: string;
    description: string;
    priority?: number;
    riskLevel?: string;
    filesHint?: string[];
  }): Promise<Task> {
    return this.request<Task>("POST", "/api/tasks", task);
  }

  async runTask(
    taskId: string,
    workingDir: string
  ): Promise<{ agentId: string; taskId: string }> {
    return this.request<{ agentId: string; taskId: string }>(
      "POST",
      `/api/tasks/${taskId}/run`,
      { workingDir }
    );
  }

  async retryTask(
    taskId: string,
    workingDir: string
  ): Promise<{ agentId: string; task: Task }> {
    return this.request<{ agentId: string; task: Task }>(
      "POST",
      `/api/tasks/${taskId}/retry`,
      { workingDir }
    );
  }

  async autoRetryTask(
    taskId: string,
    workingDir: string
  ): Promise<{ agentId: string; task: Task; retryInfo: unknown }> {
    return this.request<{ agentId: string; task: Task; retryInfo: unknown }>(
      "POST",
      `/api/tasks/${taskId}/auto-retry`,
      { workingDir }
    );
  }

  async cancelTask(taskId: string): Promise<Task> {
    return this.request<Task>("PATCH", `/api/tasks/${taskId}`, {
      status: "CANCELLED",
    });
  }

  async updateTask(
    taskId: string,
    updates: Partial<Task>
  ): Promise<Task> {
    return this.request<Task>("PATCH", `/api/tasks/${taskId}`, updates);
  }

  // ==========================================================================
  // Queue / Batch Operations
  // ==========================================================================

  async getQueueStatus(): Promise<{
    queued: number;
    inProgress: number;
    tasks: Task[];
  }> {
    const tasks = await this.getTasks();

    const queued = tasks.filter((t) => t.status === "QUEUED");
    const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS");

    return {
      queued: queued.length,
      inProgress: inProgress.length,
      tasks: [...queued, ...inProgress],
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let apiClientInstance: ApiClient | null = null;

export function getApiClient(): ApiClient {
  if (!apiClientInstance) {
    apiClientInstance = new ApiClient();
  }
  return apiClientInstance;
}

// ============================================================================
// Error Handler
// ============================================================================

export function handleApiError(error: unknown): never {
  if (error instanceof Error) {
    console.error(chalk.red(`\nError: ${error.message}\n`));
  } else {
    console.error(chalk.red("\nAn unexpected error occurred\n"));
  }
  process.exit(1);
}
