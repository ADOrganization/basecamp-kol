/**
 * Client 2FA Status API
 *
 * GET - Check if 2FA is enabled for current user
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET - Check 2FA status
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        twoFactorEnabled: true,
        backupCodes: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      twoFactorEnabled: user.twoFactorEnabled,
      backupCodesCount: user.backupCodes.length,
    });
  } catch (error) {
    console.error("[2FA Status] Error:", error);
    return NextResponse.json(
      { error: "Failed to get 2FA status" },
      { status: 500 }
    );
  }
}
