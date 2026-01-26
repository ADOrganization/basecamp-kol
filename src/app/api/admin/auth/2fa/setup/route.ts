import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateSecret, verify, generateURI } from "otplib";
import QRCode from "qrcode";
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

// GET - Generate new 2FA secret and QR code
export async function GET() {
  try {
    const adminId = await getAdminFromToken();
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await db.adminUser.findUnique({
      where: { id: adminId },
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
    const adminId = await getAdminFromToken();
    if (!adminId) {
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
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      backupCodes.push(code);
    }

    // Store the secret and enable 2FA
    await db.adminUser.update({
      where: { id: adminId },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: secret,
        backupCodes: backupCodes, // In production, hash these
      },
    });

    return NextResponse.json({
      success: true,
      backupCodes, // Show these once to the user
    });
  } catch (error) {
    console.error("[2FA Setup] Enable error:", error);
    return NextResponse.json(
      { error: "Failed to enable 2FA" },
      { status: 500 }
    );
  }
}
