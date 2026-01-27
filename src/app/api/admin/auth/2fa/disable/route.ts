import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import bcrypt from "bcryptjs";
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
    return payload.sub as string;
  } catch {
    return null;
  }
}

// POST - Disable 2FA (requires password confirmation)
export async function POST(request: NextRequest) {
  // SECURITY: Apply strict rate limiting - this is a sensitive operation
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.authFailed);
  if (rateLimitResponse) return rateLimitResponse;

  const { ipAddress, userAgent } = getRequestMetadata(request);

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
      await logSecurityEvent({
        action: "2FA_VERIFICATION_FAILED",
        ipAddress: ipAddress || undefined,
        userAgent: userAgent || undefined,
        metadata: { adminId, reason: "Invalid password for 2FA disable" },
      });
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

    // SECURITY: Log 2FA disable event
    await logSecurityEvent({
      action: "2FA_DISABLED",
      ipAddress: ipAddress || undefined,
      userAgent: userAgent || undefined,
      metadata: { adminId, email: admin.email },
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
