import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { ExceptionStatus } from "@/types";

// ============================================================================
// Response Helpers
// ============================================================================

function jsonResponse<T>(
  data: T,
  status = 200
): NextResponse<{ data: T }> {
  return NextResponse.json({ data }, { status });
}

function errorResponse(
  message: string,
  status = 400
): NextResponse<{ error: string; message: string }> {
  return NextResponse.json({ error: message, message }, { status });
}

// ============================================================================
// Schemas
// ============================================================================

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const patchSchema = z.object({
  status: z.enum([
    ExceptionStatus.ACKNOWLEDGED,
    ExceptionStatus.RESOLVED,
    ExceptionStatus.DISMISSED,
  ]),
  resolutionNotes: z.string().max(5000).optional(),
  resolvedBy: z.string().max(255).optional(),
});

// ============================================================================
// GET /api/exceptions/:id
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate params
    const parseResult = paramsSchema.safeParse({ id });
    if (!parseResult.success) {
      return errorResponse("Invalid exception ID format", 400);
    }

    // Fetch exception with related data
    const exception = await db.exception.findUnique({
      where: { id },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            status: true,
            branchName: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            branchName: true,
          },
        },
      },
    });

    if (!exception) {
      return errorResponse("Exception not found", 404);
    }

    return jsonResponse(exception);
  } catch (error) {
    console.error("[GET /api/exceptions/:id] Error:", error);
    return errorResponse("Failed to fetch exception", 500);
  }
}

// ============================================================================
// PATCH /api/exceptions/:id
// ============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate params
    const paramsResult = paramsSchema.safeParse({ id });
    if (!paramsResult.success) {
      return errorResponse("Invalid exception ID format", 400);
    }

    // Parse and validate body
    const body = await request.json();
    const bodyResult = patchSchema.safeParse(body);

    if (!bodyResult.success) {
      return errorResponse(
        `Invalid request body: ${bodyResult.error.message}`,
        400
      );
    }

    const { status, resolutionNotes, resolvedBy } = bodyResult.data;

    // Check exception exists
    const exception = await db.exception.findUnique({
      where: { id },
    });

    if (!exception) {
      return errorResponse("Exception not found", 404);
    }

    // Check if already resolved
    if (exception.status === ExceptionStatus.RESOLVED) {
      return errorResponse("Exception is already resolved", 409);
    }

    // Build update data
    const updateData: {
      status: ExceptionStatus;
      resolutionNotes?: string;
      resolvedBy?: string;
      resolvedAt?: Date;
    } = { status };

    if (resolutionNotes) {
      updateData.resolutionNotes = resolutionNotes;
    }

    if (resolvedBy) {
      updateData.resolvedBy = resolvedBy;
    }

    // Set resolvedAt for RESOLVED status
    if (status === ExceptionStatus.RESOLVED) {
      updateData.resolvedAt = new Date();
    }

    // Update exception
    const updatedException = await db.exception.update({
      where: { id },
      data: updateData,
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
    });

    return jsonResponse(updatedException);
  } catch (error) {
    console.error("[PATCH /api/exceptions/:id] Error:", error);
    return errorResponse("Failed to update exception", 500);
  }
}
