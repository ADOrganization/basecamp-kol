import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { applyRateLimit, addSecurityHeaders, RATE_LIMITS } from "@/lib/api-security";

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
  // SECURITY: Apply rate limiting to prevent scraping (30 req/min for sensitive data)
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.sensitive);
  if (rateLimitResponse) return rateLimitResponse;

  const session = await auth();
  const { id } = await params;

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // SECURITY: Only agency users can access KOL follower analytics
  // This data is confidential and should not be exposed to clients
  if (session.user.organizationType !== "AGENCY") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const period = (searchParams.get("period") || "30d") as PeriodKey;
  const days = PERIOD_DAYS[period] || 30;

  try {
    // Verify KOL belongs to user's organization
    const kol = await db.kOL.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!kol) {
      return NextResponse.json({ error: "KOL not found" }, { status: 404 });
    }

    const now = new Date();
    const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const previousPeriodStart = new Date(periodStart.getTime() - days * 24 * 60 * 60 * 1000);

    // Get snapshots for current period
    const currentSnapshots = await db.kOLFollowerSnapshot.findMany({
      where: {
        kolId: id,
        capturedAt: {
          gte: periodStart,
          lte: now,
        },
      },
      orderBy: {
        capturedAt: "asc",
      },
    });

    // Get snapshots for previous period
    const previousSnapshots = await db.kOLFollowerSnapshot.findMany({
      where: {
        kolId: id,
        capturedAt: {
          gte: previousPeriodStart,
          lt: periodStart,
        },
      },
      orderBy: {
        capturedAt: "asc",
      },
    });

    // Calculate summary
    const latestSnapshot = currentSnapshots[currentSnapshots.length - 1];
    const firstSnapshot = currentSnapshots[0];
    const previousLatest = previousSnapshots[previousSnapshots.length - 1];

    const currentFollowers = latestSnapshot?.followersCount ?? kol.followersCount;
    const startFollowers = firstSnapshot?.followersCount ?? kol.followersCount;
    const netChange = currentFollowers - startFollowers;

    // Calculate total daily changes
    const totalGained = currentSnapshots
      .filter(s => s.followersChange > 0)
      .reduce((sum, s) => sum + s.followersChange, 0);
    const totalLost = currentSnapshots
      .filter(s => s.followersChange < 0)
      .reduce((sum, s) => sum + Math.abs(s.followersChange), 0);

    // Delta vs previous period
    const previousNetChange = previousLatest && previousSnapshots[0]
      ? previousLatest.followersCount - previousSnapshots[0].followersCount
      : null;

    // Group by day for time-series
    const dailyData = groupByDay(currentSnapshots);

    // Add security headers to prevent caching of sensitive data
    const response = NextResponse.json({
      kol: {
        id: kol.id,
        name: kol.name,
        twitterHandle: kol.twitterHandle,
      },
      period,
      summary: {
        currentFollowers,
        followingCount: latestSnapshot?.followingCount ?? kol.followingCount,
        netChange,
        totalGained,
        totalLost,
        previousPeriodChange: previousNetChange,
      },
      timeSeries: dailyData,
      snapshotCount: currentSnapshots.length,
    });
    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Failed to fetch KOL follower analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}

function groupByDay(snapshots: Array<{
  capturedAt: Date;
  followersCount: number;
  followingCount: number;
  followersChange: number;
}>) {
  const grouped: Record<string, {
    date: string;
    followersCount: number;
    followingCount: number;
    followersChange: number;
  }> = {};

  for (const snapshot of snapshots) {
    const dateKey = snapshot.capturedAt.toISOString().split("T")[0];
    // Take the latest snapshot for each day
    grouped[dateKey] = {
      date: dateKey,
      followersCount: snapshot.followersCount,
      followingCount: snapshot.followingCount,
      followersChange: snapshot.followersChange,
    };
  }

  return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
}
