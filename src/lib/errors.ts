import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { logger } from "./logger";

// ============================================================================
// Error Codes
// ============================================================================

export const ErrorCode = {
  // Client errors (4xx)
  BAD_REQUEST: "BAD_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  RATE_LIMITED: "RATE_LIMITED",

  // Server errors (5xx)
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  DATABASE_ERROR: "DATABASE_ERROR",
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

// ============================================================================
// Custom Error Classes
// ============================================================================

export class ApiError extends Error {
  public readonly code: ErrorCodeType;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(
    code: ErrorCodeType,
    message: string,
    statusCode: number,
    details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(ErrorCode.VALIDATION_ERROR, message, 400, details);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
    super(ErrorCode.NOT_FOUND, message, 404);
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "Authentication required") {
    super(ErrorCode.UNAUTHORIZED, message, 401);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "Access denied") {
    super(ErrorCode.FORBIDDEN, message, 403);
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(ErrorCode.CONFLICT, message, 409, details);
    this.name = "ConflictError";
  }
}

export class RateLimitError extends ApiError {
  public readonly retryAfter: number;

  constructor(retryAfter: number) {
    super(
      ErrorCode.RATE_LIMITED,
      "Too many requests. Please try again later.",
      429
    );
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

export class DatabaseError extends ApiError {
  constructor(message = "Database operation failed") {
    super(ErrorCode.DATABASE_ERROR, message, 500);
    this.name = "DatabaseError";
  }
}

// ============================================================================
// Error Response Type
// ============================================================================

export interface ErrorResponse {
  error: {
    code: ErrorCodeType;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

// ============================================================================
// Error Handler
// ============================================================================

const isProduction = process.env.NODE_ENV === "production";

export function handleError(
  error: unknown,
  context: string,
  requestId?: string
): NextResponse<ErrorResponse> {
  // Log the error
  logger.error(`[${context}] Error occurred`, { requestId }, error);

  // Handle ApiError instances
  if (error instanceof ApiError) {
    const response: ErrorResponse = {
      error: {
        code: error.code,
        message: error.message,
        details: isProduction ? undefined : error.details,
        requestId,
      },
    };

    const headers: HeadersInit = {};
    if (error instanceof RateLimitError) {
      headers["Retry-After"] = String(error.retryAfter);
    }

    return NextResponse.json(response, {
      status: error.statusCode,
      headers,
    });
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const response: ErrorResponse = {
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: "Validation failed",
        details: isProduction ? undefined : error.flatten().fieldErrors,
        requestId,
      },
    };

    return NextResponse.json(response, { status: 400 });
  }

  // Handle Prisma errors
  if (error instanceof Error) {
    // Prisma not found
    if (error.message.includes("not found") || error.name === "NotFoundError") {
      const response: ErrorResponse = {
        error: {
          code: ErrorCode.NOT_FOUND,
          message: isProduction ? "Resource not found" : error.message,
          requestId,
        },
      };
      return NextResponse.json(response, { status: 404 });
    }

    // Prisma unique constraint
    if (error.message.includes("Unique constraint")) {
      const response: ErrorResponse = {
        error: {
          code: ErrorCode.CONFLICT,
          message: isProduction ? "Resource already exists" : error.message,
          requestId,
        },
      };
      return NextResponse.json(response, { status: 409 });
    }
  }

  // Generic error handling
  const response: ErrorResponse = {
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: isProduction
        ? "An unexpected error occurred"
        : error instanceof Error
          ? error.message
          : "Unknown error",
      requestId,
    },
  };

  return NextResponse.json(response, { status: 500 });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Assert a condition and throw a ValidationError if false
 */
export function assertValid(
  condition: boolean,
  message: string,
  details?: unknown
): asserts condition {
  if (!condition) {
    throw new ValidationError(message, details);
  }
}

/**
 * Assert a value exists and throw a NotFoundError if not
 */
export function assertFound<T>(
  value: T | null | undefined,
  resource: string,
  id?: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new NotFoundError(resource, id);
  }
}
