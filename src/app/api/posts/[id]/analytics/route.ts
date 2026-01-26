import { NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";

type PeriodKey = "7d" | "14d" | "30d" | "90d" | "365d";

const PERIOD_DAYS: Record<PeriodKey, number> = {
  "7d": 7,
  "14d": 14,
  "30d": 30,
  "90d": 90,
  "365d": 365,
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authContext = await getApiAuthContext();
  const { id } = await params;

  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (authContext.organizationType !== "AGENCY" && !authContext.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const period = (searchParams.get("period") || "7d") as PeriodKey;
  const days = PERIOD_DAYS[period] || 7;

  try {
    // Verify post belongs to user's organization
    const post = await db.post.findFirst({
      where: {
        id,
        campaign: {
          agencyId: authContext.organizationId,
        },
      },
      include: {
        kol: true,
        campaign: true,
      },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const now = new Date();
    const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const previousPeriodStart = new Date(periodStart.getTime() - days * 24 * 60 * 60 * 1000);

    // Get snapshots for current period
    const currentSnapshots = await db.postMetricSnapshot.findMany({
      where: {
        postId: id,
        capturedAt: {
          gte: periodStart,
          lte: now,
        },
      },
      orderBy: {
        capturedAt: "asc",
      },
    });

    // Get snapshots for previous period (for delta calculation)
    const previousSnapshots = await db.postMetricSnapshot.findMany({
      where: {
        postId: id,
        capturedAt: {
          gte: previousPeriodStart,
          lt: periodStart,
        },
      },
      orderBy: {
        capturedAt: "asc",
      },
    });

    // Calculate summary KPIs for current period
    const latestSnapshot = currentSnapshots[currentSnapshots.length - 1];
    const firstSnapshot = currentSnapshots[0];

    const currentKPIs = latestSnapshot ? {
      impressions: latestSnapshot.impressions,
      likes: latestSnapshot.likes,
      retweets: latestSnapshot.retweets,
      replies: latestSnapshot.replies,
      quotes: latestSnapshot.quotes,
      bookmarks: latestSnapshot.bookmarks,
      engagementRate: latestSnapshot.engagementRate,
    } : {
      impressions: post.impressions,
      likes: post.likes,
      retweets: post.retweets,
      replies: post.replies,
      quotes: post.quotes,
      bookmarks: post.bookmarks,
      engagementRate: post.engagementRate,
    };

    // Calculate deltas
    const previousLatest = previousSnapshots[previousSnapshots.length - 1];
    const deltas = previousLatest ? {
      impressions: calculateDelta(currentKPIs.impressions, previousLatest.impressions),
      likes: calculateDelta(currentKPIs.likes, previousLatest.likes),
      retweets: calculateDelta(currentKPIs.retweets, previousLatest.retweets),
      replies: calculateDelta(currentKPIs.replies, previousLatest.replies),
      engagementRate: calculateDelta(currentKPIs.engagementRate, previousLatest.engagementRate),
    } : null;

    // Group snapshots by day for time-series
    const dailyMetrics = groupByDay(currentSnapshots);

    return NextResponse.json({
      post: {
        id: post.id,
        content: post.content,
        tweetUrl: post.tweetUrl,
        postedAt: post.postedAt,
        kol: {
          name: post.kol.name,
          twitterHandle: post.kol.twitterHandle,
        },
        campaign: {
          name: post.campaign.name,
        },
      },
      period,
      currentKPIs,
      deltas,
      timeSeries: dailyMetrics,
      snapshotCount: currentSnapshots.length,
    });
  } catch (error) {
    console.error("Failed to fetch post analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}

function calculateDelta(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100 * 10) / 10;
}

function groupByDay(snapshots: Array<{
  capturedAt: Date;
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  bookmarks: number;
  engagementRate: number;
}>) {
  const grouped: Record<string, {
    date: string;
    impressions: number;
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
    bookmarks: number;
    engagementRate: number;
  }> = {};

  for (const snapshot of snapshots) {
    const dateKey = snapshot.capturedAt.toISOString().split("T")[0];
    // Take the latest snapshot for each day
    grouped[dateKey] = {
      date: dateKey,
      impressions: snapshot.impressions,
      likes: snapshot.likes,
      retweets: snapshot.retweets,
      replies: snapshot.replies,
      quotes: snapshot.quotes,
      bookmarks: snapshot.bookmarks,
      engagementRate: snapshot.engagementRate,
    };
  }

  return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
}
