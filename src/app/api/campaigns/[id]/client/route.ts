import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { createInvitationToken } from "@/lib/magic-link";
import { sendInvitationEmail } from "@/lib/email";
import { logSecurityEvent, getRequestMetadata } from "@/lib/security-audit";

const createClientSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  organizationName: z.string().min(2, "Organization name must be at least 2 characters"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.organizationType !== "AGENCY") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: campaignId } = await params;
    const body = await request.json();
    const validatedData = createClientSchema.parse(body);

    // Check if campaign exists and belongs to user's org
    const campaign = await db.campaign.findFirst({
      where: {
        id: campaignId,
        agencyId: session.user.organizationId,
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Check if this specific client is already assigned (allow multiple different clients)
    // Note: We now support multiple clients per campaign via CampaignClient junction table

    // Check if email is already taken
    const existingUser = await db.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 400 }
      );
    }

    // Generate slug from organization name
    const baseSlug = validatedData.organizationName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Check for unique slug
    let slug = baseSlug;
    let counter = 1;
    while (await db.organization.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const { ipAddress, userAgent } = getRequestMetadata(request);

    // Create organization and link to campaign via junction table
    const result = await db.$transaction(async (tx) => {
      // Create client organization
      const organization = await tx.organization.create({
        data: {
          name: validatedData.organizationName,
          slug,
          type: "CLIENT",
        },
      });

      // Also set as primary client if none exists (backwards compatibility)
      if (!campaign.clientId) {
        await tx.campaign.update({
          where: { id: campaignId },
          data: { clientId: organization.id },
        });
      }

      // Add to CampaignClient junction table for multi-client support
      await tx.campaignClient.create({
        data: {
          campaignId,
          clientId: organization.id,
        },
      });

      return { organization };
    });

    // Create invitation token for the client user
    const token = await createInvitationToken(
      validatedData.email,
      result.organization.id,
      session.user.id,
      "OWNER"
    );

    // Send invitation email
    const emailResult = await sendInvitationEmail(
      validatedData.email,
      token,
      session.user.name || session.user.email,
      result.organization.name,
      "OWNER"
    );

    // Log the invitation
    await logSecurityEvent({
      userId: session.user.id,
      action: "INVITE_SENT",
      ipAddress: ipAddress || undefined,
      userAgent: userAgent || undefined,
      metadata: {
        invitedEmail: validatedData.email,
        organizationId: result.organization.id,
        role: "OWNER",
        emailSent: emailResult.success,
        isClientInvite: true,
        campaignId,
      },
    });

    return NextResponse.json({
      message: "Client account created and invitation sent",
      client: {
        organizationId: result.organization.id,
        organizationName: result.organization.name,
        invitedEmail: validatedData.email,
        invitationSent: emailResult.success,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating client account:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create client account" },
      { status: 500 }
    );
  }
}
