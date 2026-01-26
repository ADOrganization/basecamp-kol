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
    const userType = body.userType === "kol" ? "kol" : "user";

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email address is required" },
        { status: 400 }
      );
    }

    // Check if user/KOL account exists
    let userExists = false;
    let accountInfo = null;

    if (userType === "kol") {
      const kolAccount = await db.kOLAccount.findUnique({
        where: { email },
        select: {
          id: true,
          isDisabled: true,
          kol: {
            select: { name: true, twitterHandle: true }
          }
        },
      });
      userExists = !!kolAccount;
      if (kolAccount?.isDisabled) {
        return NextResponse.json(
          { error: "This KOL account is disabled" },
          { status: 400 }
        );
      }
      if (kolAccount) {
        accountInfo = {
          type: "kol",
          name: kolAccount.kol?.name || email,
          handle: kolAccount.kol?.twitterHandle,
        };
      }
    } else {
      const user = await db.user.findUnique({
        where: { email },
        select: { id: true, name: true, isDisabled: true },
      });
      userExists = !!user;
      if (user?.isDisabled) {
        return NextResponse.json(
          { error: "This user account is disabled" },
          { status: 400 }
        );
      }
      if (user) {
        accountInfo = {
          type: "user",
          name: user.name || email,
        };
      }
    }

    if (!userExists) {
      return NextResponse.json(
        { error: `No ${userType} account found with email: ${email}` },
        { status: 404 }
      );
    }

    // Generate the magic link token
    const token = await createVerificationToken(email);

    // Build the callback URL
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const callbackPath = userType === "kol" ? "/api/auth/callback/kol-magic" : "/api/auth/callback/magic";
    const loginUrl = `${baseUrl}${callbackPath}?token=${token}&email=${encodeURIComponent(email)}`;

    return NextResponse.json({
      success: true,
      email,
      userType,
      accountInfo,
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
