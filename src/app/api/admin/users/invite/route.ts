/**
 * Admin Invite User API
 *
 * POST /api/admin/users/invite
 * Invite a new user to the organization.
 */

import { NextRequest, NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
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
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admin users can always invite; regular users need OWNER/ADMIN role
    if (!authContext.isAdmin && authContext.organizationType !== "AGENCY") {
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
          where: { organizationId: authContext.organizationId },
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
        organizationId: authContext.organizationId,
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

    // For admin users, we need a placeholder inviter ID
    // Create invitation token
    const token = await createInvitationToken(
      email,
      authContext.organizationId,
      authContext.userId,
      role
    );

    // Get organization name for email
    const organization = await db.organization.findUnique({
      where: { id: authContext.organizationId },
      select: { name: true },
    });

    // Get inviter name for email
    let inviterName = "Admin";
    if (authContext.isAdmin) {
      const admin = await db.adminUser.findUnique({
        where: { id: authContext.userId },
        select: { name: true, email: true },
      });
      inviterName = admin?.name || admin?.email || "Admin";
    }

    // Send invitation email
    const emailResult = await sendInvitationEmail(
      email,
      token,
      inviterName,
      organization?.name || "the organization",
      role
    );

    // Log the invitation (skip for admin users as they don't have a userId in the User table)
    if (!authContext.isAdmin) {
      await logSecurityEvent({
        userId: authContext.userId,
        action: "INVITE_SENT",
        ipAddress: ipAddress || undefined,
        userAgent: userAgent || undefined,
        metadata: {
          invitedEmail: email,
          role,
          emailSent: emailResult.success,
        },
      });
    }

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
