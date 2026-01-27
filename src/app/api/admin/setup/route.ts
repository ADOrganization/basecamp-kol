import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "@/lib/admin-auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";
import { logSecurityEvent, getRequestMetadata } from "@/lib/security-audit";

// One-time setup endpoint for creating initial admin user
// Protected by a secret token that must match ADMIN_SETUP_SECRET env var
// SECURITY: Disabled in production unless explicitly enabled
export async function POST(req: NextRequest) {
  // SECURITY: Apply strict rate limiting
  const rateLimitResponse = applyRateLimit(req, RATE_LIMITS.authFailed);
  if (rateLimitResponse) return rateLimitResponse;

  const { ipAddress, userAgent } = getRequestMetadata(req);

  try {
    // SECURITY: Block this endpoint in production unless explicitly enabled
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_ADMIN_SETUP !== "true") {
      console.warn("[SECURITY] Blocked attempt to access admin setup endpoint in production");
      await logSecurityEvent({
        action: "LOGIN_FAILED",
        ipAddress: ipAddress || undefined,
        userAgent: userAgent || undefined,
        metadata: { reason: "Admin setup endpoint blocked in production" },
      });
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { setupSecret, email, password, name } = await req.json();

    // Verify setup secret
    const expectedSecret = process.env.ADMIN_SETUP_SECRET;
    if (!expectedSecret) {
      return NextResponse.json(
        { error: "Admin setup not configured" },
        { status: 500 }
      );
    }

    // SECURITY: Use timing-safe comparison to prevent timing attacks
    if (!timingSafeEqual(setupSecret || "", expectedSecret)) {
      await logSecurityEvent({
        action: "LOGIN_FAILED",
        ipAddress: ipAddress || undefined,
        userAgent: userAgent || undefined,
        metadata: { reason: "Invalid setup secret for admin creation" },
      });
      return NextResponse.json(
        { error: "Invalid setup secret" },
        { status: 403 }
      );
    }

    // Check if any admin user already exists
    const existingAdmin = await db.adminUser.findFirst();
    if (existingAdmin) {
      // SECURITY: Don't reveal existing admin email
      return NextResponse.json(
        { error: "Admin user already exists" },
        { status: 400 }
      );
    }

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create admin user
    const admin = await db.adminUser.create({
      data: {
        email,
        passwordHash,
        name: name || "Admin",
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Admin user created successfully",
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
      },
    });
  } catch (error) {
    console.error("Admin setup error:", error);
    // SECURITY: Don't expose error details in response
    return NextResponse.json(
      { error: "Failed to create admin user" },
      { status: 500 }
    );
  }
}
