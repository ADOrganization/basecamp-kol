import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const ADMIN_JWT_SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || process.env.AUTH_SECRET || "admin-secret-key"
);

async function getAdminFromToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, ADMIN_JWT_SECRET);
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
  try {
    const admin = await getAdminFromToken();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Cannot modify yourself
    if (admin.id === id) {
      return NextResponse.json(
        { error: "Cannot modify your own account through this endpoint" },
        { status: 400 }
      );
    }

    // Get the target admin to check their role
    const targetAdmin = await db.adminUser.findUnique({
      where: { id },
      select: { role: true },
    });

    if (!targetAdmin) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    const { name, role, isActive } = await request.json();

    // Permission checks based on current admin's role
    if (admin.role !== "SUPER_ADMIN") {
      if (admin.role !== "ADMIN") {
        return NextResponse.json(
          { error: "You don't have permission to modify team members" },
          { status: 403 }
        );
      }
      // ADMIN cannot modify SUPER_ADMIN accounts
      if (targetAdmin.role === "SUPER_ADMIN") {
        return NextResponse.json(
          { error: "You cannot modify super admin accounts" },
          { status: 403 }
        );
      }
      // ADMIN cannot promote someone to SUPER_ADMIN
      if (role === "SUPER_ADMIN") {
        return NextResponse.json(
          { error: "Only super admins can grant super admin privileges" },
          { status: 403 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;
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
  try {
    const admin = await getAdminFromToken();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Cannot delete yourself
    if (admin.id === id) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      );
    }

    // Get the target admin to check their role
    const targetAdmin = await db.adminUser.findUnique({
      where: { id },
      select: { role: true },
    });

    if (!targetAdmin) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    // Permission checks
    if (admin.role !== "SUPER_ADMIN") {
      if (admin.role !== "ADMIN") {
        return NextResponse.json(
          { error: "You don't have permission to remove team members" },
          { status: 403 }
        );
      }
      // ADMIN cannot deactivate SUPER_ADMIN accounts
      if (targetAdmin.role === "SUPER_ADMIN") {
        return NextResponse.json(
          { error: "You cannot deactivate super admin accounts" },
          { status: 403 }
        );
      }
    }

    // Soft delete - just deactivate
    await db.adminUser.update({
      where: { id },
      data: { isActive: false },
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
