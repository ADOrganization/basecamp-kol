/**
 * Rate Limiting Utility
 *
 * In-memory rate limiter for API protection.
 * For production with multiple instances, consider using Redis/Upstash.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store (per-instance, cleared on restart)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute

export interface RateLimitConfig {
  // Maximum requests allowed in the window
  limit: number;
  // Window duration in milliseconds
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Check rate limit for a given identifier (usually IP or user ID)
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const key = identifier;

  let entry = rateLimitStore.get(key);

  // If no entry or expired, create new one
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(key, entry);
  }

  // Increment count
  entry.count++;

  const remaining = Math.max(0, config.limit - entry.count);
  const reset = Math.ceil((entry.resetTime - now) / 1000);

  return {
    success: entry.count <= config.limit,
    limit: config.limit,
    remaining,
    reset,
  };
}

/**
 * Get client identifier from request
 * SECURITY: In production (Vercel), trust X-Forwarded-For from Vercel's proxy
 * In development, use fallback identifier
 */
export function getClientIdentifier(request: Request): string {
  // SECURITY: Only trust X-Forwarded-For in production where we know
  // Vercel/Cloudflare strips and sets this header correctly.
  // The rightmost IP is typically the client IP when behind trusted proxies.
  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) {
    // SECURITY: Vercel/Cloudflare set the real client IP as the FIRST value
    // When requests pass through multiple proxies, format is: client, proxy1, proxy2
    // We take the first value which is the original client
    const ips = forwarded.split(",").map((ip) => ip.trim());
    const clientIp = ips[0];

    // SECURITY: Validate IP format to prevent header injection
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$/;

    if (ipv4Regex.test(clientIp) || ipv6Regex.test(clientIp)) {
      return clientIp;
    }

    // If IP format is invalid, use hash of the header to still provide rate limiting
    // but prevent potential injection attacks
    console.warn(`[Rate Limit] Invalid IP format in X-Forwarded-For: ${clientIp.substring(0, 50)}`);
  }

  // SECURITY: Also try X-Real-IP header (used by some proxies)
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipv4Regex.test(realIp.trim())) {
      return realIp.trim();
    }
  }

  // Fallback - in serverless environments this may not be available
  // Use a combination of available headers to create a fingerprint
  const userAgent = request.headers.get("user-agent") || "";
  const acceptLang = request.headers.get("accept-language") || "";

  // Create a simple fingerprint to at least group similar requests
  if (userAgent || acceptLang) {
    return `fingerprint:${Buffer.from(userAgent + acceptLang).toString("base64").substring(0, 32)}`;
  }

  return "unknown";
}

// Preset configurations for different endpoint types
export const RATE_LIMITS = {
  // Standard API endpoints - 100 requests per minute
  standard: { limit: 100, windowMs: 60 * 1000 },

  // Sensitive data endpoints - 15 requests per minute
  sensitive: { limit: 15, windowMs: 60 * 1000 },

  // KOL roster - VERY strict to prevent scraping (10 requests per 5 minutes)
  // With 50 KOLs per page max, this limits to 500 KOL records per 5 minutes
  kolRoster: { limit: 10, windowMs: 5 * 60 * 1000 },

  // Heavy operations (refresh metrics, scraping) - 5 requests per minute
  heavy: { limit: 5, windowMs: 60 * 1000 },

  // Auth endpoints - 10 requests per minute to prevent brute force
  auth: { limit: 10, windowMs: 60 * 1000 },

  // Magic link requests - 5 per minute per IP (prevent spam)
  magicLink: { limit: 5, windowMs: 60 * 1000 },

  // Magic link callbacks - 10 per minute per IP
  magicLinkCallback: { limit: 10, windowMs: 60 * 1000 },

  // User invitations - 10 per minute per org (prevent spam)
  invite: { limit: 10, windowMs: 60 * 1000 },

  // Failed auth attempts - strict limit per IP
  authFailed: { limit: 5, windowMs: 5 * 60 * 1000 }, // 5 attempts per 5 minutes

  // SECURITY: Broadcast messages - very strict to prevent spam (3 per minute)
  broadcast: { limit: 3, windowMs: 60 * 1000 },

  // SECURITY: Individual telegram messages - moderate limit (30 per minute)
  messaging: { limit: 30, windowMs: 60 * 1000 },

  // SECURITY: Email resend - prevent email spam (5 per 5 minutes)
  emailResend: { limit: 5, windowMs: 5 * 60 * 1000 },

  // SECURITY: File uploads - prevent storage abuse (10 per minute)
  fileUpload: { limit: 10, windowMs: 60 * 1000 },

  // SECURITY: Webhook endpoints - higher limit for automated systems
  webhook: { limit: 200, windowMs: 60 * 1000 },
} as const;
