import { NextRequest, NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { campaignSchema } from "@/lib/validations";
import { fetchTwitterMedia, setApifyApiKey, clearApifyApiKey, setSocialDataApiKey, clearSocialDataApiKey } from "@/lib/scraper/x-scraper";
import { sendClientPortalAccessEmail } from "@/lib/email";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const isAgency = authContext.organizationType === "AGENCY" || authContext.isAdmin;

    const campaigns = await db.campaign.findMany({
      where: {
        ...(isAgency
          ? { agencyId: authContext.organizationId }
          : { clientId: authContext.organizationId }),
        ...(status && { status: status as "DRAFT" | "PENDING_APPROVAL" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED" }),
      },
      include: {
        client: {
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
                ratePerPost: true,
                ratePerThread: true,
                ratePerRetweet: true,
                ratePerSpace: true,
              },
            },
          },
        },
        posts: {
          where: {
            // Only count scraped/posted tweets, not content reviews
            status: { in: ["POSTED", "VERIFIED"] },
          },
          select: {
            id: true,
            status: true,
            kolId: true,
            impressions: true,
            likes: true,
            retweets: true,
            replies: true,
            postedAt: true,
          },
        },
        _count: {
          select: {
            campaignKols: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate allocated budget and posts count for all campaigns
    const campaignsWithAllocated = campaigns.map((campaign) => {
      // Calculate budget: use assignedBudget if set, otherwise calculate from rates × deliverables
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

      return {
        ...campaign,
        // Use allocated budget as spent budget (allocated = committed/used)
        spentBudget: allocatedBudget,
        // Add posts count to _count (posts array is already filtered by status)
        _count: {
          ...campaign._count,
          posts: campaign.posts.length,
        },
      };
    });

    // SECURITY: For clients, sanitize sensitive data - hide ALL KOL identifiers
    // Clients should only see KOL display info, never IDs that could be used for direct API access
    if (!isAgency) {
      const sanitizedCampaigns = campaignsWithAllocated.map((campaign) => ({
        ...campaign,
        // Show total budget to clients (they need to see their campaign budget)
        // spentBudget shows allocated budget (amount committed to KOLs)
        // Strip ALL sensitive per-KOL data including IDs
        campaignKols: campaign.campaignKols.map((ck) => ({
          // NO IDs exposed - prevents clients from accessing /api/kols/[id] directly
          kol: {
            // id: HIDDEN - prevents direct API access to KOL data
            name: ck.kol.name,
            twitterHandle: ck.kol.twitterHandle,
            avatarUrl: ck.kol.avatarUrl,
            // tier: HIDDEN - reveals pricing strategy
            // No individual KOL rates exposed
          },
        })),
      }));

      return NextResponse.json(sanitizedCampaigns);
    }

    return NextResponse.json(campaignsWithAllocated);
  } catch (error) {
    console.error("Error fetching campaigns:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}

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
    const validatedData = campaignSchema.parse(body);

    // Load organization's API keys for media fetching
    const org = await db.organization.findUnique({
      where: { id: authContext.organizationId },
      select: { apifyApiKey: true, socialDataApiKey: true },
    });

    // Set SocialData API key (primary)
    if (org?.socialDataApiKey) {
      setSocialDataApiKey(org.socialDataApiKey);
    } else {
      clearSocialDataApiKey();
    }

    // Set Apify API key (fallback)
    if (org?.apifyApiKey) {
      setApifyApiKey(org.apifyApiKey);
    } else {
      clearApifyApiKey();
    }

    // Fetch project avatar and banner if Twitter handle provided
    let projectAvatarUrl: string | null = null;
    let projectBannerUrl: string | null = null;
    if (validatedData.projectTwitterHandle) {
      const handle = validatedData.projectTwitterHandle.replace('@', '');
      try {
        console.log(`[Campaign Create] Fetching media for @${handle}, Apify key: ${org?.apifyApiKey ? 'configured' : 'not configured'}`);
        const media = await fetchTwitterMedia(handle);
        projectAvatarUrl = media.avatarUrl;
        projectBannerUrl = media.bannerUrl;
        console.log(`[Campaign Create] Media result: avatar=${!!projectAvatarUrl}, banner=${!!projectBannerUrl}`);
      } catch (error) {
        console.log("Failed to fetch project Twitter media:", error);
      }
    }

    // If client users are provided, create a client organization
    let clientId = validatedData.clientId || null;
    const clientUsersCreated: { email: string; name?: string; invited: boolean }[] = [];

    if (validatedData.clientUsers && validatedData.clientUsers.length > 0) {
      // Create a client organization for this campaign
      // Use the project's X avatar as the organization logo
      const clientOrg = await db.organization.create({
        data: {
          name: `${validatedData.name} - Client`,
          slug: `client-${validatedData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
          type: "CLIENT",
          logoUrl: projectAvatarUrl, // Set org logo to X profile picture
        },
      });
      clientId = clientOrg.id;

      // Create users and send invitations
      for (const clientUser of validatedData.clientUsers) {
        try {
          // Check if user already exists
          let user = await db.user.findUnique({
            where: { email: clientUser.email.toLowerCase() },
          });

          if (!user) {
            // Create new user
            user = await db.user.create({
              data: {
                email: clientUser.email.toLowerCase(),
                name: clientUser.name || null,
              },
            });
          }

          // Check if already a member
          const existingMember = await db.organizationMember.findUnique({
            where: {
              organizationId_userId: {
                organizationId: clientOrg.id,
                userId: user.id,
              },
            },
          });

          if (!existingMember) {
            // Add user to organization
            await db.organizationMember.create({
              data: {
                organizationId: clientOrg.id,
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

    const campaign = await db.campaign.create({
      data: {
        agencyId: authContext.organizationId,
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
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating campaign:", error);

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create campaign" },
      { status: 500 }
    );
  }
}
