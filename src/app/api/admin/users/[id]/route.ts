/**
 * Admin User Detail API
 *
 * GET /api/admin/users/[id]
 * Get user details.
 *
 * PUT /api/admin/users/[id]
 * Update user role.
 *
 * DELETE /api/admin/users/[id]
 * Remove user from organization.
 */

import { NextRequest, NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";
import type { OrganizationRole } from "@prisma/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.sensitive);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!authContext.isAdmin && authContext.organizationType !== "AGENCY") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const member = await db.organizationMember.findFirst({
      where: {
        userId: id,
        organizationId: authContext.organizationId,
      },
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
    });

    if (!member) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: member.user.id,
      email: member.user.email,
      name: member.user.name,
      avatarUrl: member.user.avatarUrl,
      role: member.role,
      isDisabled: member.user.isDisabled,
      lastLoginAt: member.user.lastLoginAt,
      emailVerified: member.user.emailVerified,
      createdAt: member.user.createdAt,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

export async function PUT(
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

    // Admin users can change roles
    if (!authContext.isAdmin && authContext.organizationType !== "AGENCY") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const newRole = body.role as OrganizationRole;

    // Validate role
    const validRoles: OrganizationRole[] = ["ADMIN", "MEMBER", "VIEWER"];
    if (!validRoles.includes(newRole)) {
      return NextResponse.json(
        { error: "Invalid role" },
        { status: 400 }
      );
    }

    // Admin users can't demote themselves (but they use a different ID anyway)
    if (!authContext.isAdmin && id === authContext.userId) {
      return NextResponse.json(
        { error: "Cannot change your own role" },
        { status: 400 }
      );
    }

    const member = await db.organizationMember.findFirst({
      where: {
        userId: id,
        organizationId: authContext.organizationId,
      },
    });

    if (!member) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Can't demote OWNER
    if (member.role === "OWNER") {
      return NextResponse.json(
        { error: "Cannot change owner role" },
        { status: 400 }
      );
    }

    await db.organizationMember.update({
      where: { id: member.id },
      data: { role: newRole },
    });

    return NextResponse.json({ success: true, role: newRole });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // Admin users can remove users
    if (!authContext.isAdmin && authContext.organizationType !== "AGENCY") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Can't remove yourself (for non-admin users)
    if (!authContext.isAdmin && id === authContext.userId) {
      return NextResponse.json(
        { error: "Cannot remove yourself" },
        { status: 400 }
      );
    }

    const member = await db.organizationMember.findFirst({
      where: {
        userId: id,
        organizationId: authContext.organizationId,
      },
    });

    if (!member) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Can't remove OWNER
    if (member.role === "OWNER") {
      return NextResponse.json(
        { error: "Cannot remove organization owner" },
        { status: 400 }
      );
    }

    await db.organizationMember.delete({
      where: { id: member.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing user:", error);
    return NextResponse.json(
      { error: "Failed to remove user" },
      { status: 500 }
    );
  }
}
