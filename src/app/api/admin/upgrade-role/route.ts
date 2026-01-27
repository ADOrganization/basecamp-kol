import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { timingSafeEqual } from "@/lib/admin-auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";
import { logSecurityEvent, getRequestMetadata } from "@/lib/security-audit";

// SECURITY: One-time setup endpoint - DISABLED in production by default
// Set ALLOW_ADMIN_UPGRADE=true to temporarily enable (remove after use)
export async function POST(req: NextRequest) {
  // SECURITY: Apply strict rate limiting - extremely sensitive operation
  const rateLimitResponse = applyRateLimit(req, RATE_LIMITS.authFailed);
  if (rateLimitResponse) return rateLimitResponse;

  const { ipAddress, userAgent } = getRequestMetadata(req);

  try {
    // SECURITY: Block this endpoint in production unless explicitly enabled
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_ADMIN_UPGRADE !== "true") {
      console.warn("[SECURITY] Blocked attempt to access upgrade-role endpoint in production");
      await logSecurityEvent({
        action: "LOGIN_FAILED",
        ipAddress: ipAddress || undefined,
        userAgent: userAgent || undefined,
        metadata: { reason: "Upgrade-role endpoint blocked in production" },
      });
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { setupSecret, email } = await req.json();

    const expectedSecret = process.env.ADMIN_SETUP_SECRET;
    if (!expectedSecret) {
      return NextResponse.json({ error: "Setup not configured" }, { status: 403 });
    }

    // SECURITY: Use timing-safe comparison to prevent timing attacks
    if (!timingSafeEqual(setupSecret || "", expectedSecret)) {
      await logSecurityEvent({
        action: "LOGIN_FAILED",
        ipAddress: ipAddress || undefined,
        userAgent: userAgent || undefined,
        metadata: { reason: "Invalid setup secret for role upgrade" },
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const admin = await db.adminUser.update({
      where: { email: email.toLowerCase() },
      data: { role: "SUPER_ADMIN" },
      select: { id: true, email: true, role: true },
    });

    // SECURITY: Log role upgrade - critical security event
    await logSecurityEvent({
      action: "ROLE_UPGRADED",
      ipAddress: ipAddress || undefined,
      userAgent: userAgent || undefined,
      metadata: { adminId: admin.id, email: admin.email, newRole: "SUPER_ADMIN" },
    });

    return NextResponse.json({
      success: true,
      message: "Admin upgraded to SUPER_ADMIN",
      admin,
    });
  } catch (error) {
    console.error("Upgrade role error:", error);
    return NextResponse.json({ error: "Failed to upgrade role" }, { status: 500 });
  }
}
