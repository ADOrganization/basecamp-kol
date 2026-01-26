import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import bcrypt from "bcryptjs";

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
    return payload.sub as string;
  } catch {
    return null;
  }
}

// POST - Disable 2FA (requires password confirmation)
export async function POST(request: NextRequest) {
  try {
    const adminId = await getAdminFromToken();
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { password } = await request.json();

    if (!password) {
      return NextResponse.json(
        { error: "Password is required to disable 2FA" },
        { status: 400 }
      );
    }

    const admin = await db.adminUser.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, admin.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Invalid password" },
        { status: 401 }
      );
    }

    // Disable 2FA
    await db.adminUser.update({
      where: { id: adminId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        backupCodes: [],
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[2FA Disable] Error:", error);
    return NextResponse.json(
      { error: "Failed to disable 2FA" },
      { status: 500 }
    );
  }
}
