/**
 * Security Audit Logging
 *
 * Logs security-relevant events for monitoring and compliance.
 */

import { db } from "./db";

export type AuditAction =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "MAGIC_LINK_SENT"
  | "MAGIC_LINK_USED"
  | "MAGIC_LINK_EXPIRED"
  | "INVITE_SENT"
  | "INVITE_ACCEPTED"
  | "INVITE_REVOKED"
  | "USER_CREATED"
  | "USER_DISABLED"
  | "USER_ENABLED"
  | "PASSWORD_CHANGED"
  | "SESSION_EXPIRED"
  | "RATE_LIMIT_EXCEEDED"
  | "SUSPICIOUS_ACTIVITY"
  | "2FA_SETUP_REQUIRED"
  | "2FA_VERIFICATION_REQUIRED"
  | "2FA_VERIFICATION_FAILED"
  | "BACKUP_CODE_USED";

export interface AuditLogData {
  userId?: string;
  action: AuditAction;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log a security audit event
 */
export async function logSecurityEvent(data: AuditLogData): Promise<void> {
  try {
    await db.securityAuditLog.create({
      data: {
        userId: data.userId || null,
        action: data.action,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
        metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : undefined,
      },
    });
  } catch (error) {
    // Don't let audit logging failures break the app
    console.error("Failed to log security event:", error);
  }
}

/**
 * Get client IP from request headers
 */
export function getClientIP(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }
  return null;
}

/**
 * Get user agent from request headers
 */
export function getUserAgent(request: Request): string | null {
  return request.headers.get("user-agent");
}

/**
 * Helper to extract request metadata for audit logging
 */
export function getRequestMetadata(request: Request): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  return {
    ipAddress: getClientIP(request),
    userAgent: getUserAgent(request),
  };
}

/**
 * Check for suspicious patterns
 */
export async function checkSuspiciousActivity(
  ipAddress: string,
  action: AuditAction
): Promise<boolean> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  // Check for too many failed logins from same IP
  if (action === "LOGIN_FAILED") {
    const failedAttempts = await db.securityAuditLog.count({
      where: {
        action: "LOGIN_FAILED",
        ipAddress,
        createdAt: { gte: fiveMinutesAgo },
      },
    });

    if (failedAttempts >= 10) {
      await logSecurityEvent({
        action: "SUSPICIOUS_ACTIVITY",
        ipAddress,
        metadata: {
          reason: "Too many failed login attempts",
          count: failedAttempts,
        },
      });
      return true;
    }
  }

  // Check for too many magic link requests from same IP
  if (action === "MAGIC_LINK_SENT") {
    const magicLinkRequests = await db.securityAuditLog.count({
      where: {
        action: "MAGIC_LINK_SENT",
        ipAddress,
        createdAt: { gte: fiveMinutesAgo },
      },
    });

    if (magicLinkRequests >= 15) {
      await logSecurityEvent({
        action: "SUSPICIOUS_ACTIVITY",
        ipAddress,
        metadata: {
          reason: "Too many magic link requests",
          count: magicLinkRequests,
        },
      });
      return true;
    }
  }

  return false;
}
