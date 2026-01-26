import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

// Password reset endpoint for admin users
// Protected by ADMIN_SETUP_SECRET env var
export async function POST(req: NextRequest) {
  try {
    const { setupSecret, email, newPassword } = await req.json();

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

    // Validate input
    if (!email || !newPassword) {
      return NextResponse.json(
        { error: "Email and newPassword are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Find admin user
    const admin = await db.adminUser.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!admin) {
      return NextResponse.json(
        { error: "Admin user not found" },
        { status: 404 }
      );
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await db.adminUser.update({
      where: { id: admin.id },
      data: { passwordHash },
    });

    return NextResponse.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Password reset error:", error);
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 }
    );
  }
}
