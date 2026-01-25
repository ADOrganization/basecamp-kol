import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchTwitterProfile } from "@/lib/scraper/x-scraper";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST - Refresh KOL metrics from Twitter and aggregate from posts
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // SECURITY: Apply strict rate limiting for heavy operations (5 req/min)
    const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.heavy);
    if (rateLimitResponse) return rateLimitResponse;

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.organizationType !== "AGENCY") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Get the KOL
    const kol = await db.kOL.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!kol) {
      return NextResponse.json({ error: "KOL not found" }, { status: 404 });
    }

    // Fetch Twitter profile data
    const profile = await fetchTwitterProfile(kol.twitterHandle);

    // Get aggregate metrics from posts in the database
    const postMetrics = await db.post.aggregate({
      where: {
        kolId: id,
        status: "POSTED",
      },
      _avg: {
        likes: true,
        retweets: true,
        replies: true,
        impressions: true,
      },
      _count: true,
    });

    // Calculate engagement rate: (likes + retweets + replies) / impressions * 100
    // If no impressions data, use followers as denominator
    const avgLikes = Math.round(postMetrics._avg?.likes || 0);
    const avgRetweets = Math.round(postMetrics._avg?.retweets || 0);
    const avgReplies = Math.round(postMetrics._avg?.replies || 0);
    const avgImpressions = postMetrics._avg?.impressions || 0;
    const followersCount = profile?.followersCount || kol.followersCount || 1;

    let avgEngagementRate = 0;
    if (avgImpressions > 0) {
      avgEngagementRate = ((avgLikes + avgRetweets + avgReplies) / avgImpressions) * 100;
    } else if (followersCount > 0) {
      avgEngagementRate = ((avgLikes + avgRetweets + avgReplies) / followersCount) * 100;
    }

    // Update KOL with new metrics
    const updatedKol = await db.kOL.update({
      where: { id },
      data: {
        followersCount: profile?.followersCount ?? kol.followersCount,
        followingCount: profile?.followingCount ?? kol.followingCount,
        avatarUrl: profile?.avatarUrl ?? kol.avatarUrl,
        avgLikes,
        avgRetweets,
        avgReplies,
        avgEngagementRate: Math.round(avgEngagementRate * 100) / 100, // Round to 2 decimals
        lastMetricsUpdate: new Date(),
      },
      include: {
        tags: true,
      },
    });

    return NextResponse.json({
      success: true,
      kol: updatedKol,
      postCount: postMetrics._count,
      profileFetched: !!profile,
    });
  } catch (error) {
    console.error("Error refreshing KOL metrics:", error);
    return NextResponse.json(
      { error: "Failed to refresh metrics" },
      { status: 500 }
    );
  }
}
