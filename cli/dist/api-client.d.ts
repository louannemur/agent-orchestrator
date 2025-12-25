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
export declare class ApiClient {
    private baseUrl;
    private config;
    constructor();
    private request;
    getDashboardStats(): Promise<DashboardStats>;
    getAgents(): Promise<Agent[]>;
    getAgent(id: string): Promise<Agent>;
    spawnAgent(taskId: string, workingDir: string): Promise<{
        agentId: string;
        taskId: string;
    }>;
    stopAgent(id: string): Promise<Agent>;
    pauseAgent(id: string): Promise<Agent>;
    resumeAgent(id: string): Promise<Agent>;
    getAgentLogs(agentId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<AgentLog[]>;
    getTasks(): Promise<Task[]>;
    getTask(id: string): Promise<Task>;
    createTask(task: {
        title: string;
        description: string;
        priority?: number;
        riskLevel?: string;
        filesHint?: string[];
    }): Promise<Task>;
    runTask(taskId: string, workingDir: string): Promise<{
        agentId: string;
        taskId: string;
    }>;
    retryTask(taskId: string, workingDir: string): Promise<{
        agentId: string;
        task: Task;
    }>;
    autoRetryTask(taskId: string, workingDir: string): Promise<{
        agentId: string;
        task: Task;
        retryInfo: unknown;
    }>;
    cancelTask(taskId: string): Promise<Task>;
    updateTask(taskId: string, updates: Partial<Task>): Promise<Task>;
    getQueueStatus(): Promise<{
        queued: number;
        inProgress: number;
        tasks: Task[];
    }>;
}
export declare function getApiClient(): ApiClient;
export declare function handleApiError(error: unknown): never;
//# sourceMappingURL=api-client.d.ts.map