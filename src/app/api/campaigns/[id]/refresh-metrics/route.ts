import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

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

    // Refresh metrics for each post
    const results = await Promise.allSettled(
      campaign.posts.map(async (post) => {
        const tweetId = post.tweetId || extractTweetId(post.tweetUrl);
        if (!tweetId) return null;

        const metrics = await fetchTweetMetrics(tweetId);
        if (!metrics) return null;

        // Calculate engagement rate
        const totalEngagements = metrics.likes + metrics.retweets + metrics.replies + metrics.quotes;
        const engagementRate = metrics.impressions > 0
          ? (totalEngagements / metrics.impressions) * 100
          : 0;

        // Update post with new metrics
        await db.post.update({
          where: { id: post.id },
          data: {
            impressions: metrics.impressions,
            likes: metrics.likes,
            retweets: metrics.retweets,
            replies: metrics.replies,
            quotes: metrics.quotes,
            bookmarks: metrics.bookmarks,
            engagementRate: Math.round(engagementRate * 100) / 100,
            lastMetricsUpdate: new Date(),
          },
        });

        return post.id;
      })
    );

    const successful = results.filter(
      (r) => r.status === "fulfilled" && r.value !== null
    ).length;

    return NextResponse.json({
      message: `Refreshed metrics for ${successful}/${campaign.posts.length} posts`,
      refreshed: successful,
      total: campaign.posts.length,
    });
  } catch (error) {
    console.error("Failed to refresh campaign metrics:", error);
    return NextResponse.json(
      { error: "Failed to refresh metrics" },
      { status: 500 }
    );
  }
}

function extractTweetId(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
  return match ? match[1] : null;
}

interface TweetData {
  favorite_count?: number;
  like_count?: number;
  retweet_count?: number;
  reply_count?: number;
  quote_count?: number;
  bookmark_count?: number;
  view_count?: number;
  views?: { count?: number };
}

async function fetchTweetMetrics(tweetId: string): Promise<{
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  bookmarks: number;
} | null> {
  try {
    // Try multiple approaches to get tweet metrics

    // Approach 1: Syndication API with token
    let data: TweetData | null = await tryFetchSyndication(tweetId, `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=0`);

    // Approach 2: Syndication API with lang parameter
    if (!data || !hasValidMetrics(data)) {
      data = await tryFetchSyndication(tweetId, `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en`);
    }

    if (!data) {
      console.error(`All fetch methods failed for tweet ${tweetId}`);
      return null;
    }

    const metrics = {
      impressions: data.views?.count || data.view_count || 0,
      likes: data.favorite_count || data.like_count || 0,
      retweets: data.retweet_count || 0,
      replies: data.reply_count || 0,
      quotes: data.quote_count || 0,
      bookmarks: data.bookmark_count || 0,
    };

    // Only return metrics if we have at least some engagement data
    // (a real tweet should have at least 1 view or interaction)
    const hasAnyData = metrics.impressions > 0 || metrics.likes > 0 ||
                       metrics.retweets > 0 || metrics.replies > 0;

    if (!hasAnyData) {
      console.log(`No valid metrics found for tweet ${tweetId}, skipping update`);
      return null;
    }

    return metrics;
  } catch (error) {
    console.error(`Error fetching metrics for tweet ${tweetId}:`, error);
    return null;
  }
}

function hasValidMetrics(data: TweetData | null): boolean {
  if (!data) return false;
  return !!(
    data.favorite_count ||
    data.like_count ||
    data.retweet_count ||
    data.views?.count ||
    data.view_count
  );
}

async function tryFetchSyndication(tweetId: string, url: string): Promise<TweetData | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      console.log(`Syndication API returned ${response.status} for tweet ${tweetId}`);
      return null;
    }

    return await response.json() as TweetData;
  } catch (error) {
    console.log(`Syndication fetch failed for ${tweetId}:`, error);
    return null;
  }
}
