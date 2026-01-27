import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";

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
    return payload.sub as string;
  } catch {
    return null;
  }
}

// GET - Get 2FA status
export async function GET(request: NextRequest) {
  // SECURITY: Apply rate limiting
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.standard);
  if (rateLimitResponse) return rateLimitResponse;

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
