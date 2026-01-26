import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { SignJWT } from "jose";
import { verify } from "otplib";

const ADMIN_JWT_SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || process.env.AUTH_SECRET || "admin-secret-key"
);

export async function POST(request: NextRequest) {
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
      // Log failed attempt
      console.log(`[Admin Auth] Failed login attempt for: ${email}`);
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
      console.log(`[Admin Auth] Invalid password for: ${email}`);
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

      // Also check backup codes
      const isBackupCode = admin.backupCodes.includes(twoFactorCode.toUpperCase());

      if (!isValidCode && !isBackupCode) {
        return NextResponse.json(
          { error: "Invalid 2FA code" },
          { status: 401 }
        );
      }

      // If backup code was used, remove it
      if (isBackupCode) {
        await db.adminUser.update({
          where: { id: admin.id },
          data: {
            backupCodes: admin.backupCodes.filter(
              (code) => code !== twoFactorCode.toUpperCase()
            ),
          },
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
        .sign(ADMIN_JWT_SECRET);

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
      .sign(ADMIN_JWT_SECRET);

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 8 * 60 * 60, // 8 hours
      path: "/",
    });

    console.log(`[Admin Auth] Successful login for: ${email}`);

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
