/**
 * Debug Login API - Admin Only
 *
 * POST /api/auth/debug-login
 * Generates a magic link URL for testing without sending email.
 * Only accessible to admin users.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createVerificationToken } from "@/lib/magic-link";
import { getApiAuthContext } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const authContext = await getApiAuthContext();
    if (!authContext || !authContext.isAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const email = body.email?.toString()?.toLowerCase()?.trim();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email address is required" },
        { status: 400 }
      );
    }

    // Check if user account exists
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, name: true, isDisabled: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: `No user account found with email: ${email}` },
        { status: 404 }
      );
    }

    if (user.isDisabled) {
      return NextResponse.json(
        { error: "This user account is disabled" },
        { status: 400 }
      );
    }

    // Generate the magic link token
    const token = await createVerificationToken(email);

    // Build the callback URL
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const loginUrl = `${baseUrl}/api/auth/callback/magic?token=${token}&email=${encodeURIComponent(email)}`;

    return NextResponse.json({
      success: true,
      email,
      accountInfo: {
        type: "user",
        name: user.name || email,
      },
      loginUrl,
      expiresIn: "15 minutes",
      note: "This link is for testing only. Click it or paste in browser to login.",
    });
  } catch (error) {
    console.error("Debug login error:", error);
    return NextResponse.json(
      { error: "Failed to generate login link" },
      { status: 500 }
    );
  }
}
