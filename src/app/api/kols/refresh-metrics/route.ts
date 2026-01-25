import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchTwitterProfile } from "@/lib/scraper/x-scraper";

// POST - Refresh metrics for all KOLs in the organization
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.organizationType !== "AGENCY") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all KOLs for this organization
    const kols = await db.kOL.findMany({
      where: {
        organizationId: session.user.organizationId,
        status: { in: ["ACTIVE", "PENDING"] },
      },
      select: {
        id: true,
        twitterHandle: true,
        followersCount: true,
      },
    });

    console.log(`[Refresh All] Starting refresh for ${kols.length} KOLs`);

    let successCount = 0;
    let failCount = 0;
    const results: { id: string; handle: string; success: boolean; followersCount?: number }[] = [];

    // Process KOLs in batches to avoid rate limiting
    const batchSize = 5;
    for (let i = 0; i < kols.length; i += batchSize) {
      const batch = kols.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (kol) => {
          try {
            // Fetch Twitter profile data
            const profile = await fetchTwitterProfile(kol.twitterHandle);

            if (!profile) {
              console.log(`[Refresh All] Failed to fetch profile for @${kol.twitterHandle}`);
              failCount++;
              results.push({ id: kol.id, handle: kol.twitterHandle, success: false });
              return;
            }

            // Get aggregate metrics from posts
            const postMetrics = await db.post.aggregate({
              where: {
                kolId: kol.id,
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

            // Calculate engagement rate
            const avgLikes = Math.round(postMetrics._avg?.likes || 0);
            const avgRetweets = Math.round(postMetrics._avg?.retweets || 0);
            const avgReplies = Math.round(postMetrics._avg?.replies || 0);
            const avgImpressions = postMetrics._avg?.impressions || 0;
            const followersCount = profile.followersCount || kol.followersCount || 1;

            let avgEngagementRate = 0;
            if (avgImpressions > 0) {
              avgEngagementRate = ((avgLikes + avgRetweets + avgReplies) / avgImpressions) * 100;
            } else if (followersCount > 0) {
              avgEngagementRate = ((avgLikes + avgRetweets + avgReplies) / followersCount) * 100;
            }

            // Update KOL with new metrics
            await db.kOL.update({
              where: { id: kol.id },
              data: {
                followersCount: profile.followersCount,
                followingCount: profile.followingCount,
                avatarUrl: profile.avatarUrl ?? undefined,
                avgLikes,
                avgRetweets,
                avgReplies,
                avgEngagementRate: Math.round(avgEngagementRate * 100) / 100,
                lastMetricsUpdate: new Date(),
              },
            });

            console.log(`[Refresh All] Updated @${kol.twitterHandle}: ${profile.followersCount} followers`);
            successCount++;
            results.push({
              id: kol.id,
              handle: kol.twitterHandle,
              success: true,
              followersCount: profile.followersCount,
            });
          } catch (error) {
            console.error(`[Refresh All] Error updating @${kol.twitterHandle}:`, error);
            failCount++;
            results.push({ id: kol.id, handle: kol.twitterHandle, success: false });
          }
        })
      );

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < kols.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return NextResponse.json({
      success: true,
      total: kols.length,
      updated: successCount,
      failed: failCount,
      results,
    });
  } catch (error) {
    console.error("[Refresh All] Error:", error);
    return NextResponse.json(
      { error: "Failed to refresh metrics" },
      { status: 500 }
    );
  }
}
