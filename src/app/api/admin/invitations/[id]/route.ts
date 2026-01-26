/**
 * Admin Invitation Management API
 *
 * DELETE /api/admin/invitations/[id]
 * Revoke a pending invitation.
 *
 * POST /api/admin/invitations/[id]/resend
 * Resend an invitation email.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createInvitationToken } from "@/lib/magic-link";
import { sendInvitationEmail } from "@/lib/email";
import { logSecurityEvent, getRequestMetadata } from "@/lib/security-audit";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.standard);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["OWNER", "ADMIN"].includes(session.user.organizationRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const { ipAddress, userAgent } = getRequestMetadata(request);

    // Find the invitation
    const invitation = await db.userInvitation.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
        acceptedAt: null,
        revokedAt: null,
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    // Revoke the invitation
    await db.userInvitation.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    // Log the action
    await logSecurityEvent({
      userId: session.user.id,
      action: "INVITE_REVOKED",
      ipAddress: ipAddress || undefined,
      userAgent: userAgent || undefined,
      metadata: {
        invitationId: id,
        invitedEmail: invitation.email,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error revoking invitation:", error);
    return NextResponse.json(
      { error: "Failed to revoke invitation" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting - use invite limit for resends too
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.invite);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["OWNER", "ADMIN"].includes(session.user.organizationRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const { ipAddress, userAgent } = getRequestMetadata(request);

    // Find the invitation
    const invitation = await db.userInvitation.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
        acceptedAt: null,
        revokedAt: null,
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found or already used" },
        { status: 404 }
      );
    }

    // Revoke old invitation and create new one
    await db.userInvitation.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    // Create new invitation token
    const token = await createInvitationToken(
      invitation.email,
      session.user.organizationId,
      session.user.id,
      invitation.role
    );

    // Get organization name
    const organization = await db.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { name: true },
    });

    // Send new invitation email
    const emailResult = await sendInvitationEmail(
      invitation.email,
      token,
      session.user.name || session.user.email,
      organization?.name || "the organization",
      invitation.role
    );

    // Log the action
    await logSecurityEvent({
      userId: session.user.id,
      action: "INVITE_SENT",
      ipAddress: ipAddress || undefined,
      userAgent: userAgent || undefined,
      metadata: {
        invitedEmail: invitation.email,
        role: invitation.role,
        isResend: true,
        emailSent: emailResult.success,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Invitation resent to ${invitation.email}`,
    });
  } catch (error) {
    console.error("Error resending invitation:", error);
    return NextResponse.json(
      { error: "Failed to resend invitation" },
      { status: 500 }
    );
  }
}
