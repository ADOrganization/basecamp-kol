import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchTwitterProfile, setApifyApiKey, clearApifyApiKey } from "@/lib/scraper/x-scraper";

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

    // Load organization's Apify API key
    const org = await db.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { apifyApiKey: true },
    });

    if (org?.apifyApiKey) {
      setApifyApiKey(org.apifyApiKey);
      console.log(`[Refresh All] Apify API key loaded`);
    } else {
      clearApifyApiKey();
      console.log(`[Refresh All] No Apify API key configured`);
    }

    // Get all KOLs for this organization (exclude only BLACKLISTED)
    const kols = await db.kOL.findMany({
      where: {
        organizationId: session.user.organizationId,
        status: { not: "BLACKLISTED" },
      },
      select: {
        id: true,
        twitterHandle: true,
        followersCount: true,
        status: true,
      },
    });

    console.log(`[Refresh All] Starting refresh for ${kols.length} KOLs`);

    if (kols.length === 0) {
      return NextResponse.json({
        success: true,
        total: 0,
        updated: 0,
        failed: 0,
        results: [],
        message: "No KOLs to refresh"
      });
    }

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
            // Fetch Twitter profile data (may return partial data)
            const profile = await fetchTwitterProfile(kol.twitterHandle);

            // Get aggregate metrics from posts in database
            const postMetrics = await db.post.aggregate({
              where: {
                kolId: kol.id,
                status: { in: ["POSTED", "VERIFIED"] },
              },
              _avg: {
                likes: true,
                retweets: true,
                replies: true,
                impressions: true,
              },
              _sum: {
                likes: true,
                retweets: true,
                replies: true,
                impressions: true,
              },
              _count: true,
            });

            // Calculate metrics
            const avgLikes = Math.round(postMetrics._avg?.likes || 0);
            const avgRetweets = Math.round(postMetrics._avg?.retweets || 0);
            const avgReplies = Math.round(postMetrics._avg?.replies || 0);
            const avgImpressions = postMetrics._avg?.impressions || 0;

            // Use new followers count if available, otherwise keep existing
            const newFollowersCount = (profile?.followersCount && profile.followersCount > 0)
              ? profile.followersCount
              : kol.followersCount;

            const followersForCalc = newFollowersCount || 1;

            // Calculate engagement rate
            let avgEngagementRate = 0;
            if (avgImpressions > 0) {
              avgEngagementRate = ((avgLikes + avgRetweets + avgReplies) / avgImpressions) * 100;
            } else if (followersForCalc > 0 && (avgLikes + avgRetweets + avgReplies) > 0) {
              avgEngagementRate = ((avgLikes + avgRetweets + avgReplies) / followersForCalc) * 100;
            }

            // Prepare update data
            const updateData: Record<string, unknown> = {
              avgLikes,
              avgRetweets,
              avgReplies,
              avgEngagementRate: Math.round(avgEngagementRate * 100) / 100,
              lastMetricsUpdate: new Date(),
            };

            // Only update followers if we got new data
            if (profile?.followersCount && profile.followersCount > 0) {
              updateData.followersCount = profile.followersCount;
            }
            if (profile?.followingCount && profile.followingCount > 0) {
              updateData.followingCount = profile.followingCount;
            }
            if (profile?.avatarUrl) {
              updateData.avatarUrl = profile.avatarUrl;
            }

            // Update KOL with new metrics
            await db.kOL.update({
              where: { id: kol.id },
              data: updateData,
            });

            const updateDetails = [];
            if (profile?.followersCount && profile.followersCount > 0) {
              updateDetails.push(`${profile.followersCount} followers`);
            }
            if (postMetrics._count > 0) {
              updateDetails.push(`${postMetrics._count} posts analyzed`);
            }
            updateDetails.push(`${avgEngagementRate.toFixed(2)}% engagement`);

            console.log(`[Refresh All] Updated @${kol.twitterHandle}: ${updateDetails.join(', ')}`);
            successCount++;
            results.push({
              id: kol.id,
              handle: kol.twitterHandle,
              success: true,
              followersCount: newFollowersCount,
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
