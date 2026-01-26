import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateSecret, verify, generateURI } from "otplib";
import QRCode from "qrcode";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const ADMIN_JWT_SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || process.env.AUTH_SECRET || "admin-secret-key"
);

async function getAdminFromToken(): Promise<{ adminId: string; isSetupToken: boolean } | null> {
  const cookieStore = await cookies();

  // First check for regular admin token
  const token = cookieStore.get("admin_token")?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, ADMIN_JWT_SECRET);
      if (payload.type === "admin" && payload.sub) {
        return { adminId: payload.sub as string, isSetupToken: false };
      }
    } catch {
      // Token invalid, continue to check setup token
    }
  }

  // Check for 2FA setup token (for first-time setup during login)
  const setupToken = cookieStore.get("admin_2fa_setup_token")?.value;
  if (setupToken) {
    try {
      const { payload } = await jwtVerify(setupToken, ADMIN_JWT_SECRET);
      if (payload.type === "admin_2fa_setup" && payload.sub) {
        return { adminId: payload.sub as string, isSetupToken: true };
      }
    } catch {
      // Setup token invalid
    }
  }

  return null;
}

// GET - Generate new 2FA secret and QR code
export async function GET() {
  try {
    const authResult = await getAdminFromToken();
    if (!authResult) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await db.adminUser.findUnique({
      where: { id: authResult.adminId },
      select: { email: true, twoFactorEnabled: true },
    });

    if (!admin) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    if (admin.twoFactorEnabled) {
      return NextResponse.json(
        { error: "2FA is already enabled" },
        { status: 400 }
      );
    }

    // Generate new secret
    const secret = generateSecret();

    // Create otpauth URL
    const otpauthUrl = generateURI({
      issuer: "Basecamp Admin",
      label: admin.email,
      secret,
    });

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    return NextResponse.json({
      secret,
      qrCode: qrCodeDataUrl,
    });
  } catch (error) {
    console.error("[2FA Setup] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate 2FA setup" },
      { status: 500 }
    );
  }
}

// POST - Verify and enable 2FA
export async function POST(request: NextRequest) {
  try {
    const authResult = await getAdminFromToken();
    if (!authResult) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { secret, code } = await request.json();

    if (!secret || !code) {
      return NextResponse.json(
        { error: "Secret and verification code are required" },
        { status: 400 }
      );
    }

    // Verify the code
    const isValid = await verify({ token: code, secret });

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      );
    }

    // Generate backup codes
    const backupCodes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const backupCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      backupCodes.push(backupCode);
    }

    // Store the secret and enable 2FA
    const admin = await db.adminUser.update({
      where: { id: authResult.adminId },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: secret,
        backupCodes: backupCodes,
      },
    });

    // If this was a setup token (first-time login), clear it and create full session
    const cookieStore = await cookies();
    if (authResult.isSetupToken) {
      cookieStore.delete("admin_2fa_setup_token");

      // Create full admin session token
      const { SignJWT } = await import("jose");
      const token = await new SignJWT({
        sub: admin.id,
        email: admin.email,
        name: admin.name,
        type: "admin",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("8h")
        .sign(ADMIN_JWT_SECRET);

      cookieStore.set("admin_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 8 * 60 * 60,
        path: "/",
      });

      // Update last login
      await db.adminUser.update({
        where: { id: admin.id },
        data: { lastLoginAt: new Date() },
      });
    }

    return NextResponse.json({
      success: true,
      backupCodes,
      redirectTo: authResult.isSetupToken ? "/agency/dashboard" : undefined,
    });
  } catch (error) {
    console.error("[2FA Setup] Enable error:", error);
    return NextResponse.json(
      { error: "Failed to enable 2FA" },
      { status: 500 }
    );
  }
}
