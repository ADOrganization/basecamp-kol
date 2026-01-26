import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { scrapeSingleTweet, setApifyApiKey, clearApifyApiKey, hasApifyApiKey } from "@/lib/scraper/x-scraper";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id: campaignId } = await params;

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.organizationType !== "AGENCY") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Load organization's Apify API key
    const org = await db.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { apifyApiKey: true },
    });

    // Set Apify API key for scraping
    if (org?.apifyApiKey) {
      setApifyApiKey(org.apifyApiKey);
      console.log(`[Refresh Metrics] Apify key configured`);
    } else {
      clearApifyApiKey();
      console.log(`[Refresh Metrics] No Apify key - using syndication API (may fail)`);
    }

    // Get campaign with posts
    const campaign = await db.campaign.findFirst({
      where: {
        id: campaignId,
        agencyId: session.user.organizationId,
      },
      include: {
        posts: {
          where: {
            status: { in: ["POSTED", "VERIFIED"] },
            tweetUrl: { not: null },
          },
          select: {
            id: true,
            tweetId: true,
            tweetUrl: true,
            impressions: true,
            likes: true,
            retweets: true,
            replies: true,
          },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (campaign.posts.length === 0) {
      return NextResponse.json({ message: "No posts to refresh", refreshed: 0 });
    }

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    // Refresh metrics for each post sequentially to avoid rate limiting
    for (const post of campaign.posts) {
      try {
        const tweetUrl = post.tweetUrl;
        if (!tweetUrl) {
          errors.push(`Post ${post.id}: No tweet URL`);
          failCount++;
          continue;
        }

        // Use the scraper to get fresh metrics
        const tweet = await scrapeSingleTweet(tweetUrl);

        if (!tweet) {
          // Keep existing data if scrape fails
          errors.push(`Post ${post.id}: Could not fetch tweet data`);
          failCount++;
          continue;
        }

        // Only update if we got better data than what we have
        const hasNewData = tweet.metrics.likes > 0 ||
                          tweet.metrics.retweets > 0 ||
                          tweet.metrics.replies > 0 ||
                          tweet.metrics.views > 0;

        const hasBetterData = tweet.metrics.likes >= (post.likes || 0) ||
                             tweet.metrics.retweets >= (post.retweets || 0) ||
                             tweet.metrics.views >= (post.impressions || 0);

        if (hasNewData && hasBetterData) {
          // Calculate engagement rate
          const totalEngagements = tweet.metrics.likes + tweet.metrics.retweets +
                                   tweet.metrics.replies + tweet.metrics.quotes;
          const engagementRate = tweet.metrics.views > 0
            ? (totalEngagements / tweet.metrics.views) * 100
            : 0;

          await db.post.update({
            where: { id: post.id },
            data: {
              impressions: tweet.metrics.views,
              likes: tweet.metrics.likes,
              retweets: tweet.metrics.retweets,
              replies: tweet.metrics.replies,
              quotes: tweet.metrics.quotes,
              bookmarks: tweet.metrics.bookmarks,
              engagementRate: Math.round(engagementRate * 100) / 100,
              lastMetricsUpdate: new Date(),
            },
          });
          successCount++;
        } else {
          errors.push(`Post ${post.id}: No valid new data from API`);
          failCount++;
        }

        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`Error refreshing post ${post.id}:`, error);
        errors.push(`Post ${post.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        failCount++;
      }
    }

    return NextResponse.json({
      message: `Refreshed ${successCount}/${campaign.posts.length} posts`,
      refreshed: successCount,
      failed: failCount,
      total: campaign.posts.length,
      apifyConfigured: hasApifyApiKey(),
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined, // Return first 5 errors
    });
  } catch (error) {
    console.error("Failed to refresh campaign metrics:", error);
    return NextResponse.json(
      { error: "Failed to refresh metrics" },
      { status: 500 }
    );
  }
}
