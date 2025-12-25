import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { ExceptionSeverity, ExceptionStatus } from "@/types";

export const dynamic = "force-dynamic";

// ============================================================================
// Response Helpers
// ============================================================================

function jsonResponse<T>(
  data: T,
  status = 200,
  headers?: Record<string, string>
): NextResponse<{ data: T }> {
  return NextResponse.json({ data }, { status, headers });
}

function errorResponse(
  message: string,
  status = 400
): NextResponse<{ error: string; message: string }> {
  return NextResponse.json({ error: message, message }, { status });
}

// ============================================================================
// Query Schema
// ============================================================================

const querySchema = z.object({
  status: z.nativeEnum(ExceptionStatus).optional().default(ExceptionStatus.OPEN),
  severity: z.nativeEnum(ExceptionSeverity).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// Severity order for sorting (highest first)
const SEVERITY_ORDER: Record<ExceptionSeverity, number> = {
  [ExceptionSeverity.CRITICAL]: 0,
  [ExceptionSeverity.ERROR]: 1,
  [ExceptionSeverity.WARNING]: 2,
  [ExceptionSeverity.INFO]: 3,
};

// ============================================================================
// GET /api/exceptions
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse and validate query params
    const queryResult = querySchema.safeParse({
      status: searchParams.get("status") ?? undefined,
      severity: searchParams.get("severity") ?? undefined,
      limit: searchParams.get("limit") ?? 50,
      offset: searchParams.get("offset") ?? 0,
    });

    if (!queryResult.success) {
      return errorResponse(
        `Invalid query parameters: ${queryResult.error.message}`,
        400
      );
    }

    const { status, severity, limit, offset } = queryResult.data;

    // Build where clause
    const where: {
      status?: ExceptionStatus;
      severity?: ExceptionSeverity;
    } = {};

    if (status) where.status = status;
    if (severity) where.severity = severity;

    // Fetch exceptions with related data
    const [exceptions, totalCount] = await Promise.all([
      db.exception.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: [
          { createdAt: "desc" }, // Newest first, will re-sort by severity in memory
        ],
        include: {
          agent: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
          task: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
        },
      }),
      db.exception.count({ where }),
    ]);

    // Sort by severity (highest first), then by createdAt (newest first)
    const sortedExceptions = exceptions.sort((a, b) => {
      const severityDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return jsonResponse(
      {
        exceptions: sortedExceptions,
        pagination: {
          limit,
          offset,
          totalCount,
          hasMore: offset + exceptions.length < totalCount,
        },
      },
      200,
      {
        "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10",
      }
    );
  } catch (error) {
    console.error("[GET /api/exceptions] Error:", error);
    return errorResponse("Failed to fetch exceptions", 500);
  }
}
