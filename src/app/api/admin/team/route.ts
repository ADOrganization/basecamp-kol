import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// SECURITY: Lazy-load JWT secret to avoid build-time errors
function getAdminJwtSecret(): Uint8Array {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_JWT_SECRET required in production");
  }
  return new TextEncoder().encode(secret || process.env.AUTH_SECRET || "dev-only-admin-secret");
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

    // Only SUPER_ADMIN can invite new team members
    if (admin.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only super admins can invite team members" },
        { status: 403 }
      );
    }

    const { email, name } = await request.json();

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

    // Create the new admin (always USER role - only one SUPER_ADMIN exists)
    const newAdmin = await db.adminUser.create({
      data: {
        email: email.toLowerCase(),
        name: name || null,
        passwordHash,
        role: "USER",
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

    // SECURITY: In production, send temp password via email only
    // Never expose credentials in API responses in production
    if (process.env.NODE_ENV === "production") {
      // TODO: Send email with temp password using your email service
      // await sendAdminInviteEmail(newAdmin.email, tempPassword);
      console.log(`[Admin Team] Admin invited: ${newAdmin.email} - temp password should be sent via email`);

      return NextResponse.json({
        admin: newAdmin,
        message: "Admin invited successfully. Temporary password will be sent via email.",
      });
    }

    // Development only: return temp password for testing
    return NextResponse.json({
      admin: newAdmin,
      tempPassword, // DEV ONLY - never in production
      message: "Admin invited successfully. (DEV: temp password included in response)",
    });
  } catch (error) {
    console.error("[Admin Team] Error inviting admin:", error);
    return NextResponse.json(
      { error: "Failed to invite admin" },
      { status: 500 }
    );
  }
}
