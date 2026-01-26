import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    // Find invitation by token
    const invitation = await db.kOLInvitation.findUnique({
      where: { token },
      include: {
        kol: {
          include: {
            organization: { select: { name: true } },
          },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invalid invitation" },
        { status: 404 }
      );
    }

    // Check if already accepted
    if (invitation.acceptedAt) {
      return NextResponse.json(
        { error: "Invitation already used" },
        { status: 400 }
      );
    }

    // Check if expired
    if (new Date() > invitation.expiresAt) {
      return NextResponse.json(
        { error: "Invitation expired" },
        { status: 400 }
      );
    }

    // Check if KOL already has an account
    const existingAccount = await db.kOLAccount.findUnique({
      where: { kolId: invitation.kolId },
    });

    if (existingAccount) {
      return NextResponse.json(
        { error: "Account already exists" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      kolId: invitation.kolId,
      kolName: invitation.kol.name,
      email: invitation.kol.email,
      organizationName: invitation.kol.organization.name,
    });
  } catch (error) {
    console.error("Verify invite error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
