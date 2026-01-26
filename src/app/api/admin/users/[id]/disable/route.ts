/**
 * Admin User Disable API
 *
 * POST /api/admin/users/[id]/disable
 * Disable or enable a user's access.
 */

import { NextRequest, NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { logSecurityEvent, getRequestMetadata } from "@/lib/security-audit";
import { sendAccountDisabledEmail } from "@/lib/email";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.standard);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admin users can disable users
    if (!authContext.isAdmin && authContext.organizationType !== "AGENCY") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const disable = body.disable === true;

    // Can't disable yourself (for non-admin users)
    if (!authContext.isAdmin && id === authContext.userId) {
      return NextResponse.json(
        { error: "Cannot disable your own account" },
        { status: 400 }
      );
    }

    // Verify user is in the same organization
    const member = await db.organizationMember.findFirst({
      where: {
        userId: id,
        organizationId: authContext.organizationId,
      },
      include: {
        user: {
          select: { email: true, isDisabled: true },
        },
      },
    });

    if (!member) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Can't disable OWNER
    if (member.role === "OWNER") {
      return NextResponse.json(
        { error: "Cannot disable organization owner" },
        { status: 400 }
      );
    }

    const { ipAddress, userAgent } = getRequestMetadata(request);

    // Update user's disabled status
    await db.user.update({
      where: { id },
      data: { isDisabled: disable },
    });

    // Log the action (skip for admin users as they don't have a User record)
    if (!authContext.isAdmin) {
      await logSecurityEvent({
        userId: authContext.userId,
        action: disable ? "USER_DISABLED" : "USER_ENABLED",
        ipAddress: ipAddress || undefined,
        userAgent: userAgent || undefined,
        metadata: {
          targetUserId: id,
          targetEmail: member.user.email,
        },
      });
    }

    // Send notification email when disabling
    if (disable && member.user.email) {
      const organization = await db.organization.findUnique({
        where: { id: authContext.organizationId },
        select: { name: true },
      });

      await sendAccountDisabledEmail(
        member.user.email,
        organization?.name || "the organization"
      );
    }

    return NextResponse.json({
      success: true,
      isDisabled: disable,
    });
  } catch (error) {
    console.error("Error updating user status:", error);
    return NextResponse.json(
      { error: "Failed to update user status" },
      { status: 500 }
    );
  }
}
