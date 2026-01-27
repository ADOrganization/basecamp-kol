/**
 * Debug Login API - Admin Only
 *
 * POST /api/auth/debug-login
 * Generates a magic link URL for testing without sending email.
 * Only accessible to admin users.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createVerificationToken } from "@/lib/magic-link";
import { getApiAuthContext } from "@/lib/api-auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";
import { logSecurityEvent, getRequestMetadata } from "@/lib/security-audit";

export async function POST(request: NextRequest) {
  // SECURITY: Apply rate limiting - sensitive operation
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.authFailed);
  if (rateLimitResponse) return rateLimitResponse;

  const { ipAddress, userAgent } = getRequestMetadata(request);

  try {
    // Verify admin authentication
    const authContext = await getApiAuthContext();
    if (!authContext || !authContext.isAdmin) {
      await logSecurityEvent({
        action: "LOGIN_FAILED",
        ipAddress: ipAddress || undefined,
        userAgent: userAgent || undefined,
        metadata: { reason: "Debug login attempted without admin access" },
      });
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const email = body.email?.toString()?.toLowerCase()?.trim();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email address is required" },
        { status: 400 }
      );
    }

    // Check if user account exists
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, name: true, isDisabled: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: `No user account found with email: ${email}` },
        { status: 404 }
      );
    }

    if (user.isDisabled) {
      return NextResponse.json(
        { error: "This user account is disabled" },
        { status: 400 }
      );
    }

    // Generate the magic link token
    const token = await createVerificationToken(email);

    // Build the callback URL
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const loginUrl = `${baseUrl}/api/auth/callback/magic?token=${token}&email=${encodeURIComponent(email)}`;

    // SECURITY: Log debug login usage
    await logSecurityEvent({
      action: "DEBUG_LOGIN_GENERATED",
      ipAddress: ipAddress || undefined,
      userAgent: userAgent || undefined,
      metadata: { targetEmail: email, generatedByAdmin: authContext.userId },
    });

    return NextResponse.json({
      success: true,
      email,
      accountInfo: {
        type: "user",
        name: user.name || email,
      },
      loginUrl,
      expiresIn: "15 minutes",
      note: "This link is for testing only. Click it or paste in browser to login.",
    });
  } catch (error) {
    console.error("Debug login error:", error);
    return NextResponse.json(
      { error: "Failed to generate login link" },
      { status: 500 }
    );
  }
}
