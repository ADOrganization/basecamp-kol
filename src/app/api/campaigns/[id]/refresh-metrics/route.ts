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

async function fetchTweetMetrics(tweetId: string): Promise<{
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  bookmarks: number;
} | null> {
  try {
    // Use X's syndication API (public, no auth required)
    const response = await fetch(
      `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        next: { revalidate: 0 },
      }
    );

    if (!response.ok) {
      console.error(`Failed to fetch tweet ${tweetId}: ${response.status}`);
      return null;
    }

    const data = await response.json();

    return {
      impressions: data.views?.count || 0,
      likes: data.favorite_count || 0,
      retweets: data.retweet_count || 0,
      replies: data.reply_count || 0,
      quotes: data.quote_count || 0,
      bookmarks: data.bookmark_count || 0,
    };
  } catch (error) {
    console.error(`Error fetching metrics for tweet ${tweetId}:`, error);
    return null;
  }
}
