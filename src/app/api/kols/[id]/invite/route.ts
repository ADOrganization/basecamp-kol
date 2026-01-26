import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    const { id: kolId } = await context.params;

    if (!session?.user?.organizationType || session.user.organizationType !== "AGENCY") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Verify KOL exists and belongs to the organization
    const kol = await db.kOL.findUnique({
      where: { id: kolId },
      include: {
        account: true,
        organization: { select: { name: true } },
      },
    });

    if (!kol || kol.organizationId !== session.user.organizationId) {
      return NextResponse.json(
        { error: "KOL not found" },
        { status: 404 }
      );
    }

    // Check if KOL already has an account
    if (kol.account) {
      return NextResponse.json(
        { error: "KOL already has a portal account" },
        { status: 400 }
      );
    }

    // Check if KOL has an email
    if (!kol.email) {
      return NextResponse.json(
        { error: "KOL does not have an email address. Please add an email first." },
        { status: 400 }
      );
    }

    // Check for existing valid invitation
    const existingInvitation = await db.kOLInvitation.findFirst({
      where: {
        kolId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvitation) {
      // Return existing invitation link
      const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/kol/accept-invite?token=${existingInvitation.token}`;
      return NextResponse.json({
        inviteUrl,
        expiresAt: existingInvitation.expiresAt,
        message: "Existing invitation still valid",
      });
    }

    // Generate new invitation token
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    // Create invitation
    const invitation = await db.kOLInvitation.create({
      data: {
        kolId,
        token,
        expiresAt,
      },
    });

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/kol/accept-invite?token=${invitation.token}`;

    return NextResponse.json({
      inviteUrl,
      expiresAt: invitation.expiresAt,
      kolName: kol.name,
      kolEmail: kol.email,
      message: "Invitation created successfully",
    });
  } catch (error) {
    console.error("Create invitation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
