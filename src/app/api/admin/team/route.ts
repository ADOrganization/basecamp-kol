import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

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

// GET - List all admin team members
export async function GET() {
  try {
    const admin = await getAdminFromToken();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admins = await db.adminUser.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        twoFactorEnabled: true,
        invitedBy: true,
        invitedAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ admins });
  } catch (error) {
    console.error("[Admin Team] Error fetching team:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin team" },
      { status: 500 }
    );
  }
}

// POST - Invite new admin team member
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromToken();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only SUPER_ADMIN can invite new admins
    if (admin.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only super admins can invite team members" },
        { status: 403 }
      );
    }

    const { email, name, role } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Check if admin already exists
    const existingAdmin = await db.adminUser.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingAdmin) {
      return NextResponse.json(
        { error: "An admin with this email already exists" },
        { status: 400 }
      );
    }

    // Generate a temporary password
    const tempPassword = crypto.randomBytes(12).toString("hex");
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    // Create the new admin
    const newAdmin = await db.adminUser.create({
      data: {
        email: email.toLowerCase(),
        name: name || null,
        passwordHash,
        role: role || "ADMIN",
        invitedBy: admin.id,
        invitedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    // In production, you would send an email with the temp password
    // For now, return it in the response
    return NextResponse.json({
      admin: newAdmin,
      tempPassword, // Remove this in production - send via email instead
      message: "Admin invited successfully. Share the temporary password securely.",
    });
  } catch (error) {
    console.error("[Admin Team] Error inviting admin:", error);
    return NextResponse.json(
      { error: "Failed to invite admin" },
      { status: 500 }
    );
  }
}
