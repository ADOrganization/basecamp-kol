import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import crypto from "crypto";
import { getApiAuthContext } from "@/lib/api-auth";
import { sendClientPortalAccessEmail } from "@/lib/email";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";

const createClientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  organizationName: z.string().min(1, "Organization name is required"),
  campaignId: z.string().min(1, "Campaign assignment is required"),
});

// GET - List all client organizations and their campaigns
export async function GET(request: NextRequest) {
  // SECURITY: Apply rate limiting
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.standard);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (authContext.organizationType !== "AGENCY" && !authContext.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all client organizations via the CampaignClient junction table
    const clients = await db.organization.findMany({
      where: {
        type: "CLIENT",
        campaignClients: {
          some: {
            campaign: {
              agencyId: authContext.organizationId,
            },
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
        campaignClients: {
          where: {
            campaign: {
              agencyId: authContext.organizationId,
            },
          },
          include: {
            campaign: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Transform to maintain backwards-compatible shape (clientCampaigns array)
    const transformedClients = clients.map(({ campaignClients, ...client }) => ({
      ...client,
      clientCampaigns: campaignClients.map(cc => cc.campaign),
    }));

    return NextResponse.json(transformedClients);
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
  // SECURITY: Apply rate limiting
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.standard);
  if (rateLimitResponse) return rateLimitResponse;

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

    // Check if email already exists
    const existingUser = await db.user.findUnique({
      where: { email: validatedData.email.toLowerCase() },
      include: {
        memberships: {
          include: {
            organization: {
              include: {
                clientCampaigns: {
                  where: { agencyId: authContext.organizationId },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    // If user exists, check their CLIENT memberships
    let existingClientOrg = null;
    if (existingUser) {
      const clientMembership = existingUser.memberships.find(
        m => m.organization.type === "CLIENT"
      );

      if (clientMembership) {
        // Check if this client org has campaigns from THIS agency
        const hasAgencyCampaign = clientMembership.organization.clientCampaigns.length > 0;

        if (hasAgencyCampaign) {
          return NextResponse.json(
            { error: "This email is already associated with a client account. You can resend their login link from the Clients tab." },
            { status: 400 }
          );
        }

        // User has a client org but not linked to this agency's campaigns - we'll reuse it
        existingClientOrg = clientMembership.organization;
      }
    }

    // Create the client organization, user, and membership in a transaction
    const result = await db.$transaction(async (tx) => {
      let clientOrg;

      if (existingClientOrg) {
        // Reuse existing client org - just update name if needed
        clientOrg = await tx.organization.update({
          where: { id: existingClientOrg.id },
          data: { name: validatedData.organizationName },
        });
      } else {
        // Create new client organization
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

        clientOrg = await tx.organization.create({
          data: {
            name: validatedData.organizationName,
            slug: finalSlug,
            type: "CLIENT",
          },
        });
      }

      // Create the user or use existing one
      let user;
      if (existingUser) {
        user = existingUser;
        // Update name if provided
        if (validatedData.name && !existingUser.name) {
          await tx.user.update({
            where: { id: existingUser.id },
            data: { name: validatedData.name },
          });
        }
      } else {
        user = await tx.user.create({
          data: {
            email: validatedData.email.toLowerCase(),
            name: validatedData.name,
          },
        });
      }

      // Create the membership only if not already a member
      if (!existingClientOrg) {
        await tx.organizationMember.create({
          data: {
            organizationId: clientOrg.id,
            userId: user.id,
            role: "OWNER",
          },
        });
      }

      // Add client to campaign via junction table (supports multiple clients)
      // First check if already linked
      const existingLink = await tx.campaignClient.findUnique({
        where: {
          campaignId_clientId: {
            campaignId: validatedData.campaignId,
            clientId: clientOrg.id,
          },
        },
      });

      if (!existingLink) {
        await tx.campaignClient.create({
          data: {
            campaignId: validatedData.campaignId,
            clientId: clientOrg.id,
          },
        });
      }

      // Also set as primary client if none exists (backwards compatibility)
      const currentCampaign = await tx.campaign.findUnique({
        where: { id: validatedData.campaignId },
        select: { clientId: true },
      });

      if (!currentCampaign?.clientId) {
        await tx.campaign.update({
          where: { id: validatedData.campaignId },
          data: { clientId: clientOrg.id },
        });
      }

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
