import { NextRequest, NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { campaignSchema } from "@/lib/validations";
import { fetchTwitterMedia, setApifyApiKey, clearApifyApiKey, setSocialDataApiKey, clearSocialDataApiKey } from "@/lib/scraper/x-scraper";
import { sendClientPortalAccessEmail } from "@/lib/email";
import crypto from "crypto";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
          : { clientId: authContext.organizationId }),
      },
      include: {
        client: {
          select: { id: true, name: true, slug: true },
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

    // For clients, hide sensitive data like per-KOL budget allocations
    if (!isAgency) {
      // Strip sensitive data from KOL assignments
      const sanitizedCampaignKols = campaign.campaignKols.map((ck) => ({
        id: ck.id,
        status: ck.status,
        // Hide individual budget allocation
        // assignedBudget: HIDDEN
        requiredPosts: ck.requiredPosts,
        requiredThreads: ck.requiredThreads,
        requiredRetweets: ck.requiredRetweets,
        requiredSpaces: ck.requiredSpaces,
        kol: {
          id: ck.kol.id,
          name: ck.kol.name,
          twitterHandle: ck.kol.twitterHandle,
          avatarUrl: ck.kol.avatarUrl,
          // Hide tier - reveals pricing strategy
          // tier: HIDDEN
          followersCount: ck.kol.followersCount,
          avgEngagementRate: ck.kol.avgEngagementRate,
        },
      }));

      return NextResponse.json({
        ...campaign,
        // Use allocated budget as spent budget (allocated = committed/used)
        spentBudget: allocatedBudget,
        campaignKols: sanitizedCampaignKols,
      });
    }

    return NextResponse.json({
      ...campaign,
      // Use allocated budget as spent budget (allocated = committed/used)
      spentBudget: allocatedBudget,
    });
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
          },
        });
        clientId = clientOrg.id;
        console.log("[Campaign Update] Created client org:", clientId);
      } else {
        console.log("[Campaign Update] Using existing clientId:", clientId);
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

          if (!existingMember) {
            // Add user to organization
            await db.organizationMember.create({
              data: {
                organizationId: clientId,
                userId: user.id,
                role: "MEMBER",
              },
            });
          }

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
