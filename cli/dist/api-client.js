import chalk from "chalk";
import { loadConfig } from "./config.js";
// ============================================================================
// API Client Class
// ============================================================================
export class ApiClient {
    baseUrl;
    config;
    constructor() {
        this.config = loadConfig();
        this.baseUrl = this.config.apiUrl;
    }
    // ==========================================================================
    // Private Methods
    // ==========================================================================
    async request(method, path, body) {
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
                const error = data;
                throw new Error(error.message || error.error || `HTTP ${response.status}`);
            }
            return data.data;
        }
        catch (error) {
            if (error instanceof TypeError && error.message.includes("fetch")) {
                throw new Error(`Cannot connect to API at ${this.baseUrl}. Is the server running?`);
            }
            throw error;
        }
    }
    // ==========================================================================
    // Dashboard
    // ==========================================================================
    async getDashboardStats() {
        return this.request("GET", "/api/dashboard");
    }
    // ==========================================================================
    // Agents
    // ==========================================================================
    async getAgents() {
        return this.request("GET", "/api/agents");
    }
    async getAgent(id) {
        return this.request("GET", `/api/agents/${id}`);
    }
    async spawnAgent(taskId, workingDir) {
        return this.request("POST", "/api/agents/spawn", { taskId, workingDir });
    }
    async stopAgent(id) {
        return this.request("PATCH", `/api/agents/${id}`, {
            action: "stop",
        });
    }
    async pauseAgent(id) {
        return this.request("PATCH", `/api/agents/${id}`, {
            action: "pause",
        });
    }
    async resumeAgent(id) {
        return this.request("PATCH", `/api/agents/${id}`, {
            action: "resume",
        });
    }
    async getAgentLogs(agentId, options = {}) {
        const params = new URLSearchParams();
        if (options.limit)
            params.set("limit", options.limit.toString());
        if (options.offset)
            params.set("offset", options.offset.toString());
        const query = params.toString();
        const path = `/api/agents/${agentId}/logs${query ? `?${query}` : ""}`;
        return this.request("GET", path);
    }
    // ==========================================================================
    // Tasks
    // ==========================================================================
    async getTasks() {
        return this.request("GET", "/api/tasks");
    }
    async getTask(id) {
        return this.request("GET", `/api/tasks/${id}`);
    }
    async createTask(task) {
        return this.request("POST", "/api/tasks", task);
    }
    async runTask(taskId, workingDir) {
        return this.request("POST", `/api/tasks/${taskId}/run`, { workingDir });
    }
    async retryTask(taskId, workingDir) {
        return this.request("POST", `/api/tasks/${taskId}/retry`, { workingDir });
    }
    async autoRetryTask(taskId, workingDir) {
        return this.request("POST", `/api/tasks/${taskId}/auto-retry`, { workingDir });
    }
    async cancelTask(taskId) {
        return this.request("PATCH", `/api/tasks/${taskId}`, {
            status: "CANCELLED",
        });
    }
    async updateTask(taskId, updates) {
        return this.request("PATCH", `/api/tasks/${taskId}`, updates);
    }
    // ==========================================================================
    // Queue / Batch Operations
    // ==========================================================================
    async getQueueStatus() {
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
let apiClientInstance = null;
export function getApiClient() {
    if (!apiClientInstance) {
        apiClientInstance = new ApiClient();
    }
    return apiClientInstance;
}
// ============================================================================
// Error Handler
// ============================================================================
export function handleApiError(error) {
    if (error instanceof Error) {
        console.error(chalk.red(`\nError: ${error.message}\n`));
    }
    else {
        console.error(chalk.red("\nAn unexpected error occurred\n"));
    }
    process.exit(1);
}
//# sourceMappingURL=api-client.js.map