import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

// One-time setup endpoint for creating initial admin user
// Protected by a secret token that must match ADMIN_SETUP_SECRET env var
export async function POST(req: NextRequest) {
  try {
    const { setupSecret, email, password, name } = await req.json();

    // Verify setup secret
    const expectedSecret = process.env.ADMIN_SETUP_SECRET;
    if (!expectedSecret) {
      return NextResponse.json(
        { error: "Admin setup not configured" },
        { status: 500 }
      );
    }

    if (setupSecret !== expectedSecret) {
      return NextResponse.json(
        { error: "Invalid setup secret" },
        { status: 403 }
      );
    }

    // Check if any admin user already exists
    const existingAdmin = await db.adminUser.findFirst();
    if (existingAdmin) {
      return NextResponse.json(
        { error: "Admin user already exists", email: existingAdmin.email },
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
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create admin user", details: errorMessage },
      { status: 500 }
    );
  }
}
