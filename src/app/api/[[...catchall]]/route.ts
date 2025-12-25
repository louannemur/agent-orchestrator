import { NextRequest, NextResponse } from "next/server";

import { ErrorCode, ErrorResponse } from "@/lib/errors";

// ============================================================================
// Catch-All Route Handler
// ============================================================================

function createNotFoundResponse(
  request: NextRequest
): NextResponse<ErrorResponse> {
  const requestId = request.headers.get("x-request-id") || undefined;
  const path = request.nextUrl.pathname;
  const method = request.method;

  return NextResponse.json(
    {
      error: {
        code: ErrorCode.NOT_FOUND,
        message: `Cannot ${method} ${path}`,
        details: {
          availableEndpoints: [
            "GET /api/health",
            "GET /api/agents",
            "GET /api/agents/:id",
            "GET /api/tasks",
            "POST /api/tasks",
            "GET /api/tasks/:id",
            "PATCH /api/tasks/:id",
            "DELETE /api/tasks/:id",
            "GET /api/exceptions",
            "GET /api/exceptions/:id",
            "PATCH /api/exceptions/:id",
            "GET /api/locks",
            "POST /api/locks/check",
            "GET /api/dashboard/stats",
          ],
          documentation: "See /api/health for API status",
        },
        requestId,
      },
    },
    { status: 404 }
  );
}

// Handle all HTTP methods
export async function GET(request: NextRequest) {
  return createNotFoundResponse(request);
}

export async function POST(request: NextRequest) {
  return createNotFoundResponse(request);
}

export async function PUT(request: NextRequest) {
  return createNotFoundResponse(request);
}

export async function PATCH(request: NextRequest) {
  return createNotFoundResponse(request);
}

export async function DELETE(request: NextRequest) {
  return createNotFoundResponse(request);
}

export async function OPTIONS(request: NextRequest) {
  return createNotFoundResponse(request);
}
