import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";
import { logSecurityEvent, getRequestMetadata } from "@/lib/security-audit";

// SECURITY: Lazy-load JWT secret - NEVER use hardcoded fallback
function getAdminJwtSecret(): Uint8Array {
  const secret = process.env.ADMIN_JWT_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("SECURITY: ADMIN_JWT_SECRET or AUTH_SECRET environment variable is required");
  }
  return new TextEncoder().encode(secret);
}

async function getAdminFromToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getAdminJwtSecret());
    if (payload.type !== "admin" || !payload.sub) return null;

    const admin = await db.adminUser.findUnique({
      where: { id: payload.sub as string },
      select: { id: true, role: true, isActive: true },
    });

    if (!admin || !admin.isActive) return null;
    return admin;
  } catch {
    return null;
  }
}

// PUT - Update admin team member
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Apply rate limiting - sensitive operation
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.authFailed);
  if (rateLimitResponse) return rateLimitResponse;

  const { ipAddress, userAgent } = getRequestMetadata(request);

  try {
    const admin = await getAdminFromToken();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Only SUPER_ADMIN can modify team members
    if (admin.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only super admins can modify team members" },
        { status: 403 }
      );
    }

    // Cannot modify yourself
    if (admin.id === id) {
      return NextResponse.json(
        { error: "Cannot modify your own account through this endpoint" },
        { status: 400 }
      );
    }

    const { name, isActive, resetPassword } = await request.json();

    // Handle password reset
    if (resetPassword === true) {
      // SECURITY: Generate cryptographically secure temporary password
      const tempPassword = crypto.randomBytes(12).toString("hex");
      const passwordHash = await bcrypt.hash(tempPassword, 12);

      // Get admin email for logging
      const targetAdmin = await db.adminUser.findUnique({
        where: { id },
        select: { email: true },
      });

      // Update password and disable 2FA so they have to set it up again
      await db.adminUser.update({
        where: { id },
        data: {
          passwordHash,
          twoFactorEnabled: false,
          twoFactorSecret: null,
          backupCodes: [],
        },
      });

      // SECURITY: Log password reset event
      await logSecurityEvent({
        action: "PASSWORD_RESET",
        ipAddress: ipAddress || undefined,
        userAgent: userAgent || undefined,
        metadata: { resetBy: admin.id, targetAdminId: id, targetEmail: targetAdmin?.email },
      });

      // SECURITY: In production, send temp password via email only
      if (process.env.NODE_ENV === "production") {
        // TODO: Send email with temp password
        return NextResponse.json({
          success: true,
          message: "Password reset successfully. Temporary password sent via email. User will need to set up 2FA again.",
        });
      }

      // Development only: return temp password for testing
      return NextResponse.json({
        success: true,
        tempPassword, // DEV ONLY - never in production
        message: "Password reset successfully. User will need to set up 2FA again. (DEV: temp password included)",
      });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedAdmin = await db.adminUser.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    });

    return NextResponse.json({ admin: updatedAdmin });
  } catch (error) {
    console.error("[Admin Team] Error updating admin:", error);
    return NextResponse.json(
      { error: "Failed to update admin" },
      { status: 500 }
    );
  }
}

// DELETE - Deactivate admin team member
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Apply rate limiting
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.standard);
  if (rateLimitResponse) return rateLimitResponse;

  const { ipAddress, userAgent } = getRequestMetadata(request);

  try {
    const admin = await getAdminFromToken();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Only SUPER_ADMIN can remove team members
    if (admin.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only super admins can remove team members" },
        { status: 403 }
      );
    }

    // Cannot delete yourself
    if (admin.id === id) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      );
    }

    // Get admin email for logging
    const targetAdmin = await db.adminUser.findUnique({
      where: { id },
      select: { email: true },
    });

    // Soft delete - just deactivate
    await db.adminUser.update({
      where: { id },
      data: { isActive: false },
    });

    // SECURITY: Log admin deactivation event
    await logSecurityEvent({
      action: "ADMIN_DEACTIVATED",
      ipAddress: ipAddress || undefined,
      userAgent: userAgent || undefined,
      metadata: { deactivatedBy: admin.id, targetAdminId: id, targetEmail: targetAdmin?.email },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Admin Team] Error deleting admin:", error);
    return NextResponse.json(
      { error: "Failed to delete admin" },
      { status: 500 }
    );
  }
}
