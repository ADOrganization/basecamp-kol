import { NextRequest, NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { campaignSchema } from "@/lib/validations";
import { fetchTwitterMedia, setApifyApiKey, clearApifyApiKey, setSocialDataApiKey, clearSocialDataApiKey } from "@/lib/scraper/x-scraper";
import { sendClientPortalAccessEmail } from "@/lib/email";
import crypto from "crypto";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";

// Disable caching for this route to ensure fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Apply rate limiting
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.standard);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const isAgency = authContext.organizationType === "AGENCY" || authContext.isAdmin;

    const campaign = await db.campaign.findFirst({
      where: {
        id,
        ...(isAgency
          ? { agencyId: authContext.organizationId }
          : {
              // Client can access via legacy clientId OR new campaignClients junction
              OR: [
                { clientId: authContext.organizationId },
                { campaignClients: { some: { clientId: authContext.organizationId } } },
              ],
            }),
      },
      include: {
        client: {
          select: { id: true, name: true, slug: true },
        },
        campaignClients: {
          include: {
            client: {
              select: { id: true, name: true, slug: true, logoUrl: true },
            },
          },
        },
        agency: {
          select: { id: true, name: true },
        },
        campaignKols: {
          include: {
            kol: {
              select: {
                id: true,
                name: true,
                twitterHandle: true,
                avatarUrl: true,
                tier: true,
                followersCount: true,
                avgEngagementRate: true,
                ratePerPost: true,
                ratePerThread: true,
                ratePerRetweet: true,
                ratePerSpace: true,
              },
            },
          },
        },
        posts: {
          include: {
            kol: {
              select: { id: true, name: true, twitterHandle: true, avatarUrl: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Fetch client users (members of the client organization) for agency view
    let clientUsers: { email: string; name: string | null }[] = [];
    if (isAgency && campaign.clientId) {
      const clientMembers = await db.organizationMember.findMany({
        where: { organizationId: campaign.clientId },
        include: {
          user: {
            select: { email: true, name: true },
          },
        },
      });
      clientUsers = clientMembers.map((m) => ({
        email: m.user.email,
        name: m.user.name,
      }));
    }

    // Calculate total allocated budget (sum of all KOL budgets)
    // If assignedBudget is set, use it; otherwise calculate from rates × deliverables
    const allocatedBudget = campaign.campaignKols.reduce((sum, ck) => {
      if (ck.assignedBudget > 0) {
        return sum + ck.assignedBudget;
      }
      // Calculate from KOL rates × deliverables (rates are stored in cents)
      const postsCost = ck.requiredPosts * (ck.kol.ratePerPost || 0);
      const threadsCost = ck.requiredThreads * (ck.kol.ratePerThread || 0);
      const retweetsCost = ck.requiredRetweets * (ck.kol.ratePerRetweet || 0);
      const spacesCost = ck.requiredSpaces * (ck.kol.ratePerSpace || 0);
      return sum + postsCost + threadsCost + retweetsCost + spacesCost;
    }, 0);

    // SECURITY: For clients, hide ALL sensitive data including KOL identifiers
    // Clients should never receive KOL IDs that could be used to access /api/kols/[id]
    if (!isAgency) {
      const sanitizedCampaignKols = campaign.campaignKols.map((ck) => ({
        id: ck.id,
        status: ck.status,
        requiredPosts: ck.requiredPosts,
        requiredThreads: ck.requiredThreads,
        requiredRetweets: ck.requiredRetweets,
        requiredSpaces: ck.requiredSpaces,
        kol: {
          id: ck.kol.id,
          name: ck.kol.name,
          twitterHandle: ck.kol.twitterHandle,
          avatarUrl: ck.kol.avatarUrl,
          followersCount: ck.kol.followersCount,
          avgEngagementRate: ck.kol.avgEngagementRate,
        },
      }));

      const response = NextResponse.json({
        ...campaign,
        // Use allocated budget as spent budget (allocated = committed/used)
        spentBudget: allocatedBudget,
        campaignKols: sanitizedCampaignKols,
      });

      // Prevent caching to ensure fresh data after metrics refresh
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');

      return response;
    }

    const response = NextResponse.json({
      ...campaign,
      // Use allocated budget as spent budget (allocated = committed/used)
      spentBudget: allocatedBudget,
      // Include client users for the campaign form
      clientUsers,
    });

    // Prevent caching to ensure fresh data after metrics refresh
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;
  } catch (error) {
    console.error("Error fetching campaign:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaign" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await request.json();
    const validatedData = campaignSchema.parse(body);

    // Check if campaign exists and belongs to user's org
    const existingCampaign = await db.campaign.findFirst({
      where: {
        id,
        agencyId: authContext.organizationId,
      },
    });

    if (!existingCampaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Load organization's Apify API key for media fetching
    const org = await db.organization.findUnique({
      where: { id: authContext.organizationId },
      select: { apifyApiKey: true },
    });

    if (org?.apifyApiKey) {
      setApifyApiKey(org.apifyApiKey);
    } else {
      clearApifyApiKey();
    }

    // Fetch project avatar and banner if Twitter handle changed or media is missing
    let projectAvatarUrl = existingCampaign.projectAvatarUrl;
    let projectBannerUrl = existingCampaign.projectBannerUrl;
    const newHandle = validatedData.projectTwitterHandle?.replace('@', '') || null;
    const oldHandle = existingCampaign.projectTwitterHandle?.replace('@', '') || null;

    if (newHandle && (newHandle !== oldHandle || !projectAvatarUrl || !projectBannerUrl)) {
      try {
        console.log(`[Campaign Update] Fetching media for @${newHandle}, Apify key: ${org?.apifyApiKey ? 'configured' : 'not configured'}`);
        const media = await fetchTwitterMedia(newHandle);
        projectAvatarUrl = media.avatarUrl;
        projectBannerUrl = media.bannerUrl;
        console.log(`[Campaign Update] Media result: avatar=${!!projectAvatarUrl}, banner=${!!projectBannerUrl}`);
      } catch (error) {
        console.log("Failed to fetch project Twitter media:", error);
      }
    } else if (!newHandle) {
      projectAvatarUrl = null;
      projectBannerUrl = null;
    }

    // Handle client users if provided
    let clientId = validatedData.clientId || existingCampaign.clientId || null;

    // Always sync client org logo with campaign's X profile picture
    if (clientId && newHandle) {
      const clientOrg = await db.organization.findUnique({
        where: { id: clientId },
        select: { logoUrl: true },
      });

      // Update if org has no logo OR logo differs from campaign avatar
      if (!clientOrg?.logoUrl || clientOrg.logoUrl !== projectAvatarUrl) {
        // Fetch fresh avatar if we don't have one
        let avatarToUse = projectAvatarUrl;
        if (!avatarToUse) {
          try {
            const media = await fetchTwitterMedia(newHandle);
            avatarToUse = media.avatarUrl;
            // Also update the campaign's avatar
            projectAvatarUrl = media.avatarUrl;
            projectBannerUrl = media.bannerUrl || projectBannerUrl;
          } catch (error) {
            console.log("[Campaign Update] Failed to fetch avatar for logo sync:", error);
          }
        }

        if (avatarToUse) {
          await db.organization.update({
            where: { id: clientId },
            data: { logoUrl: avatarToUse },
          });
          console.log("[Campaign Update] Synced client org logo with X profile picture");
        }
      }
    }
    const clientUsersCreated: { email: string; name?: string; invited: boolean }[] = [];

    console.log("[Campaign Update] clientUsers in request:", validatedData.clientUsers);

    if (validatedData.clientUsers && validatedData.clientUsers.length > 0) {
      console.log("[Campaign Update] Processing", validatedData.clientUsers.length, "client users");
      // Create a client organization if one doesn't exist
      if (!clientId) {
        console.log("[Campaign Update] Creating new client organization");
        const clientOrg = await db.organization.create({
          data: {
            name: `${validatedData.name} - Client`,
            slug: `client-${validatedData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
            type: "CLIENT",
            logoUrl: projectAvatarUrl, // Set org logo to X profile picture
          },
        });
        clientId = clientOrg.id;
        console.log("[Campaign Update] Created client org:", clientId);

        // Also add to CampaignClient junction table for multi-client support
        await db.campaignClient.create({
          data: {
            campaignId: id,
            clientId: clientOrg.id,
          },
        });
        console.log("[Campaign Update] Added client to CampaignClient junction table");
      } else {
        console.log("[Campaign Update] Using existing clientId:", clientId);
        // Logo update is already handled above when X handle changes
        // Ensure client is in junction table
        const existingLink = await db.campaignClient.findUnique({
          where: {
            campaignId_clientId: {
              campaignId: id,
              clientId,
            },
          },
        });
        if (!existingLink) {
          await db.campaignClient.create({
            data: {
              campaignId: id,
              clientId,
            },
          });
          console.log("[Campaign Update] Added existing client to CampaignClient junction table");
        }
      }

      // Create users and send invitations
      for (const clientUser of validatedData.clientUsers) {
        console.log("[Campaign Update] Processing client user:", clientUser.email);
        try {
          // Check if user already exists
          let user = await db.user.findUnique({
            where: { email: clientUser.email.toLowerCase() },
          });

          if (!user) {
            // Create new user
            console.log("[Campaign Update] Creating new user for:", clientUser.email);
            user = await db.user.create({
              data: {
                email: clientUser.email.toLowerCase(),
                name: clientUser.name || null,
              },
            });
            console.log("[Campaign Update] Created user:", user.id);
          } else {
            console.log("[Campaign Update] User already exists:", user.id);
          }

          // Check if already a member
          const existingMember = await db.organizationMember.findUnique({
            where: {
              organizationId_userId: {
                organizationId: clientId,
                userId: user.id,
              },
            },
          });

          if (existingMember) {
            // Skip existing members - don't re-invite them
            console.log("[Campaign Update] User already a member, skipping:", clientUser.email);
            continue;
          }

          // Add user to organization
          await db.organizationMember.create({
            data: {
              organizationId: clientId,
              userId: user.id,
              role: "MEMBER",
            },
          });

          // Generate verification token for magic link
          const token = crypto.randomBytes(32).toString("hex");
          const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

          await db.verificationToken.create({
            data: {
              identifier: clientUser.email.toLowerCase(),
              token,
              expires,
            },
          });

          // Send invitation email
          const emailResult = await sendClientPortalAccessEmail(
            clientUser.email.toLowerCase(),
            token,
            validatedData.name,
            clientUser.name
          );

          clientUsersCreated.push({
            email: clientUser.email,
            name: clientUser.name,
            invited: emailResult.success,
          });
        } catch (userError) {
          console.error(`Error creating client user ${clientUser.email}:`, userError);
          clientUsersCreated.push({
            email: clientUser.email,
            name: clientUser.name,
            invited: false,
          });
        }
      }
    }

    const campaign = await db.campaign.update({
      where: { id },
      data: {
        clientId,
        name: validatedData.name,
        description: validatedData.description || null,
        projectTwitterHandle: validatedData.projectTwitterHandle,
        projectAvatarUrl,
        projectBannerUrl,
        clientTelegramChatId: validatedData.clientTelegramChatId,
        keywords: validatedData.keywords || [],
        totalBudget: validatedData.totalBudget || 0,
        status: validatedData.status,
        startDate: validatedData.startDate ? new Date(validatedData.startDate) : null,
        endDate: validatedData.endDate ? new Date(validatedData.endDate) : null,
      },
      include: {
        client: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({
      ...campaign,
      clientUsersCreated: clientUsersCreated.length > 0 ? clientUsersCreated : undefined,
    });
  } catch (error) {
    console.error("Error updating campaign:", error);

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update campaign" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // Check if campaign exists and belongs to user's org
    const existingCampaign = await db.campaign.findFirst({
      where: {
        id,
        agencyId: authContext.organizationId,
      },
    });

    if (!existingCampaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    await db.campaign.delete({ where: { id } });

    return NextResponse.json({ message: "Campaign deleted successfully" });
  } catch (error) {
    console.error("Error deleting campaign:", error);
    return NextResponse.json(
      { error: "Failed to delete campaign" },
      { status: 500 }
    );
  }
}
