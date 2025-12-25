import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// Configuration
// ============================================================================

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // requests per window
const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED !== "false";

// In-memory rate limit store (resets on cold starts, suitable for MVP)
const rateLimitStore = new Map<
  string,
  { count: number; resetTime: number }
>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  rateLimitStore.forEach((value, key) => {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  });
}, RATE_LIMIT_WINDOW_MS);

// ============================================================================
// Helper Functions
// ============================================================================

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

function getClientIdentifier(request: NextRequest): string {
  // Try to get real IP from various headers (Vercel, Cloudflare, etc.)
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfConnectingIp = request.headers.get("cf-connecting-ip");

  const ip = cfConnectingIp || realIp || forwardedFor?.split(",")[0]?.trim() || "unknown";

  // Include path prefix for more granular limiting
  const pathPrefix = request.nextUrl.pathname.split("/").slice(0, 3).join("/");

  return `${ip}:${pathPrefix}`;
}

function checkRateLimit(identifier: string): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
} {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || now > entry.resetTime) {
    // Create new entry
    const resetTime = now + RATE_LIMIT_WINDOW_MS;
    rateLimitStore.set(identifier, { count: 1, resetTime });
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX_REQUESTS - 1,
      resetTime,
    };
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - entry.count,
    resetTime: entry.resetTime,
  };
}

function formatLogEntry(
  requestId: string,
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  ip: string
): string {
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    // JSON format for Vercel logs
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level: statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info",
      message: `${method} ${path} ${statusCode}`,
      requestId,
      method,
      path,
      statusCode,
      duration,
      ip,
    });
  }

  // Human-readable format for development
  return `[${new Date().toISOString()}] ${requestId} ${method} ${path} ${statusCode} ${duration}ms`;
}

// ============================================================================
// Middleware
// ============================================================================

export async function middleware(request: NextRequest) {
  const startTime = Date.now();
  const requestId = generateRequestId();
  const method = request.method;
  const path = request.nextUrl.pathname;

  // Skip middleware for static assets and Next.js internals
  if (
    path.startsWith("/_next") ||
    path.startsWith("/favicon") ||
    path.includes(".")
  ) {
    return NextResponse.next();
  }

  // Get client identifier for rate limiting
  const clientId = getClientIdentifier(request);
  const ip = clientId.split(":")[0] || "unknown";

  // Check rate limit for API routes
  if (RATE_LIMIT_ENABLED && path.startsWith("/api/")) {
    const rateLimit = checkRateLimit(clientId);

    if (!rateLimit.allowed) {
      const retryAfter = Math.ceil((rateLimit.resetTime - Date.now()) / 1000);
      const duration = Date.now() - startTime;

      console.log(formatLogEntry(requestId, method, path, 429, duration, ip));

      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests. Please try again later.",
            requestId,
          },
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
            "X-RateLimit-Limit": String(RATE_LIMIT_MAX_REQUESTS),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetTime / 1000)),
            "X-Request-Id": requestId,
          },
        }
      );
    }

    // Add rate limit headers to response
    const response = NextResponse.next();
    response.headers.set("X-RateLimit-Limit", String(RATE_LIMIT_MAX_REQUESTS));
    response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
    response.headers.set(
      "X-RateLimit-Reset",
      String(Math.ceil(rateLimit.resetTime / 1000))
    );
    response.headers.set("X-Request-Id", requestId);

    // Log the request (we'll log on response)
    const duration = Date.now() - startTime;
    console.log(formatLogEntry(requestId, method, path, 200, duration, ip));

    return response;
  }

  // For non-API routes, just add request ID
  const response = NextResponse.next();
  response.headers.set("X-Request-Id", requestId);

  return response;
}

// ============================================================================
// Matcher Configuration
// ============================================================================

export const config = {
  matcher: [
    // Match all API routes
    "/api/:path*",
    // Match all pages (for request ID)
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
