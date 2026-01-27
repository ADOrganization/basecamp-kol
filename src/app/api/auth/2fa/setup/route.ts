/**
 * Client 2FA Setup API
 *
 * GET - Generate TOTP secret and QR code
 * POST - Verify code and enable 2FA
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateSecret, verify, generateURI } from "otplib";
import QRCode from "qrcode";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";
import { generateBackupCodes } from "@/lib/backup-codes";

// SECURITY: Lazy-load JWT secret - NEVER use fallback
function getAuthSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("SECURITY: AUTH_SECRET environment variable is required");
  }
  return new TextEncoder().encode(secret);
}

// Cookie name changes based on environment (Auth.js convention)
const isProduction = process.env.NODE_ENV === "production";
const SESSION_COOKIE_NAME = isProduction
  ? "__Secure-authjs.session-token"
  : "authjs.session-token";
const SETUP_TOKEN_NAME = "user_2fa_setup_token";

async function getUserFromToken(): Promise<{ userId: string; isSetupToken: boolean } | null> {
  const cookieStore = await cookies();

  // First check for regular session token
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (sessionToken) {
    try {
      const { payload } = await jwtVerify(sessionToken, getAuthSecret(), {
        // Auth.js uses a specific salt for encoding
      });
      if (payload.id) {
        return { userId: payload.id as string, isSetupToken: false };
      }
    } catch {
      // Token invalid, continue to check setup token
    }
  }

  // Check for 2FA setup token (for first-time setup during login)
  const setupToken = cookieStore.get(SETUP_TOKEN_NAME)?.value;
  if (setupToken) {
    try {
      const { payload } = await jwtVerify(setupToken, getAuthSecret());
      if (payload.type === "user_2fa_setup" && payload.sub) {
        return { userId: payload.sub as string, isSetupToken: true };
      }
    } catch {
      // Setup token invalid
    }
  }

  return null;
}

// GET - Generate new 2FA secret and QR code
export async function GET(request: NextRequest) {
  // SECURITY: Apply rate limiting
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.standard);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const authResult = await getUserFromToken();
    if (!authResult) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: authResult.userId },
      select: { email: true, twoFactorEnabled: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.twoFactorEnabled) {
      return NextResponse.json(
        { error: "2FA is already enabled" },
        { status: 400 }
      );
    }

    // Generate new secret
    const secret = generateSecret();

    // Create otpauth URL
    const otpauthUrl = generateURI({
      issuer: "Basecamp",
      label: user.email,
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
  // SECURITY: Apply strict rate limiting for 2FA setup
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.authFailed);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const authResult = await getUserFromToken();
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
    const verifyResult = await verify({ token: code, secret });
    const isValid = !!verifyResult;

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      );
    }

    // SECURITY: Generate cryptographically secure backup codes with hashing
    const { plainTextCodes, hashedCodes } = await generateBackupCodes(10);

    // Store the secret and enable 2FA (backup codes are hashed for security)
    const user = await db.user.update({
      where: { id: authResult.userId },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: secret,
        backupCodes: hashedCodes, // SECURITY: Store hashed codes only
      },
      include: {
        memberships: {
          include: {
            organization: true,
          },
          take: 1,
        },
      },
    });

    const cookieStore = await cookies();

    // If this was a setup token, clear it and create full session
    if (authResult.isSetupToken) {
      cookieStore.delete(SETUP_TOKEN_NAME);

      const membership = user.memberships[0];
      if (membership) {
        // Create full session token using next-auth encode
        const { encode } = await import("next-auth/jwt");
        const jwtToken = await encode({
          token: {
            id: user.id,
            email: user.email,
            name: user.name,
            organizationId: membership.organizationId,
            organizationType: membership.organization.type,
            organizationRole: membership.role,
            organizationName: membership.organization.name,
          },
          secret: process.env.AUTH_SECRET!,
          salt: SESSION_COOKIE_NAME,
          maxAge: 7 * 24 * 60 * 60, // 7 days
        });

        cookieStore.set(SESSION_COOKIE_NAME, jwtToken, {
          httpOnly: true,
          secure: isProduction,
          sameSite: "lax",
          maxAge: 7 * 24 * 60 * 60,
          path: "/",
        });

        // Update last login
        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
      }
    }

    const redirectTo = user.memberships[0]?.organization.type === "AGENCY"
      ? "/dashboard"
      : "/client/dashboard";

    return NextResponse.json({
      success: true,
      backupCodes: plainTextCodes, // Return plain text codes to show user ONCE
      redirectTo: authResult.isSetupToken ? redirectTo : undefined,
    });
  } catch (error) {
    console.error("[2FA Setup] Enable error:", error);
    return NextResponse.json(
      { error: "Failed to enable 2FA" },
      { status: 500 }
    );
  }
}
