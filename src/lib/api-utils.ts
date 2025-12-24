import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { isProduction } from "./env";

// ============================================================================
// Response Types
// ============================================================================

export interface ApiSuccessResponse<T> {
  data: T;
}

export interface ApiErrorResponse {
  error: string;
  message: string;
  details?: unknown;
}

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Create a successful JSON response.
 */
export function jsonResponse<T>(
  data: T,
  status = 200
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({ data }, { status });
}

/**
 * Create an error JSON response.
 */
export function errorResponse(
  message: string,
  status = 400,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  const response: ApiErrorResponse = {
    error: message,
    message,
  };

  // Only include details in development
  if (!isProduction && details) {
    response.details = details;
  }

  return NextResponse.json(response, { status });
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Standard error codes and messages.
 */
export const ApiErrors = {
  NOT_FOUND: { message: "Resource not found", status: 404 },
  BAD_REQUEST: { message: "Bad request", status: 400 },
  UNAUTHORIZED: { message: "Unauthorized", status: 401 },
  FORBIDDEN: { message: "Forbidden", status: 403 },
  CONFLICT: { message: "Resource conflict", status: 409 },
  INTERNAL_ERROR: { message: "Internal server error", status: 500 },
  VALIDATION_ERROR: { message: "Validation failed", status: 400 },
} as const;

/**
 * Handle common API errors and return appropriate responses.
 * Use this in catch blocks for consistent error handling.
 */
export function handleApiError(
  error: unknown,
  context: string
): NextResponse<ApiErrorResponse> {
  // Log error with context
  console.error(`[${context}] Error:`, error);

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return errorResponse(
      "Validation failed",
      400,
      error.flatten().fieldErrors
    );
  }

  // Handle known error types
  if (error instanceof Error) {
    // Prisma "not found" errors
    if (
      error.message.includes("not found") ||
      error.name === "NotFoundError"
    ) {
      return errorResponse(error.message, 404);
    }

    // Conflict errors
    if (
      error.message.includes("already exists") ||
      error.message.includes("conflict") ||
      error.message.includes("already assigned") ||
      error.name === "ConflictError"
    ) {
      return errorResponse(error.message, 409);
    }

    // Validation errors
    if (
      error.message.includes("invalid") ||
      error.message.includes("required") ||
      error.name === "ValidationError"
    ) {
      return errorResponse(error.message, 400);
    }

    // In production, don't expose internal error details
    if (isProduction) {
      return errorResponse("An unexpected error occurred", 500);
    }

    return errorResponse(error.message, 500);
  }

  // Unknown error type
  return errorResponse("An unexpected error occurred", 500);
}

// ============================================================================
// Request Validation
// ============================================================================

/**
 * Safely parse JSON from a request body.
 * Returns null if parsing fails.
 */
export async function safeParseJson(
  request: Request
): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// ============================================================================
// Common Patterns
// ============================================================================

/**
 * UUID validation regex.
 */
export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Check if a string is a valid UUID.
 */
export function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Validate a partial UUID (first 8 characters) and expand it.
 * Returns the full ID if found, or null.
 */
export function normalizeId(id: string): string {
  // If already a full UUID, return as-is
  if (isValidUuid(id)) {
    return id;
  }

  // Otherwise return the partial ID (for prefix matching)
  return id;
}
