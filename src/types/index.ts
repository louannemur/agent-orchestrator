import { z } from "zod";

// ============================================================================
// Re-export Prisma types
// ============================================================================

export type {
  Agent,
  Task,
  FileLock,
  VerificationResult,
  AgentLog,
  Exception,
} from "@prisma/client";

export {
  AgentStatus,
  TaskStatus,
  RiskLevel,
  VerificationStatus,
  TaskComplexity,
  LogType,
  ExceptionType,
  ExceptionSeverity,
  ExceptionStatus,
} from "@prisma/client";

// ============================================================================
// Agent Tool Types
// ============================================================================

export interface JsonSchema {
  type: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  description?: string;
  enum?: string[];
  default?: unknown;
}

export interface AgentTool {
  name: string;
  description: string;
  input_schema: JsonSchema;
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

// ============================================================================
// Verification Types
// ============================================================================

export interface VerificationError {
  type: "syntax" | "type" | "lint" | "test" | "semantic";
  message: string;
  file?: string;
  line?: number;
}

export interface VerificationCheckResult {
  passed: boolean;
  errors: VerificationError[];
}

// ============================================================================
// Agent Configuration
// ============================================================================

export interface AgentConfig {
  taskId: string;
  workingDir: string;
  branchName: string;
  maxIterations?: number;
}

export const DEFAULT_MAX_ITERATIONS = 50;

// ============================================================================
// API Request Types
// ============================================================================

export interface SpawnAgentRequest {
  taskId: string;
  workingDir: string;
}

export interface CreateTaskRequest {
  title: string;
  description: string;
  priority?: number;
  riskLevel?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  filesHint?: string[];
}

// ============================================================================
// Dashboard Types (API Response)
// ============================================================================

export interface DashboardStats {
  agents: {
    total: number;
    working: number;
    idle: number;
    paused: number;
    failed: number;
    stuck: number;
  };
  tasks: {
    total: number;
    queued: number;
    inProgress: number;
    completed: number;
    failed: number;
    verifying: number;
    cancelled: number;
  };
  exceptions: {
    total: number;
    unresolved: number;
    bySeverity: {
      critical: number;
      error: number;
      warning: number;
      info: number;
    };
  };
  performance: {
    avgCompletionTime: number | null;
    successRate: number | null;
    todayCompleted: number;
    todayFailed: number;
  };
}

// ============================================================================
// WebSocket Types
// ============================================================================

export type WebSocketMessageType =
  | "agent_update"
  | "task_update"
  | "exception"
  | "log";

export interface WebSocketMessage<T = unknown> {
  type: WebSocketMessageType;
  payload: T;
  timestamp: string;
}

// ============================================================================
// Zod Schemas for Request Validation
// ============================================================================

export const spawnAgentRequestSchema = z.object({
  taskId: z.string().uuid(),
  workingDir: z.string().min(1),
});

export const createTaskRequestSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().min(1),
  priority: z.number().int().min(0).max(3).optional().default(2),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional().default("MEDIUM"),
  filesHint: z.array(z.string()).optional().default([]),
});

export const agentConfigSchema = z.object({
  taskId: z.string().uuid(),
  workingDir: z.string().min(1),
  branchName: z.string().min(1),
  maxIterations: z.number().int().positive().optional().default(DEFAULT_MAX_ITERATIONS),
});

export const webSocketMessageSchema = z.object({
  type: z.enum(["agent_update", "task_update", "exception", "log"]),
  payload: z.unknown(),
  timestamp: z.string().datetime(),
});

// ============================================================================
// Inferred Types from Zod Schemas
// ============================================================================

export type SpawnAgentRequestValidated = z.infer<typeof spawnAgentRequestSchema>;
export type CreateTaskRequestValidated = z.infer<typeof createTaskRequestSchema>;
export type AgentConfigValidated = z.infer<typeof agentConfigSchema>;
export type WebSocketMessageValidated = z.infer<typeof webSocketMessageSchema>;
