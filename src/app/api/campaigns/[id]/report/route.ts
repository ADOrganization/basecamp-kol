import { NextRequest, NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import {
  CampaignReportDocument,
  type CampaignData,
  type PostData,
  type Metrics,
} from "@/lib/pdf/campaign-report";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // SECURITY: Apply rate limiting for report generation (heavy operation)
    const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.heavy);
    if (rateLimitResponse) return rateLimitResponse;

    // 1. Authenticate user
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse request body
    const body = await request.json();
    const { startDate, endDate } = body;

    // 3. Validate dates
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Start date and end date are required" },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate + "T23:59:59.999Z"); // Include full end date

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    if (start > end) {
      return NextResponse.json(
        { error: "Start date must be before end date" },
        { status: 400 }
      );
    }

    // 4. Fetch campaign with authorization check
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
              },
            },
          },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found or access denied" },
        { status: 404 }
      );
    }

    // 5. Fetch posts with date filter
    const posts = await db.post.findMany({
      where: {
        campaignId: id,
        status: { in: ["POSTED", "VERIFIED"] },
        postedAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        kol: {
          select: {
            id: true,
            name: true,
            twitterHandle: true,
            tier: true,
            followersCount: true,
          },
        },
      },
      orderBy: { postedAt: "desc" },
    });

    // 6. Calculate aggregated metrics
    const totalImpressions = posts.reduce((sum, p) => sum + (p.impressions || 0), 0);
    const totalLikes = posts.reduce((sum, p) => sum + (p.likes || 0), 0);
    const totalRetweets = posts.reduce((sum, p) => sum + (p.retweets || 0), 0);
    const totalReplies = posts.reduce((sum, p) => sum + (p.replies || 0), 0);
    const totalQuotes = posts.reduce((sum, p) => sum + (p.quotes || 0), 0);
    const totalBookmarks = posts.reduce((sum, p) => sum + (p.bookmarks || 0), 0);
    const totalEngagement = totalLikes + totalRetweets + totalReplies + totalQuotes + totalBookmarks;
    const engagementRate = totalImpressions > 0
      ? ((totalEngagement / totalImpressions) * 100).toFixed(2)
      : "0.00";

    const metrics: Metrics = {
      totalPosts: posts.length,
      totalImpressions,
      totalLikes,
      totalRetweets,
      totalReplies,
      totalQuotes,
      totalBookmarks,
      totalEngagement,
      engagementRate,
    };

    // 7. Prepare campaign data for PDF
    // SECURITY: Hide sensitive tier and budget data from clients
    const campaignData: CampaignData = {
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      status: campaign.status,
      totalBudget: isAgency ? campaign.totalBudget : 0, // Hide budget from clients
      startDate: campaign.startDate?.toISOString() || null,
      endDate: campaign.endDate?.toISOString() || null,
      kpis: campaign.kpis as CampaignData["kpis"],
      campaignKols: campaign.campaignKols.map((ck) => ({
        id: ck.id,
        assignedBudget: isAgency ? ck.assignedBudget : 0, // Hide per-KOL budget from clients
        kol: {
          id: ck.kol.id,
          name: ck.kol.name,
          twitterHandle: ck.kol.twitterHandle,
          tier: isAgency ? ck.kol.tier : "N/A", // Hide tier from clients (reveals pricing)
          followersCount: ck.kol.followersCount,
        },
      })),
    };

    // Prepare posts data for PDF
    // SECURITY: Hide tier data from clients
    const postsData: PostData[] = posts.map((p) => ({
      id: p.id,
      content: p.content,
      postedAt: p.postedAt?.toISOString() || null,
      impressions: p.impressions,
      likes: p.likes,
      retweets: p.retweets,
      replies: p.replies,
      quotes: p.quotes,
      bookmarks: p.bookmarks,
      kol: p.kol
        ? {
            id: p.kol.id,
            name: p.kol.name,
            twitterHandle: p.kol.twitterHandle,
            tier: isAgency ? p.kol.tier : "N/A", // Hide tier from clients
            followersCount: p.kol.followersCount,
          }
        : null,
    }));

    // 8. Generate PDF
    const pdfBuffer = await renderToBuffer(
      CampaignReportDocument({
        campaign: campaignData,
        posts: postsData,
        metrics,
        dateRange: { startDate, endDate },
        generatedAt: new Date().toISOString(),
        hideClientBudgetData: !isAgency, // Hide budget data for client users
      })
    );

    // Convert Buffer to Uint8Array for NextResponse
    const pdfUint8Array = new Uint8Array(pdfBuffer);

    // 9. Generate filename
    const sanitizedName = campaign.name
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .substring(0, 50);
    const filename = `${sanitizedName}-report-${startDate}-to-${endDate}.pdf`;

    // 10. Return PDF response
    return new NextResponse(pdfUint8Array, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfUint8Array.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error generating campaign report:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}
