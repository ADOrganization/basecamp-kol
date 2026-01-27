/**
 * Magic Link Callback API
 *
 * GET /api/auth/callback/magic
 * Verifies the magic link token and creates a session.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyMagicLinkToken } from "@/lib/magic-link";
import { logSecurityEvent, getRequestMetadata } from "@/lib/security-audit";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";
import { encode } from "next-auth/jwt";

const APP_URL = process.env.NEXTAUTH_URL || "https://basecampnetwork.xyz";

// Cookie name changes based on environment (Auth.js convention)
const isProduction = process.env.NODE_ENV === "production";
const SESSION_COOKIE_NAME = isProduction
  ? "__Secure-authjs.session-token"
  : "authjs.session-token";

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.magicLinkCallback);
  if (rateLimitResponse) {
    return NextResponse.redirect(new URL("/auth-error?error=RateLimit", APP_URL));
  }

  const { ipAddress, userAgent } = getRequestMetadata(request);

  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(new URL("/auth-error?error=InvalidLink", APP_URL));
    }

    // Verify the token - returns email if valid
    const verification = await verifyMagicLinkToken(token);

    if (!verification.valid || !verification.email) {
      await logSecurityEvent({
        action: verification.expired ? "MAGIC_LINK_EXPIRED" : "LOGIN_FAILED",
        ipAddress: ipAddress || undefined,
        userAgent: userAgent || undefined,
        metadata: { reason: verification.expired ? "Token expired" : "Invalid token" },
      });

      const errorType = verification.expired ? "Expired" : "InvalidLink";
      return NextResponse.redirect(new URL(`/auth-error?error=${errorType}`, APP_URL));
    }

    const email = verification.email;

    // Find the user
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        memberships: {
          include: {
            organization: true,
          },
          take: 1,
        },
      },
    });

    if (!user) {
      await logSecurityEvent({
        action: "LOGIN_FAILED",
        ipAddress: ipAddress || undefined,
        userAgent: userAgent || undefined,
        metadata: { email, reason: "User not found after token verification" },
      });
      return NextResponse.redirect(new URL("/auth-error?error=UserNotFound", APP_URL));
    }

    if (user.isDisabled) {
      await logSecurityEvent({
        action: "LOGIN_FAILED",
        userId: user.id,
        ipAddress: ipAddress || undefined,
        userAgent: userAgent || undefined,
        metadata: { email, reason: "Account disabled" },
      });
      return NextResponse.redirect(new URL("/auth-error?error=AccountDisabled", APP_URL));
    }

    const membership = user.memberships[0];
    if (!membership) {
      await logSecurityEvent({
        action: "LOGIN_FAILED",
        userId: user.id,
        ipAddress: ipAddress || undefined,
        userAgent: userAgent || undefined,
        metadata: { email, reason: "No organization membership" },
      });
      return NextResponse.redirect(new URL("/auth-error?error=NoOrganization", APP_URL));
    }

    // Update user's email verified timestamp and last login
    await db.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        lastLoginAt: new Date(),
      },
    });

    // Log successful login
    await logSecurityEvent({
      action: "LOGIN_SUCCESS",
      userId: user.id,
      ipAddress: ipAddress || undefined,
      userAgent: userAgent || undefined,
      metadata: { email, method: "magic_link" },
    });

    await logSecurityEvent({
      action: "MAGIC_LINK_USED",
      userId: user.id,
      ipAddress: ipAddress || undefined,
      userAgent: userAgent || undefined,
      metadata: { email },
    });

    // Create JWT token for the session
    // The salt must match the cookie name for Auth.js to decode it properly
    const jwtToken = await encode({
      token: {
        id: user.id,
        email: user.email,
        name: user.name,
        organizationId: membership.organizationId,
        organizationType: membership.organization.type,
        organizationRole: membership.role,
        organizationName: membership.organization.name,
      },
      secret: process.env.AUTH_SECRET!,
      salt: SESSION_COOKIE_NAME,
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    // Redirect to appropriate dashboard
    const redirectTo = membership.organization.type === "AGENCY"
      ? "/agency/dashboard"
      : "/client/dashboard";

    // Create redirect response and set the session cookie on it
    const response = NextResponse.redirect(new URL(redirectTo, APP_URL));

    // Set the session cookie on the response object directly
    // This ensures the cookie is included in the redirect response
    response.cookies.set(SESSION_COOKIE_NAME, jwtToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Magic link callback error:", error);

    await logSecurityEvent({
      action: "LOGIN_FAILED",
      ipAddress: ipAddress || undefined,
      userAgent: userAgent || undefined,
      metadata: { error: String(error) },
    });

    return NextResponse.redirect(new URL("/auth-error?error=ServerError", APP_URL));
  }
}
