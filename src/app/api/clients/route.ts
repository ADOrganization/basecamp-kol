import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import crypto from "crypto";
import { getApiAuthContext } from "@/lib/api-auth";
import { sendClientPortalAccessEmail } from "@/lib/email";

const createClientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  organizationName: z.string().min(1, "Organization name is required"),
  campaignId: z.string().min(1, "Campaign assignment is required"),
});

// GET - List all client organizations and their campaigns
export async function GET() {
  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (authContext.organizationType !== "AGENCY" && !authContext.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all client organizations that are associated with this agency's campaigns
    const clients = await db.organization.findMany({
      where: {
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
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                emailVerified: true,
                lastLoginAt: true,
              },
            },
          },
        },
        clientCampaigns: {
          where: {
            agencyId: authContext.organizationId,
          },
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(clients);
  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json(
      { error: "Failed to fetch clients" },
      { status: 500 }
    );
  }
}

// POST - Create a new client account
export async function POST(request: NextRequest) {
  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (authContext.organizationType !== "AGENCY" && !authContext.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createClientSchema.parse(body);

    // Check if email already exists
    const existingUser = await db.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already in use" },
        { status: 400 }
      );
    }

    // Verify the campaign belongs to this agency
    const campaign = await db.campaign.findFirst({
      where: {
        id: validatedData.campaignId,
        agencyId: authContext.organizationId,
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Create the client organization, user, and membership in a transaction
    const result = await db.$transaction(async (tx) => {
      // Create slug from organization name
      const slug = validatedData.organizationName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      // Check if slug exists and make it unique
      let finalSlug = slug;
      let counter = 1;
      while (await tx.organization.findUnique({ where: { slug: finalSlug } })) {
        finalSlug = `${slug}-${counter}`;
        counter++;
      }

      // Create the client organization
      const clientOrg = await tx.organization.create({
        data: {
          name: validatedData.organizationName,
          slug: finalSlug,
          type: "CLIENT",
        },
      });

      // Create the user (no password - magic link only)
      const user = await tx.user.create({
        data: {
          email: validatedData.email,
          name: validatedData.name,
        },
      });

      // Create the membership
      await tx.organizationMember.create({
        data: {
          organizationId: clientOrg.id,
          userId: user.id,
          role: "OWNER",
        },
      });

      // Assign the campaign to the client organization
      await tx.campaign.update({
        where: { id: validatedData.campaignId },
        data: { clientId: clientOrg.id },
      });

      // Create verification token for magic link
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await tx.verificationToken.create({
        data: {
          identifier: validatedData.email.toLowerCase(),
          token,
          expires,
        },
      });

      return {
        organization: clientOrg,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        campaign: {
          id: campaign.id,
          name: campaign.name,
        },
        token,
      };
    });

    // Send invitation email with magic link
    const emailResult = await sendClientPortalAccessEmail(
      validatedData.email.toLowerCase(),
      result.token,
      campaign.name,
      validatedData.name
    );

    return NextResponse.json({
      organization: result.organization,
      user: result.user,
      campaign: result.campaign,
      emailSent: emailResult.success,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating client:", error);
    return NextResponse.json(
      { error: "Failed to create client" },
      { status: 500 }
    );
  }
}
