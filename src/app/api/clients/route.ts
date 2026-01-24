import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import bcrypt from "bcryptjs";

const createClientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  organizationName: z.string().min(1, "Organization name is required"),
  campaignId: z.string().min(1, "Campaign assignment is required"),
});

// GET - List all client organizations and their campaigns
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.organizationType !== "AGENCY") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all client organizations that are associated with this agency's campaigns
    const clients = await db.organization.findMany({
      where: {
        type: "CLIENT",
        clientCampaigns: {
          some: {
            agencyId: session.user.organizationId,
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
              },
            },
          },
        },
        clientCampaigns: {
          where: {
            agencyId: session.user.organizationId,
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
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.organizationType !== "AGENCY") {
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
        agencyId: session.user.organizationId,
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

      // Hash password
      const passwordHash = await bcrypt.hash(validatedData.password, 12);

      // Create the user
      const user = await tx.user.create({
        data: {
          email: validatedData.email,
          name: validatedData.name,
          passwordHash,
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
      };
    });

    return NextResponse.json(result, { status: 201 });
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
