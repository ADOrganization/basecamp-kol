import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const kolAcceptInviteSchema = z.object({
  token: z.string().min(1, "Invitation token is required"),
});

/**
 * KOL Registration API
 *
 * POST /api/kol/auth/register
 * Completes KOL registration from an invitation link.
 * This is a passwordless flow - KOLs authenticate via magic link after registration.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = kolAcceptInviteSchema.parse(body);

    // Find the invitation
    const invitation = await db.kOLInvitation.findUnique({
      where: { token: validatedData.token },
      include: {
        kol: {
          include: {
            organization: true,
            account: true,
          },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invalid invitation token" },
        { status: 400 }
      );
    }

    // Check if invitation is expired
    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Invitation has expired" },
        { status: 400 }
      );
    }

    // Check if invitation was already accepted
    if (invitation.acceptedAt) {
      return NextResponse.json(
        { error: "Invitation has already been used" },
        { status: 400 }
      );
    }

    // Check if KOL already has an account
    if (invitation.kol.account) {
      return NextResponse.json(
        { error: "Account already exists for this KOL" },
        { status: 400 }
      );
    }

    // Get the email from the KOL record
    const email = invitation.kol.email;
    if (!email) {
      return NextResponse.json(
        { error: "KOL does not have an email address configured" },
        { status: 400 }
      );
    }

    // Create the KOL account (passwordless) and mark invitation as accepted
    await db.$transaction([
      db.kOLAccount.create({
        data: {
          kolId: invitation.kolId,
          email: email,
          // No password - KOLs authenticate via magic link
          isVerified: true,
        },
      }),
      db.kOLInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Account created successfully. You can now sign in using your email.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    console.error("KOL registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
