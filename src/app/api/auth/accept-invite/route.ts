/**
 * Accept Invitation API
 *
 * POST /api/auth/accept-invite
 * Accept an invitation and create user account.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifyInvitationToken, acceptInvitation } from "@/lib/magic-link";
import { logSecurityEvent, getRequestMetadata } from "@/lib/security-audit";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";
import { encode } from "next-auth/jwt";
import DOMPurify from "isomorphic-dompurify";
import type { OrganizationType, OrganizationRole } from "@prisma/client";

const APP_URL = process.env.NEXTAUTH_URL || "https://basecampnetwork.xyz";

export async function POST(request: NextRequest) {
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.auth);
  if (rateLimitResponse) return rateLimitResponse;

  const { ipAddress, userAgent } = getRequestMetadata(request);

  try {
    const body = await request.json();
    const token = body.token?.toString() || "";
    const rawName = body.name?.toString() || "";
    const name = DOMPurify.sanitize(rawName).trim();

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

    // Log successful login
    await logSecurityEvent({
      userId: user.id,
      action: "LOGIN_SUCCESS",
      ipAddress: ipAddress || undefined,
      userAgent: userAgent || undefined,
      metadata: { email: invitation.email, method: "invitation" },
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

    // Create JWT token for the session
    const jwtToken = await encode({
      token: {
        id: user.id,
        email: user.email,
        name: user.name,
        organizationId: invitation.organizationId,
        organizationType: invitation.organizationType as OrganizationType,
        organizationRole: invitation.role as OrganizationRole,
        organizationName: invitation.organizationName,
        isKol: false,
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

    // Determine redirect
    const redirectTo = invitation.organizationType === "AGENCY"
      ? "/agency/dashboard"
      : "/client/dashboard";

    return NextResponse.json({
      success: true,
      redirectTo,
    });
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
