/**
 * API Security Utilities
 *
 * Provides rate limiting and security headers for API routes.
 */

import { NextResponse } from "next/server";
import {
  checkRateLimit,
  getClientIdentifier,
  RATE_LIMITS,
  RateLimitConfig,
} from "./rate-limit";

/**
 * Apply rate limiting to an API request
 * Returns a 429 response if rate limit exceeded, null otherwise
 */
export function applyRateLimit(
  request: Request,
  config: RateLimitConfig = RATE_LIMITS.standard,
  identifier?: string
): NextResponse | null {
  const clientId = identifier || getClientIdentifier(request);
  const result = checkRateLimit(clientId, config);

  if (!result.success) {
    const response = NextResponse.json(
      {
        error: "Too many requests",
        message: "Rate limit exceeded. Please slow down.",
        retryAfter: result.reset,
      },
      { status: 429 }
    );

    // Add rate limit headers
    response.headers.set("X-RateLimit-Limit", String(result.limit));
    response.headers.set("X-RateLimit-Remaining", String(result.remaining));
    response.headers.set("X-RateLimit-Reset", String(result.reset));
    response.headers.set("Retry-After", String(result.reset));

    return response;
  }

  return null;
}

/**
 * Add security headers to a response
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  // Prevent caching of sensitive data
  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");

  // Security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");

  return response;
}

/**
 * Create a rate-limited JSON response with security headers
 */
export function secureJsonResponse(
  data: unknown,
  options?: { status?: number }
): NextResponse {
  const response = NextResponse.json(data, options);
  return addSecurityHeaders(response);
}

/**
 * Validate that a request comes from an authenticated agency user
 * Returns an error response if validation fails, null otherwise
 */
export function requireAgencyUser(session: {
  user?: { organizationType?: string };
} | null): NextResponse | null {
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.organizationType !== "AGENCY") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}

export { RATE_LIMITS };
