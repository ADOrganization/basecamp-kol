/**
 * Admin Users API
 *
 * GET /api/admin/users
 * List all users in the organization.
 */

import { NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";

export async function GET(request: Request) {
  // Rate limiting
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.sensitive);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admin users can always manage users; regular users need OWNER/ADMIN role
    if (!authContext.isAdmin && authContext.organizationType !== "AGENCY") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all members in the organization
    const members = await db.organizationMember.findMany({
      where: { organizationId: authContext.organizationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            isDisabled: true,
            lastLoginAt: true,
            emailVerified: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Get pending invitations
    const invitations = await db.userInvitation.findMany({
      where: {
        organizationId: authContext.organizationId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        inviter: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const users = members.map((m) => ({
      id: m.user.id,
      email: m.user.email,
      name: m.user.name,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
      isDisabled: m.user.isDisabled,
      lastLoginAt: m.user.lastLoginAt,
      emailVerified: m.user.emailVerified,
      createdAt: m.user.createdAt,
    }));

    const pendingInvitations = invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      invitedBy: inv.inviter.name || inv.inviter.email,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
    }));

    return NextResponse.json({
      users,
      invitations: pendingInvitations,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
