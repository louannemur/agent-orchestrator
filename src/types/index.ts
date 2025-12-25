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

/**
 * JSON Schema definition for tool input validation.
 * Used to define the expected structure of tool parameters.
 */
export interface JsonSchema {
  /** The data type (string, object, array, number, boolean) */
  type: string;
  /** Property definitions for object types */
  properties?: Record<string, JsonSchema>;
  /** List of required property names */
  required?: string[];
  /** Schema for array item types */
  items?: JsonSchema;
  /** Human-readable description of the property */
  description?: string;
  /** Allowed values for enum types */
  enum?: string[];
  /** Default value if not provided */
  default?: unknown;
}

/**
 * Definition of a tool available to AI agents.
 * Tools allow agents to interact with the filesystem, run commands, etc.
 */
export interface AgentTool {
  /** Unique identifier for the tool */
  name: string;
  /** Human-readable description of what the tool does */
  description: string;
  /** JSON Schema defining the expected input parameters */
  input_schema: JsonSchema;
}

/**
 * Result returned from executing a tool.
 */
export interface ToolResult {
  /** Whether the tool execution succeeded */
  success: boolean;
  /** Output from the tool (stdout for commands, content for file reads) */
  output: string;
  /** Error message if the tool failed */
  error?: string;
}

// ============================================================================
// Verification Types
// ============================================================================

/**
 * An error detected during code verification.
 */
export interface VerificationError {
  /** The type of check that detected the error */
  type: "syntax" | "type" | "lint" | "test" | "semantic";
  /** Human-readable error message */
  message: string;
  /** File path where the error occurred */
  file?: string;
  /** Line number in the file */
  line?: number;
}

/**
 * Result of running a single verification check.
 */
export interface VerificationCheckResult {
  /** Whether the check passed */
  passed: boolean;
  /** List of errors detected (empty if passed) */
  errors: VerificationError[];
}

// ============================================================================
// Agent Configuration
// ============================================================================

/**
 * Configuration for spawning an AI agent.
 */
export interface AgentConfig {
  /** ID of the task to work on */
  taskId: string;
  /** Absolute path to the project directory */
  workingDir: string;
  /** Git branch name for this task */
  branchName: string;
  /** Maximum number of iterations before stopping (default: 50) */
  maxIterations?: number;
}

/** Default maximum iterations for agent execution */
export const DEFAULT_MAX_ITERATIONS = 50;

// ============================================================================
// API Request Types
// ============================================================================

/**
 * Request body for spawning a new agent.
 */
export interface SpawnAgentRequest {
  /** ID of the task to assign to the agent */
  taskId: string;
  /** Absolute path to the project directory */
  workingDir: string;
}

/**
 * Request body for creating a new task.
 */
export interface CreateTaskRequest {
  /** Brief title describing the task (max 500 chars) */
  title: string;
  /** Detailed description of what needs to be done */
  description: string;
  /** Priority level (0=urgent, 1=high, 2=normal, 3=low) */
  priority?: number;
  /** Risk level for code changes */
  riskLevel?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  /** Hints about which files might need changes */
  filesHint?: string[];
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Paginated list response wrapper.
 */
export interface PaginatedResponse<T> {
  /** Array of items for the current page */
  data: T[];
  /** Pagination metadata */
  pagination: {
    /** Number of items per page */
    limit: number;
    /** Offset from the start */
    offset: number;
    /** Total number of items across all pages */
    totalCount: number;
    /** Whether there are more items */
    hasMore: boolean;
  };
}

/**
 * Standard API success response wrapper.
 */
export interface ApiResponse<T> {
  /** Response payload */
  data: T;
}

/**
 * Standard API error response.
 */
export interface ApiErrorResponse {
  /** Error details */
  error: {
    /** Machine-readable error code */
    code: string;
    /** Human-readable error message */
    message: string;
    /** Additional error details (dev only) */
    details?: unknown;
    /** Request ID for tracing */
    requestId?: string;
  };
}

// ============================================================================
// Dashboard Types
// ============================================================================

/**
 * Aggregated statistics for the dashboard.
 */
export interface DashboardStats {
  /** Agent counts by status */
  agents: {
    total: number;
    working: number;
    idle: number;
    paused: number;
    failed: number;
    stuck: number;
  };
  /** Task counts by status */
  tasks: {
    total: number;
    queued: number;
    inProgress: number;
    completed: number;
    failed: number;
    verifying: number;
    cancelled: number;
  };
  /** Exception statistics */
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
  /** Performance metrics */
  performance: {
    /** Average task completion time in milliseconds */
    avgCompletionTime: number | null;
    /** Percentage of tasks completed successfully */
    successRate: number | null;
    /** Tasks completed today */
    todayCompleted: number;
    /** Tasks failed today */
    todayFailed: number;
  };
}

// ============================================================================
// WebSocket Types
// ============================================================================

/** Types of real-time update messages */
export type WebSocketMessageType =
  | "agent_update"
  | "task_update"
  | "exception"
  | "log";

/**
 * Real-time update message from WebSocket.
 */
export interface WebSocketMessage<T = unknown> {
  /** Type of update */
  type: WebSocketMessageType;
  /** Update payload */
  payload: T;
  /** ISO timestamp of when the message was created */
  timestamp: string;
}

// ============================================================================
// UI State Types
// ============================================================================

/**
 * Generic async state for data fetching.
 */
export interface AsyncState<T> {
  /** The data (if successfully loaded) */
  data: T | null;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Error message (if fetch failed) */
  error: string | null;
}

/**
 * Filter options for list views.
 */
export interface ListFilters {
  /** Search query string */
  search?: string;
  /** Status filter */
  status?: string;
  /** Sort field */
  sortBy?: string;
  /** Sort direction */
  sortOrder?: "asc" | "desc";
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
