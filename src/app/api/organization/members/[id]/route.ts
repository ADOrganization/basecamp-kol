import { NextRequest, NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Apply rate limiting for sensitive operations
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.sensitive);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: memberId } = await params;

    // Admins bypass membership check
    let userMembership = null;
    if (!authContext.isAdmin) {
      // Check if user is owner or admin
      userMembership = await db.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: authContext.organizationId,
            userId: authContext.userId,
          },
        },
      });
    }

    if (!authContext.isAdmin && (!userMembership || !["OWNER", "ADMIN"].includes(userMembership.role))) {
      return NextResponse.json(
        { error: "Only owners and admins can remove members" },
        { status: 403 }
      );
    }

    // Find the membership to remove
    const membershipToRemove = await db.organizationMember.findUnique({
      where: { id: memberId },
    });

    if (!membershipToRemove) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Check organization matches
    if (membershipToRemove.organizationId !== authContext.organizationId) {
      return NextResponse.json(
        { error: "Member not found in your organization" },
        { status: 404 }
      );
    }

    // Cannot remove yourself (unless admin)
    if (!authContext.isAdmin && membershipToRemove.userId === authContext.userId) {
      return NextResponse.json(
        { error: "Cannot remove yourself from the organization" },
        { status: 400 }
      );
    }

    // Cannot remove owner
    if (membershipToRemove.role === "OWNER") {
      return NextResponse.json(
        { error: "Cannot remove the organization owner" },
        { status: 400 }
      );
    }

    // Admins cannot remove other admins (only owners can), but site admins can
    if (!authContext.isAdmin && membershipToRemove.role === "ADMIN" && userMembership?.role !== "OWNER") {
      return NextResponse.json(
        { error: "Only the owner can remove administrators" },
        { status: 403 }
      );
    }

    // Delete the membership
    await db.organizationMember.delete({
      where: { id: memberId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing member:", error);
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Apply rate limiting for sensitive operations
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.sensitive);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: memberId } = await params;
    const body = await request.json();
    const { role } = body;

    if (!role || !["ADMIN", "MEMBER", "VIEWER"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role" },
        { status: 400 }
      );
    }

    // Only owners (or site admins) can change roles
    if (!authContext.isAdmin) {
      const userMembership = await db.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: authContext.organizationId,
            userId: authContext.userId,
          },
        },
      });

      if (!userMembership || userMembership.role !== "OWNER") {
        return NextResponse.json(
          { error: "Only the owner can change member roles" },
          { status: 403 }
        );
      }
    }

    // Find the membership to update
    const membershipToUpdate = await db.organizationMember.findUnique({
      where: { id: memberId },
    });

    if (!membershipToUpdate || membershipToUpdate.organizationId !== authContext.organizationId) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Cannot change owner's role
    if (membershipToUpdate.role === "OWNER") {
      return NextResponse.json(
        { error: "Cannot change the owner's role" },
        { status: 400 }
      );
    }

    // Update the role
    const updated = await db.organizationMember.update({
      where: { id: memberId },
      data: { role },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating member:", error);
    return NextResponse.json(
      { error: "Failed to update member" },
      { status: 500 }
    );
  }
}
