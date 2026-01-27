import { NextRequest, NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";
import crypto from "crypto";
import { sendClientPortalAccessEmail } from "@/lib/email";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST - Resend login link to client
export async function POST(request: NextRequest, { params }: RouteParams) {
  // SECURITY: Apply strict rate limiting to prevent email spam (5 per 5 minutes)
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.emailResend);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (authContext.organizationType !== "AGENCY" && !authContext.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Verify client belongs to this agency's campaigns
    const client = await db.organization.findFirst({
      where: {
        id,
        type: "CLIENT",
        clientCampaigns: {
          some: {
            agencyId: authContext.organizationId,
          },
        },
      },
      include: {
        members: {
          include: {
            user: true,
          },
        },
        clientCampaigns: {
          where: {
            agencyId: authContext.organizationId,
          },
          take: 1,
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const user = client.members[0]?.user;
    if (!user) {
      return NextResponse.json({ error: "Client user not found" }, { status: 404 });
    }

    const campaign = client.clientCampaigns[0];

    // Delete any existing tokens for this user
    await db.verificationToken.deleteMany({
      where: { identifier: user.email.toLowerCase() },
    });

    // Create new verification token
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.verificationToken.create({
      data: {
        identifier: user.email.toLowerCase(),
        token,
        expires,
      },
    });

    // Send email
    const emailResult = await sendClientPortalAccessEmail(
      user.email.toLowerCase(),
      token,
      campaign?.name || client.name,
      user.name || undefined
    );

    if (!emailResult.success) {
      return NextResponse.json(
        { error: "Failed to send email", details: emailResult.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, email: user.email });
  } catch (error) {
    console.error("Error resending login link:", error);
    return NextResponse.json(
      { error: "Failed to resend login link" },
      { status: 500 }
    );
  }
}
