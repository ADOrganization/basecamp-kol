import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { campaignSchema } from "@/lib/validations";
import { fetchTwitterMedia, setApifyApiKey, clearApifyApiKey, setSocialDataApiKey, clearSocialDataApiKey } from "@/lib/scraper/x-scraper";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const isAgency = session.user.organizationType === "AGENCY";

    const campaigns = await db.campaign.findMany({
      where: {
        ...(isAgency
          ? { agencyId: session.user.organizationId }
          : { clientId: session.user.organizationId }),
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

    // SECURITY: For clients, sanitize sensitive data - hide tier and budget info
    if (!isAgency) {
      const sanitizedCampaigns = campaignsWithAllocated.map((campaign) => ({
        ...campaign,
        // Hide total budget from clients
        totalBudget: undefined,
        spentBudget: undefined,
        // Strip sensitive per-KOL budget and tier data
        campaignKols: campaign.campaignKols.map((ck) => ({
          id: ck.id,
          kol: {
            id: ck.kol.id,
            name: ck.kol.name,
            twitterHandle: ck.kol.twitterHandle,
            avatarUrl: ck.kol.avatarUrl,
            // tier: HIDDEN - reveals pricing strategy
            // No budget info exposed
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
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.organizationType !== "AGENCY") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = campaignSchema.parse(body);

    // Load organization's API keys for media fetching
    const org = await db.organization.findUnique({
      where: { id: session.user.organizationId },
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

    const campaign = await db.campaign.create({
      data: {
        agencyId: session.user.organizationId,
        clientId: validatedData.clientId || null,
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

    return NextResponse.json(campaign, { status: 201 });
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
