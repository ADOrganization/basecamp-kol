/**
 * Accept Invitation API
 *
 * POST /api/auth/accept-invite
 * Accept an invitation and create user account.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyInvitationToken, acceptInvitation } from "@/lib/magic-link";
import { logSecurityEvent, getRequestMetadata } from "@/lib/security-audit";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";
import { SignJWT } from "jose";
import type { OrganizationType, OrganizationRole } from "@prisma/client";

// SECURITY: Require AUTH_SECRET - never use fallback
function getAuthSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("SECURITY: AUTH_SECRET environment variable is required");
  }
  return new TextEncoder().encode(secret);
}

// Simple text sanitization (strip HTML tags)
function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/[<>"'&]/g, "") // Remove potentially dangerous characters
    .trim();
}

const APP_URL = process.env.NEXTAUTH_URL || "https://basecampnetwork.xyz";

// Cookie name changes based on environment (Auth.js convention)
const isProduction = process.env.NODE_ENV === "production";
const SESSION_COOKIE_NAME = isProduction
  ? "__Secure-authjs.session-token"
  : "authjs.session-token";

export async function POST(request: NextRequest) {
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.auth);
  if (rateLimitResponse) return rateLimitResponse;

  const { ipAddress, userAgent } = getRequestMetadata(request);

  try {
    const body = await request.json();
    const token = body.token?.toString() || "";
    const rawName = body.name?.toString() || "";
    const name = sanitizeText(rawName);

    if (!token) {
      return NextResponse.json(
        { error: "Invalid invitation link" },
        { status: 400 }
      );
    }

    // Verify the invitation token
    const verification = await verifyInvitationToken(token);

    if (!verification.valid || !verification.invitation) {
      let errorMessage = "Invalid or expired invitation";
      if (verification.expired) errorMessage = "This invitation has expired";
      if (verification.revoked) errorMessage = "This invitation has been revoked";

      await logSecurityEvent({
        action: "LOGIN_FAILED",
        ipAddress: ipAddress || undefined,
        userAgent: userAgent || undefined,
        metadata: {
          reason: errorMessage,
          token: token.substring(0, 8) + "...",
        },
      });

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const { invitation } = verification;

    // Check if user already exists
    let user = await db.user.findUnique({
      where: { email: invitation.email },
    });

    if (user) {
      // Check if already a member
      const existingMembership = await db.organizationMember.findFirst({
        where: {
          userId: user.id,
          organizationId: invitation.organizationId,
        },
      });

      if (existingMembership) {
        return NextResponse.json(
          { error: "You are already a member of this organization" },
          { status: 400 }
        );
      }
    } else {
      // Create new user
      user = await db.user.create({
        data: {
          email: invitation.email,
          name: name || null,
          emailVerified: new Date(),
        },
      });

      await logSecurityEvent({
        userId: user.id,
        action: "USER_CREATED",
        ipAddress: ipAddress || undefined,
        userAgent: userAgent || undefined,
        metadata: {
          email: invitation.email,
          viaInvitation: true,
        },
      });
    }

    // Create organization membership
    await db.organizationMember.create({
      data: {
        userId: user.id,
        organizationId: invitation.organizationId,
        role: invitation.role as OrganizationRole,
      },
    });

    // Mark invitation as accepted
    await acceptInvitation(invitation.id);

    // Update last login
    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await logSecurityEvent({
      userId: user.id,
      action: "INVITE_ACCEPTED",
      ipAddress: ipAddress || undefined,
      userAgent: userAgent || undefined,
      metadata: {
        organizationId: invitation.organizationId,
        role: invitation.role,
      },
    });

    // SECURITY: Check if user has 2FA enabled
    // If not, redirect to 2FA setup instead of granting full session
    if (!user.twoFactorEnabled) {
      // Create a setup token for 2FA (not a full session)
      const setupToken = await new SignJWT({
        sub: user.id,
        email: user.email,
        type: "user_2fa_setup",
        organizationId: invitation.organizationId,
        organizationType: invitation.organizationType,
        organizationRole: invitation.role,
        organizationName: invitation.organizationName,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("15m") // 15 minutes to complete setup
        .sign(getAuthSecret());

      await logSecurityEvent({
        userId: user.id,
        action: "2FA_SETUP_REQUIRED",
        ipAddress: ipAddress || undefined,
        userAgent: userAgent || undefined,
        metadata: { email: invitation.email, viaInvitation: true },
      });

      // Create response with setup token (not full session)
      const response = NextResponse.json({
        success: true,
        requires2FASetup: true,
        redirectTo: "/setup-2fa",
      });

      response.cookies.set("user_2fa_setup_token", setupToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        maxAge: 15 * 60, // 15 minutes
        path: "/",
      });

      return response;
    }

    // User has 2FA enabled - redirect to verify 2FA
    const verifyToken = await new SignJWT({
      sub: user.id,
      email: user.email,
      type: "user_2fa_verify",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("5m") // 5 minutes to enter code
      .sign(getAuthSecret());

    await logSecurityEvent({
      userId: user.id,
      action: "2FA_VERIFICATION_REQUIRED",
      ipAddress: ipAddress || undefined,
      userAgent: userAgent || undefined,
      metadata: { email: invitation.email, viaInvitation: true },
    });

    const response = NextResponse.json({
      success: true,
      requires2FAVerify: true,
      redirectTo: "/verify-2fa",
    });

    response.cookies.set("user_2fa_verify_token", verifyToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 5 * 60, // 5 minutes
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Accept invitation error:", error);

    await logSecurityEvent({
      action: "LOGIN_FAILED",
      ipAddress: ipAddress || undefined,
      userAgent: userAgent || undefined,
      metadata: { error: String(error) },
    });

    return NextResponse.json(
      { error: "Failed to accept invitation" },
      { status: 500 }
    );
  }
}

// GET endpoint to verify invitation token without accepting
export async function GET(request: NextRequest) {
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.auth);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const token = request.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    const verification = await verifyInvitationToken(token);

    if (!verification.valid || !verification.invitation) {
      let error = "Invalid invitation";
      if (verification.expired) error = "Invitation expired";
      if (verification.revoked) error = "Invitation revoked";

      return NextResponse.json({ valid: false, error }, { status: 400 });
    }

    return NextResponse.json({
      valid: true,
      invitation: {
        email: verification.invitation.email,
        organizationName: verification.invitation.organizationName,
        role: verification.invitation.role,
        inviterName: verification.invitation.inviterName,
      },
    });
  } catch (error) {
    console.error("Verify invitation error:", error);
    return NextResponse.json(
      { error: "Failed to verify invitation" },
      { status: 500 }
    );
  }
}
