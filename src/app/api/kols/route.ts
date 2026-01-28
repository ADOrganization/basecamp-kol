import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { kolSchema } from "@/lib/validations";
import { fetchTwitterAvatar, fetchTwitterProfile } from "@/lib/scraper/x-scraper";
import { applyRateLimit, addSecurityHeaders, RATE_LIMITS } from "@/lib/api-security";
import { getApiAuthContext } from "@/lib/api-auth";
import { logSecurityEvent } from "@/lib/security-audit";
import { refreshKolMetrics } from "@/lib/metrics-refresh";

// SECURITY: Maximum number of KOLs returned per request to prevent bulk scraping
const MAX_KOLS_PER_PAGE = 50;

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Apply strict rate limiting to prevent KOL roster scraping
    // Only 10 requests per 5 minutes to prevent bulk data extraction
    const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.kolRoster);
    if (rateLimitResponse) return rateLimitResponse;

    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // SECURITY: Only agency users can access the full KOL roster
    // Clients can only see KOLs assigned to their campaigns via /api/campaigns/[id]
    if (authContext.organizationType !== "AGENCY" && !authContext.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const tier = searchParams.get("tier");
    const status = searchParams.get("status");

    // SECURITY: Pagination to prevent bulk scraping of KOL roster
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(MAX_KOLS_PER_PAGE, parseInt(searchParams.get("limit") || "50", 10));
    const skip = (page - 1) * limit;

    const whereClause = {
      organizationId: authContext.organizationId,
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { twitterHandle: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(tier && { tier: tier as "SMALL" | "MID" | "LARGE" | "MACRO" | "NANO" | "MICRO" | "RISING" | "MEGA" }),
      ...(status && { status: status as "ACTIVE" | "INACTIVE" | "BLACKLISTED" | "PENDING" }),
    };

    // Get total count for pagination
    const totalCount = await db.kOL.count({ where: whereClause });

    const kols = await db.kOL.findMany({
      where: whereClause,
      skip,
      take: limit,
      include: {
        tags: true,
        campaignKols: {
          select: {
            assignedBudget: true,
            status: true,
          },
        },
        posts: {
          where: {
            status: { in: ["POSTED", "VERIFIED"] },
          },
          orderBy: { postedAt: "desc" },
          take: 1,
          select: {
            postedAt: true,
          },
        },
        paymentReceipts: {
          select: {
            amount: true,
          },
        },
        payments: {
          where: {
            status: "COMPLETED",
          },
          select: {
            amount: true,
          },
        },
        _count: {
          select: {
            campaignKols: true,
            posts: {
              where: {
                status: { in: ["POSTED", "VERIFIED"] },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate total earnings from payments and payment receipts for each KOL
    const kolsWithEarnings = kols.map((kol) => {
      // Total earnings = sum of completed payments + payment receipts (in cents)
      const paymentsTotal = kol.payments.reduce(
        (sum, payment) => sum + (payment.amount || 0),
        0
      );
      const receiptsTotal = kol.paymentReceipts.reduce(
        (sum, receipt) => sum + (receipt.amount || 0),
        0
      );
      // Use the higher of the two to avoid double counting if both are tracked
      const totalEarningsCents = Math.max(paymentsTotal, receiptsTotal);

      const activeCampaigns = kol.campaignKols.filter(
        ck => ck.status === "PENDING" || ck.status === "CONFIRMED"
      ).length;
      const lastPostDate = kol.posts[0]?.postedAt || null;

      // Remove internal data from response
      const { campaignKols: _, posts: __, paymentReceipts: ___, payments: ____, ...kolData } = kol;
      return {
        ...kolData,
        totalEarnings: totalEarningsCents / 100,
        activeCampaigns,
        lastPostDate,
      };
    });

    // SECURITY: Audit log for KOL roster access - tracks who accesses KOL data
    await logSecurityEvent({
      userId: authContext.userId,
      action: "KOL_ROSTER_ACCESS",
      metadata: {
        kolCount: kolsWithEarnings.length,
        totalAvailable: totalCount,
        page,
        organizationId: authContext.organizationId,
        isAdmin: authContext.isAdmin,
        search: search || undefined,
        tier: tier || undefined,
      },
    });

    // Add security headers to prevent caching of sensitive data
    const response = NextResponse.json({
      data: kolsWithEarnings,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Error fetching KOLs:", error);
    return NextResponse.json(
      { error: "Failed to fetch KOLs" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // SECURITY: Apply rate limiting for KOL creation
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
    const validatedData = kolSchema.parse(body);

    // Normalize twitter handle
    const twitterHandle = validatedData.twitterHandle.replace("@", "");

    // Check if KOL already exists
    const existingKol = await db.kOL.findUnique({
      where: {
        organizationId_twitterHandle: {
          organizationId: authContext.organizationId,
          twitterHandle,
        },
      },
    });

    if (existingKol) {
      return NextResponse.json(
        { error: "A KOL with this Twitter handle already exists" },
        { status: 400 }
      );
    }

    // Load organization's API keys for Twitter fetching
    const org = await db.organization.findUnique({
      where: { id: authContext.organizationId },
      select: { apifyApiKey: true, socialDataApiKey: true },
    });

    // Import and set API keys dynamically
    const { setSocialDataApiKey, clearSocialDataApiKey, setApifyApiKey, clearApifyApiKey } = await import("@/lib/scraper/x-scraper");

    if (org?.socialDataApiKey) {
      setSocialDataApiKey(org.socialDataApiKey);
    } else {
      clearSocialDataApiKey();
    }
    if (org?.apifyApiKey) {
      setApifyApiKey(org.apifyApiKey);
    } else {
      clearApifyApiKey();
    }

    // Fetch Twitter profile (avatar, followers, following)
    let avatarUrl: string | null = null;
    let followersCount: number | null = null;
    let followingCount: number | null = null;
    try {
      const profile = await fetchTwitterProfile(twitterHandle);
      if (profile) {
        avatarUrl = profile.avatarUrl;
        followersCount = profile.followersCount > 0 ? profile.followersCount : null;
        followingCount = profile.followingCount > 0 ? profile.followingCount : null;
        console.log(`[KOL Create] Fetched profile for @${twitterHandle}: ${followersCount} followers, ${followingCount} following`);
      }
    } catch (error) {
      console.log("Failed to fetch Twitter profile:", error);
      // Fallback to just avatar
      try {
        avatarUrl = await fetchTwitterAvatar(twitterHandle);
      } catch {
        console.log("Failed to fetch Twitter avatar as fallback");
      }
    }

    const kol = await db.kOL.create({
      data: {
        organizationId: authContext.organizationId,
        name: validatedData.name,
        twitterHandle,
        avatarUrl,
        ...(followersCount !== null && { followersCount }),
        ...(followingCount !== null && { followingCount }),
        // Initialize metrics fields
        avgLikes: 0,
        avgRetweets: 0,
        avgReplies: 0,
        avgEngagementRate: 0,
        lastMetricsUpdate: new Date(),
        telegramUsername: validatedData.telegramUsername || null,
        telegramGroupId: validatedData.telegramGroupId || null,
        email: validatedData.email || null,
        tier: validatedData.tier,
        status: validatedData.status,
        ratePerPost: validatedData.ratePerPost || null,
        ratePerThread: validatedData.ratePerThread || null,
        ratePerRetweet: validatedData.ratePerRetweet || null,
        ratePerSpace: validatedData.ratePerSpace || null,
        walletAddress: validatedData.walletAddress || null,
        paymentNotes: validatedData.paymentNotes || null,
        notes: validatedData.notes || null,
        ...(validatedData.tagIds && validatedData.tagIds.length > 0 && {
          tags: {
            connect: validatedData.tagIds.map((id) => ({ id })),
          },
        }),
      },
      include: {
        tags: true,
      },
    });

    // Auto-refresh KOL metrics in background (fire and forget - don't block response)
    refreshKolMetrics(kol.id, twitterHandle, authContext.organizationId)
      .then(result => {
        if (result.success) {
          console.log(`[KOL Create] Auto-refreshed metrics for new KOL ${kol.id}`);
        } else {
          console.log(`[KOL Create] Auto-refresh failed for KOL ${kol.id}: ${result.error}`);
        }
      })
      .catch(err => console.error(`[KOL Create] Auto-refresh error:`, err));

    return NextResponse.json(kol, { status: 201 });
  } catch (error) {
    console.error("Error creating KOL:", error);

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create KOL" },
      { status: 500 }
    );
  }
}
