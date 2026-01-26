/**
 * Admin Invite User API
 *
 * POST /api/admin/users/invite
 * Invite a new user to the organization.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createInvitationToken } from "@/lib/magic-link";
import { sendInvitationEmail } from "@/lib/email";
import { logSecurityEvent, getRequestMetadata } from "@/lib/security-audit";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";
import DOMPurify from "isomorphic-dompurify";
import type { OrganizationRole } from "@prisma/client";

export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.invite);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only OWNER and ADMIN can invite users
    if (!["OWNER", "ADMIN"].includes(session.user.organizationRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const rawEmail = body.email?.toString() || "";
    const role = body.role as OrganizationRole;

    // Sanitize and validate email
    const email = DOMPurify.sanitize(rawEmail).toLowerCase().trim();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email address is required" },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles: OrganizationRole[] = ["ADMIN", "MEMBER", "VIEWER"];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be ADMIN, MEMBER, or VIEWER" },
        { status: 400 }
      );
    }

    // Check if user already exists in the organization
    const existingUser = await db.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { organizationId: session.user.organizationId },
        },
      },
    });

    if (existingUser && existingUser.memberships.length > 0) {
      return NextResponse.json(
        { error: "User is already a member of this organization" },
        { status: 400 }
      );
    }

    // Check for existing pending invitation
    const existingInvitation = await db.userInvitation.findFirst({
      where: {
        email,
        organizationId: session.user.organizationId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvitation) {
      return NextResponse.json(
        { error: "An invitation is already pending for this email" },
        { status: 400 }
      );
    }

    const { ipAddress, userAgent } = getRequestMetadata(request);

    // Create invitation token
    const token = await createInvitationToken(
      email,
      session.user.organizationId,
      session.user.id,
      role
    );

    // Get organization name for email
    const organization = await db.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { name: true },
    });

    // Send invitation email
    const emailResult = await sendInvitationEmail(
      email,
      token,
      session.user.name || session.user.email,
      organization?.name || "the organization",
      role
    );

    // Log the invitation
    await logSecurityEvent({
      userId: session.user.id,
      action: "INVITE_SENT",
      ipAddress: ipAddress || undefined,
      userAgent: userAgent || undefined,
      metadata: {
        invitedEmail: email,
        role,
        emailSent: emailResult.success,
      },
    });

    if (!emailResult.success) {
      console.error("Failed to send invitation email:", emailResult.error);
      // Still return success - invitation was created even if email failed
    }

    return NextResponse.json({
      success: true,
      message: `Invitation sent to ${email}`,
    });
  } catch (error) {
    console.error("Error inviting user:", error);
    return NextResponse.json(
      { error: "Failed to send invitation" },
      { status: 500 }
    );
  }
}
