/**
 * Utility functions for refreshing metrics internally
 * Used when creating KOLs or posts to automatically fetch their metrics
 */

import { db } from "@/lib/db";
import {
  scrapeSingleTweet,
  fetchTwitterProfile,
  setSocialDataApiKey,
  setApifyApiKey,
  clearSocialDataApiKey,
  clearApifyApiKey,
} from "@/lib/scraper/x-scraper";

/**
 * Refresh metrics for a single post
 * Called internally after post creation - no auth checks needed
 */
export async function refreshPostMetrics(
  postId: string,
  tweetUrl: string,
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Load organization's API keys
    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: { socialDataApiKey: true, apifyApiKey: true },
    });

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

    console.log(`[AutoRefresh] Refreshing metrics for post ${postId}, URL: ${tweetUrl}`);

    // Fetch tweet data
    const tweet = await scrapeSingleTweet(tweetUrl);

    if (!tweet) {
      console.log(`[AutoRefresh] Could not fetch tweet data for ${tweetUrl}`);
      return { success: false, error: "Could not fetch tweet data" };
    }

    // Calculate engagement rate
    const totalEngagements = tweet.metrics.likes + tweet.metrics.retweets +
      tweet.metrics.replies + tweet.metrics.quotes;
    const engagementRate = tweet.metrics.views > 0
      ? (totalEngagements / tweet.metrics.views) * 100
      : 0;

    // Extract tweet ID from URL
    const tweetIdMatch = tweetUrl.match(/status\/(\d+)/);
    const tweetId = tweetIdMatch ? tweetIdMatch[1] : null;

    // Update post with metrics
    await db.post.update({
      where: { id: postId },
      data: {
        tweetId: tweetId,
        content: tweet.content || undefined,
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

    console.log(`[AutoRefresh] Successfully updated post ${postId} with metrics:`, {
      views: tweet.metrics.views,
      likes: tweet.metrics.likes,
      retweets: tweet.metrics.retweets,
    });

    return { success: true };
  } catch (error) {
    console.error(`[AutoRefresh] Error refreshing post metrics:`, error);
    return { success: false, error: String(error) };
  }
}

/**
 * Refresh metrics for a KOL (profile + aggregate post metrics)
 * Called internally after KOL creation
 */
export async function refreshKolMetrics(
  kolId: string,
  twitterHandle: string,
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Load organization's API keys
    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: { socialDataApiKey: true, apifyApiKey: true },
    });

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

    console.log(`[AutoRefresh] Refreshing metrics for KOL ${kolId}, handle: @${twitterHandle}`);

    // Fetch Twitter profile
    const profile = await fetchTwitterProfile(twitterHandle);

    // Get aggregate metrics from any existing posts
    const postMetrics = await db.post.aggregate({
      where: {
        kolId,
        status: { in: ["POSTED", "VERIFIED"] },
      },
      _avg: {
        likes: true,
        retweets: true,
        replies: true,
        impressions: true,
      },
      _count: true,
    });

    // Calculate engagement metrics
    const avgLikes = Math.round(postMetrics._avg?.likes || 0);
    const avgRetweets = Math.round(postMetrics._avg?.retweets || 0);
    const avgReplies = Math.round(postMetrics._avg?.replies || 0);
    const avgImpressions = postMetrics._avg?.impressions || 0;
    const followersCount = profile?.followersCount || 1;

    let avgEngagementRate = 0;
    if (avgImpressions > 0) {
      avgEngagementRate = ((avgLikes + avgRetweets + avgReplies) / avgImpressions) * 100;
    } else if (followersCount > 0) {
      avgEngagementRate = ((avgLikes + avgRetweets + avgReplies) / followersCount) * 100;
    }

    // Update KOL with metrics
    await db.kOL.update({
      where: { id: kolId },
      data: {
        followersCount: profile?.followersCount || undefined,
        followingCount: profile?.followingCount || undefined,
        avatarUrl: profile?.avatarUrl || undefined,
        avgLikes,
        avgRetweets,
        avgReplies,
        avgEngagementRate: Math.round(avgEngagementRate * 100) / 100,
        lastMetricsUpdate: new Date(),
      },
    });

    console.log(`[AutoRefresh] Successfully updated KOL ${kolId} with metrics:`, {
      followers: profile?.followersCount,
      avgLikes,
      avgRetweets,
      postsAnalyzed: postMetrics._count,
    });

    return { success: true };
  } catch (error) {
    console.error(`[AutoRefresh] Error refreshing KOL metrics:`, error);
    return { success: false, error: String(error) };
  }
}
