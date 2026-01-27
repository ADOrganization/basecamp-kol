import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { SignJWT } from "jose";
import { verify } from "otplib";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";
import { logSecurityEvent, getRequestMetadata } from "@/lib/security-audit";
import {
  verifyBackupCode,
  areCodesHashed,
  timingSafeBackupCodeCheck,
} from "@/lib/backup-codes";

// SECURITY: Lazy-load JWT secret - NEVER use hardcoded fallback
function getAdminJwtSecret(): Uint8Array {
  const secret = process.env.ADMIN_JWT_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("SECURITY: ADMIN_JWT_SECRET or AUTH_SECRET environment variable is required");
  }
  return new TextEncoder().encode(secret);
}

// SECURITY: Backup code utilities imported from @/lib/backup-codes

export async function POST(request: NextRequest) {
  // SECURITY: Apply strict rate limiting to prevent brute force attacks
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.authFailed);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { ipAddress, userAgent } = getRequestMetadata(request);

  try {
    const { email, password, twoFactorCode } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Find admin user
    const admin = await db.adminUser.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!admin) {
      // SECURITY: Log failed attempt for security monitoring
      await logSecurityEvent({
        action: "LOGIN_FAILED",
        ipAddress: ipAddress || undefined,
        userAgent: userAgent || undefined,
        metadata: { email, reason: "Admin not found" },
      });
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    if (!admin.isActive) {
      return NextResponse.json(
        { error: "Account is disabled" },
        { status: 403 }
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, admin.passwordHash);

    if (!isValidPassword) {
      // SECURITY: Log failed attempt for security monitoring
      await logSecurityEvent({
        action: "LOGIN_FAILED",
        ipAddress: ipAddress || undefined,
        userAgent: userAgent || undefined,
        metadata: { email, reason: "Invalid password" },
      });
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Check if 2FA is enabled
    if (admin.twoFactorEnabled && admin.twoFactorSecret) {
      // If no 2FA code provided, tell client to show 2FA input
      if (!twoFactorCode) {
        return NextResponse.json(
          {
            requires2FA: true,
            message: "Please enter your 2FA code"
          },
          { status: 200 }
        );
      }

      // Verify 2FA code
      const isValidCode = await verify({
        token: twoFactorCode,
        secret: admin.twoFactorSecret,
      });

      // SECURITY: Check backup codes (supports both hashed and legacy plain text)
      let backupCodeIndex = -1;
      let isBackupCode = false;

      if (!isValidCode) {
        const codesAreHashed = areCodesHashed(admin.backupCodes);
        if (codesAreHashed) {
          // SECURITY: Use bcrypt comparison for hashed codes
          backupCodeIndex = await verifyBackupCode(twoFactorCode, admin.backupCodes);
        } else {
          // Legacy: Use timing-safe comparison for plain text codes
          backupCodeIndex = timingSafeBackupCodeCheck(twoFactorCode, admin.backupCodes);
        }
        isBackupCode = backupCodeIndex !== -1;
      }

      if (!isValidCode && !isBackupCode) {
        // SECURITY: Log 2FA failure
        await logSecurityEvent({
          action: "2FA_VERIFICATION_FAILED",
          ipAddress: ipAddress || undefined,
          userAgent: userAgent || undefined,
          metadata: { email, reason: "Invalid 2FA code" },
        });
        return NextResponse.json(
          { error: "Invalid 2FA code" },
          { status: 401 }
        );
      }

      // If backup code was used, remove it
      if (isBackupCode) {
        const newBackupCodes = [...admin.backupCodes];
        newBackupCodes.splice(backupCodeIndex, 1);
        await db.adminUser.update({
          where: { id: admin.id },
          data: { backupCodes: newBackupCodes },
        });

        await logSecurityEvent({
          action: "BACKUP_CODE_USED",
          ipAddress: ipAddress || undefined,
          userAgent: userAgent || undefined,
          metadata: { email, remainingCodes: newBackupCodes.length },
        });
      }
    } else {
      // 2FA is not enabled - require setup for all admin accounts
      // Create a temporary token for 2FA setup only
      const setupToken = await new SignJWT({
        sub: admin.id,
        email: admin.email,
        type: "admin_2fa_setup",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("15m") // 15 minutes to complete setup
        .sign(getAdminJwtSecret());

      // Set a temporary cookie for 2FA setup
      const cookieStore = await cookies();
      cookieStore.set("admin_2fa_setup_token", setupToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 15 * 60, // 15 minutes
        path: "/",
      });

      return NextResponse.json({
        requires2FASetup: true,
        message: "Two-factor authentication setup is required for all admin accounts",
      });
    }

    // Update last login
    await db.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    // Create JWT token
    const token = await new SignJWT({
      sub: admin.id,
      email: admin.email,
      name: admin.name,
      type: "admin",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("8h")
      .sign(getAdminJwtSecret());

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 8 * 60 * 60, // 8 hours
      path: "/",
    });

    // SECURITY: Log successful login
    await logSecurityEvent({
      action: "LOGIN_SUCCESS",
      ipAddress: ipAddress || undefined,
      userAgent: userAgent || undefined,
      metadata: { email, adminId: admin.id },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
      },
    });
  } catch (error) {
    console.error("[Admin Auth] Login error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
