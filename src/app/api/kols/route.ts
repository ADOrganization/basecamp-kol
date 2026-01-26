import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { kolSchema } from "@/lib/validations";
import { fetchTwitterAvatar, fetchTwitterProfile } from "@/lib/scraper/x-scraper";
import { applyRateLimit, addSecurityHeaders, RATE_LIMITS } from "@/lib/api-security";
import { getApiAuthContext } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Apply rate limiting to prevent scraping (30 req/min for sensitive data)
    const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.sensitive);
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

    const kols = await db.kOL.findMany({
      where: {
        organizationId: authContext.organizationId,
        ...(search && {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { twitterHandle: { contains: search, mode: "insensitive" } },
          ],
        }),
        ...(tier && { tier: tier as "SMALL" | "MID" | "LARGE" | "MACRO" | "NANO" | "MICRO" | "RISING" | "MEGA" }),
        ...(status && { status: status as "ACTIVE" | "INACTIVE" | "BLACKLISTED" | "PENDING" }),
      },
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

    // Calculate total earnings from payment receipts and active campaigns for each KOL
    const kolsWithEarnings = kols.map((kol) => {
      // Total earnings = sum of all payment receipts (in cents)
      const totalEarningsCents = kol.paymentReceipts.reduce(
        (sum, receipt) => sum + (receipt.amount || 0),
        0
      );
      const activeCampaigns = kol.campaignKols.filter(
        ck => ck.status === "PENDING" || ck.status === "CONFIRMED"
      ).length;
      const lastPostDate = kol.posts[0]?.postedAt || null;

      // Remove internal data from response
      const { campaignKols: _, posts: __, paymentReceipts: ___, ...kolData } = kol;
      return {
        ...kolData,
        totalEarnings: totalEarningsCents / 100,
        activeCampaigns,
        lastPostDate,
      };
    });

    // Add security headers to prevent caching of sensitive data
    const response = NextResponse.json(kolsWithEarnings);
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

    // Fetch Twitter profile (avatar and followers)
    let avatarUrl: string | null = null;
    let followersCount: number | null = null;
    try {
      const profile = await fetchTwitterProfile(twitterHandle);
      if (profile) {
        avatarUrl = profile.avatarUrl;
        followersCount = profile.followersCount > 0 ? profile.followersCount : null;
        console.log(`[KOL Create] Fetched profile for @${twitterHandle}: ${followersCount} followers`);
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
