/**
 * Client 2FA Verification API
 *
 * POST - Verify 2FA code during login
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verify } from "otplib";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { encode } from "next-auth/jwt";
import { logSecurityEvent } from "@/lib/security-audit";

const AUTH_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "auth-secret-key"
);

// Cookie name changes based on environment (Auth.js convention)
const isProduction = process.env.NODE_ENV === "production";
const SESSION_COOKIE_NAME = isProduction
  ? "__Secure-authjs.session-token"
  : "authjs.session-token";
const VERIFY_TOKEN_NAME = "user_2fa_verify_token";

// POST - Verify 2FA code and create session
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const verifyToken = cookieStore.get(VERIFY_TOKEN_NAME)?.value;

    if (!verifyToken) {
      return NextResponse.json(
        { error: "No verification session found" },
        { status: 401 }
      );
    }

    // Verify the token
    let userId: string;
    try {
      const { payload } = await jwtVerify(verifyToken, AUTH_SECRET);
      if (payload.type !== "user_2fa_verify" || !payload.sub) {
        throw new Error("Invalid token type");
      }
      userId = payload.sub as string;
    } catch {
      return NextResponse.json(
        { error: "Invalid or expired verification session" },
        { status: 401 }
      );
    }

    const { code } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: "Verification code is required" },
        { status: 400 }
      );
    }

    // Get user with 2FA secret
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            organization: true,
          },
          take: 1,
        },
      },
    });

    if (!user || !user.twoFactorSecret) {
      return NextResponse.json(
        { error: "User not found or 2FA not configured" },
        { status: 404 }
      );
    }

    if (user.isDisabled) {
      return NextResponse.json(
        { error: "Account is disabled" },
        { status: 403 }
      );
    }

    // Try TOTP verification first
    const totpResult = await verify({ token: code, secret: user.twoFactorSecret });
    let isValid = !!totpResult;
    let usedBackupCode = false;

    // If TOTP failed, try backup codes
    // Backup codes can be in format XXXXX-XXXXX (11 chars) or XXXXXXXXXX (10 chars)
    const normalizedCode = code.toUpperCase().replace(/-/g, "");
    if (!isValid && (normalizedCode.length === 10 || code.length === 8)) {
      // Try matching with both formats (with and without hyphen)
      const backupCodeIndex = user.backupCodes.findIndex((bc) => {
        const normalizedBackup = bc.toUpperCase().replace(/-/g, "");
        return normalizedBackup === normalizedCode || bc.toUpperCase() === code.toUpperCase();
      });

      if (backupCodeIndex !== -1) {
        isValid = true;
        usedBackupCode = true;
        // Remove used backup code
        const newBackupCodes = [...user.backupCodes];
        newBackupCodes.splice(backupCodeIndex, 1);

        await db.user.update({
          where: { id: user.id },
          data: { backupCodes: newBackupCodes },
        });

        await logSecurityEvent({
          action: "BACKUP_CODE_USED",
          userId: user.id,
          metadata: { remainingCodes: newBackupCodes.length },
        });
      }
    }

    if (!isValid) {
      await logSecurityEvent({
        action: "2FA_VERIFICATION_FAILED",
        userId: user.id,
        metadata: { email: user.email },
      });

      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      );
    }

    const membership = user.memberships[0];
    if (!membership) {
      return NextResponse.json(
        { error: "No organization membership found" },
        { status: 400 }
      );
    }

    // Clear verify token
    cookieStore.delete(VERIFY_TOKEN_NAME);

    // Create full session token
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

    await logSecurityEvent({
      action: "LOGIN_SUCCESS",
      userId: user.id,
      metadata: { email: user.email, method: "magic_link_2fa" },
    });

    const redirectTo = membership.organization.type === "AGENCY"
      ? "/agency/dashboard"
      : "/client/dashboard";

    return NextResponse.json({
      success: true,
      redirectTo,
    });
  } catch (error) {
    console.error("[2FA Verify] Error:", error);
    return NextResponse.json(
      { error: "Failed to verify 2FA code" },
      { status: 500 }
    );
  }
}
