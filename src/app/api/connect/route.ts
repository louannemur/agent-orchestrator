import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";

import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// ============================================================================
// Response Helpers
// ============================================================================

function jsonResponse<T>(data: T, status = 200): NextResponse<{ data: T }> {
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

const connectSchema = z.object({
  setupToken: z.string().min(1),
});

// ============================================================================
// GET /api/connect
// Generate a new setup token for dashboard display
// ============================================================================

export async function GET() {
  try {
    // Generate a random setup token
    const setupToken = randomBytes(32).toString("hex");

    // Store it temporarily (expires in 10 minutes)
    // We'll use a simple in-memory approach with the token itself containing expiry
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    const tokenData = `${setupToken}:${expiresAt}`;

    // Get the API URL from environment or use a default
    const apiUrl = process.env.NEXT_PUBLIC_APP_URL ||
                   process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` :
                   "http://localhost:3000";

    // Create the connection token (base64 encoded apiUrl|setupToken)
    const connectionToken = Buffer.from(`${apiUrl}|${tokenData}`).toString("base64");

    return jsonResponse({
      connectionToken,
      expiresIn: 600, // 10 minutes in seconds
      command: `agent-orchestrator connect ${connectionToken}`,
    });
  } catch (error) {
    console.error("[GET /api/connect] Error:", error);
    return errorResponse("Failed to generate connection token", 500);
  }
}

// ============================================================================
// POST /api/connect
// Validate setup token and create runner session
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = connectSchema.safeParse(body);

    if (!result.success) {
      return errorResponse(`Invalid request: ${result.error.message}`, 400);
    }

    const { setupToken } = result.data;

    // Parse the token (format: randomToken:expiresAt)
    const parts = setupToken.split(":");
    if (parts.length !== 2 || !parts[1]) {
      return errorResponse("Invalid token format", 400);
    }

    const expiresAtStr = parts[1];
    const expiresAt = parseInt(expiresAtStr, 10);

    if (isNaN(expiresAt) || Date.now() > expiresAt) {
      return errorResponse("Token has expired", 400);
    }

    // Generate runner name
    const runnerName = `runner-${Date.now().toString(36)}`;

    // Create a new runner session
    const session = await db.runnerSession.create({
      data: {
        token: randomBytes(32).toString("hex"),
        name: runnerName,
        workingDir: "",
        isActive: true,
      },
    });

    return jsonResponse({
      runnerToken: session.token,
      runnerName: session.name,
    });
  } catch (error) {
    console.error("[POST /api/connect] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to connect";
    return errorResponse(message, 500);
  }
}
