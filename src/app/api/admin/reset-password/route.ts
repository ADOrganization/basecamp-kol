import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "@/lib/admin-auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";
import { logSecurityEvent, getRequestMetadata } from "@/lib/security-audit";

// Password reset endpoint for admin users
// Protected by ADMIN_SETUP_SECRET env var
// SECURITY: Disabled in production unless explicitly enabled
export async function POST(req: NextRequest) {
  // SECURITY: Apply strict rate limiting
  const rateLimitResponse = applyRateLimit(req, RATE_LIMITS.authFailed);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { ipAddress, userAgent } = getRequestMetadata(req);

  try {
    // SECURITY: Block this endpoint in production unless explicitly enabled
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_PASSWORD_RESET !== "true") {
      console.warn("[SECURITY] Blocked attempt to access reset-password endpoint in production");
      await logSecurityEvent({
        action: "LOGIN_FAILED",
        ipAddress: ipAddress || undefined,
        userAgent: userAgent || undefined,
        metadata: { reason: "Reset password endpoint blocked in production" },
      });
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { setupSecret, email, newPassword } = await req.json();

    // Verify setup secret
    const expectedSecret = process.env.ADMIN_SETUP_SECRET;
    if (!expectedSecret) {
      return NextResponse.json(
        { error: "Admin setup not configured" },
        { status: 500 }
      );
    }

    // SECURITY: Use timing-safe comparison to prevent timing attacks
    if (!timingSafeEqual(setupSecret || "", expectedSecret)) {
      await logSecurityEvent({
        action: "LOGIN_FAILED",
        ipAddress: ipAddress || undefined,
        userAgent: userAgent || undefined,
        metadata: { reason: "Invalid setup secret for password reset" },
      });
      return NextResponse.json(
        { error: "Invalid setup secret" },
        { status: 403 }
      );
    }

    // Validate input
    if (!email || !newPassword) {
      return NextResponse.json(
        { error: "Email and newPassword are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Find admin user
    const admin = await db.adminUser.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!admin) {
      return NextResponse.json(
        { error: "Admin user not found" },
        { status: 404 }
      );
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await db.adminUser.update({
      where: { id: admin.id },
      data: { passwordHash },
    });

    return NextResponse.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Password reset error:", error);
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 }
    );
  }
}
