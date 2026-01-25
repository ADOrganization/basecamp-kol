import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { campaignSchema } from "@/lib/validations";
import { fetchTwitterMedia, setApifyApiKey, clearApifyApiKey } from "@/lib/scraper/x-scraper";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const isAgency = session.user.organizationType === "AGENCY";

    const campaign = await db.campaign.findFirst({
      where: {
        id,
        ...(isAgency
          ? { agencyId: session.user.organizationId }
          : { clientId: session.user.organizationId }),
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
                tier: true,
                followersCount: true,
                avgEngagementRate: true,
              },
            },
          },
        },
        posts: {
          where: {
            // Only show scraped/posted tweets, not content reviews (DRAFT, PENDING_APPROVAL, etc.)
            status: { in: ["POSTED", "VERIFIED"] },
          },
          include: {
            kol: {
              select: { id: true, name: true, twitterHandle: true },
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
    const allocatedBudget = campaign.campaignKols.reduce(
      (sum, ck) => sum + (ck.assignedBudget || 0),
      0
    );

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
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.organizationType !== "AGENCY") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = campaignSchema.parse(body);

    // Check if campaign exists and belongs to user's org
    const existingCampaign = await db.campaign.findFirst({
      where: {
        id,
        agencyId: session.user.organizationId,
      },
    });

    if (!existingCampaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Load organization's Apify API key for media fetching
    const org = await db.organization.findUnique({
      where: { id: session.user.organizationId },
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

    const campaign = await db.campaign.update({
      where: { id },
      data: {
        clientId: validatedData.clientId || null,
        name: validatedData.name,
        description: validatedData.description || null,
        projectTwitterHandle: validatedData.projectTwitterHandle || null,
        projectAvatarUrl,
        projectBannerUrl,
        keywords: validatedData.keywords || [],
        totalBudget: validatedData.totalBudget || 0,
        status: validatedData.status,
        startDate: validatedData.startDate ? new Date(validatedData.startDate) : null,
        endDate: validatedData.endDate ? new Date(validatedData.endDate) : null,
        kpis: validatedData.kpis ?? undefined,
      },
      include: {
        client: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(campaign);
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
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.organizationType !== "AGENCY") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Check if campaign exists and belongs to user's org
    const existingCampaign = await db.campaign.findFirst({
      where: {
        id,
        agencyId: session.user.organizationId,
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
