import { NextResponse } from "next/server";
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
    return payload.sub as string;
  } catch {
    return null;
  }
}

// GET - Get 2FA status
export async function GET() {
  try {
    const adminId = await getAdminFromToken();
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await db.adminUser.findUnique({
      where: { id: adminId },
      select: {
        twoFactorEnabled: true,
        backupCodes: true,
      },
    });

    if (!admin) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    return NextResponse.json({
      enabled: admin.twoFactorEnabled,
      backupCodesRemaining: admin.backupCodes.length,
    });
  } catch (error) {
    console.error("[2FA Status] Error:", error);
    return NextResponse.json(
      { error: "Failed to get 2FA status" },
      { status: 500 }
    );
  }
}
