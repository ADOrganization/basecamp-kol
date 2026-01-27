/**
 * Magic Link Callback API
 *
 * GET /api/auth/callback/magic
 * Verifies the magic link token and creates a session.
 * Enforces mandatory 2FA for all users.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyMagicLinkToken } from "@/lib/magic-link";
import { logSecurityEvent, getRequestMetadata } from "@/lib/security-audit";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";
import { encode } from "next-auth/jwt";
import { SignJWT } from "jose";

const APP_URL = process.env.NEXTAUTH_URL || "https://basecampnetwork.xyz";

// Cookie name changes based on environment (Auth.js convention)
const isProduction = process.env.NODE_ENV === "production";
const SESSION_COOKIE_NAME = isProduction
  ? "__Secure-authjs.session-token"
  : "authjs.session-token";

const AUTH_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "auth-secret-key"
);

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

    // Update user's email verified timestamp
    await db.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
      },
    });

    await logSecurityEvent({
      action: "MAGIC_LINK_USED",
      userId: user.id,
      ipAddress: ipAddress || undefined,
      userAgent: userAgent || undefined,
      metadata: { email },
    });

    // Check 2FA status - mandatory for all users
    if (!user.twoFactorEnabled) {
      // 2FA not enabled - redirect to setup with a setup token
      const setupToken = await new SignJWT({
        sub: user.id,
        email: user.email,
        type: "user_2fa_setup",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("15m") // 15 minutes to complete setup
        .sign(AUTH_SECRET);

      const response = NextResponse.redirect(new URL("/setup-2fa", APP_URL));
      response.cookies.set("user_2fa_setup_token", setupToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        maxAge: 15 * 60, // 15 minutes
        path: "/",
      });

      await logSecurityEvent({
        action: "2FA_SETUP_REQUIRED",
        userId: user.id,
        ipAddress: ipAddress || undefined,
        userAgent: userAgent || undefined,
        metadata: { email },
      });

      return response;
    }

    // 2FA is enabled - redirect to verify with a verify token
    const verifyToken = await new SignJWT({
      sub: user.id,
      email: user.email,
      type: "user_2fa_verify",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("5m") // 5 minutes to enter code
      .sign(AUTH_SECRET);

    const response = NextResponse.redirect(new URL("/verify-2fa", APP_URL));
    response.cookies.set("user_2fa_verify_token", verifyToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 5 * 60, // 5 minutes
      path: "/",
    });

    await logSecurityEvent({
      action: "2FA_VERIFICATION_REQUIRED",
      userId: user.id,
      ipAddress: ipAddress || undefined,
      userAgent: userAgent || undefined,
      metadata: { email },
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
