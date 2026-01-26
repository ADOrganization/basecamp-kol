/**
 * KOL Magic Link Callback API
 *
 * GET /api/auth/callback/kol-magic
 * Verifies the magic link token and creates a KOL session.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifyMagicLinkToken } from "@/lib/magic-link";
import { logSecurityEvent, getRequestMetadata } from "@/lib/security-audit";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";
import { encode } from "next-auth/jwt";

const APP_URL = process.env.NEXTAUTH_URL || "https://basecampnetwork.xyz";

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.magicLinkCallback);
  if (rateLimitResponse) {
    return NextResponse.redirect(new URL("/kol/login?error=RateLimit", APP_URL));
  }

  const { ipAddress, userAgent } = getRequestMetadata(request);

  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get("token");
    const email = searchParams.get("email");

    if (!token || !email) {
      return NextResponse.redirect(new URL("/kol/login?error=InvalidLink", APP_URL));
    }

    // Verify the token
    const verification = await verifyMagicLinkToken(token, email);

    if (!verification.valid) {
      await logSecurityEvent({
        action: verification.expired ? "MAGIC_LINK_EXPIRED" : "LOGIN_FAILED",
        ipAddress: ipAddress || undefined,
        userAgent: userAgent || undefined,
        metadata: { email, userType: "kol", reason: verification.expired ? "Token expired" : "Invalid token" },
      });

      const errorType = verification.expired ? "Expired" : "InvalidLink";
      return NextResponse.redirect(new URL(`/kol/login?error=${errorType}`, APP_URL));
    }

    // Find the KOL account
    const kolAccount = await db.kOLAccount.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        kol: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!kolAccount) {
      await logSecurityEvent({
        action: "LOGIN_FAILED",
        ipAddress: ipAddress || undefined,
        userAgent: userAgent || undefined,
        metadata: { email, userType: "kol", reason: "KOL account not found" },
      });
      return NextResponse.redirect(new URL("/kol/login?error=UserNotFound", APP_URL));
    }

    if (kolAccount.isDisabled) {
      await logSecurityEvent({
        action: "LOGIN_FAILED",
        ipAddress: ipAddress || undefined,
        userAgent: userAgent || undefined,
        metadata: { email, userType: "kol", reason: "Account disabled" },
      });
      return NextResponse.redirect(new URL("/kol/login?error=AccountDisabled", APP_URL));
    }

    // Update KOL account verification status and last login
    await db.kOLAccount.update({
      where: { id: kolAccount.id },
      data: {
        isVerified: true,
        lastLoginAt: new Date(),
      },
    });

    // Log successful login
    await logSecurityEvent({
      action: "LOGIN_SUCCESS",
      ipAddress: ipAddress || undefined,
      userAgent: userAgent || undefined,
      metadata: { email, userType: "kol", kolId: kolAccount.kolId, method: "magic_link" },
    });

    await logSecurityEvent({
      action: "MAGIC_LINK_USED",
      ipAddress: ipAddress || undefined,
      userAgent: userAgent || undefined,
      metadata: { email, userType: "kol" },
    });

    // Create JWT token for the KOL session
    const jwtToken = await encode({
      token: {
        id: kolAccount.id,
        email: kolAccount.email,
        name: kolAccount.kol.name,
        organizationId: kolAccount.kol.organizationId,
        organizationType: kolAccount.kol.organization.type,
        organizationRole: "MEMBER",
        organizationName: kolAccount.kol.organization.name,
        kolId: kolAccount.kolId,
        isKol: true,
      },
      secret: process.env.AUTH_SECRET!,
      salt: "authjs.session-token",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    // Set the session cookie
    const cookieStore = await cookies();
    cookieStore.set("authjs.session-token", jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    // Redirect to KOL dashboard
    return NextResponse.redirect(new URL("/kol/dashboard", APP_URL));
  } catch (error) {
    console.error("KOL magic link callback error:", error);

    await logSecurityEvent({
      action: "LOGIN_FAILED",
      ipAddress: ipAddress || undefined,
      userAgent: userAgent || undefined,
      metadata: { error: String(error), userType: "kol" },
    });

    return NextResponse.redirect(new URL("/kol/login?error=ServerError", APP_URL));
  }
}
