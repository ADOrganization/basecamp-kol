import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Rate limit: 1 refresh per post per hour
const REFRESH_COOLDOWN_MS = 60 * 60 * 1000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get post with organization info
    const post = await db.post.findFirst({
      where: {
        id,
        campaign: {
          agencyId: session.user.organizationId,
        },
      },
      include: {
        campaign: {
          include: {
            agency: true,
          },
        },
      },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (!post.tweetId && !post.tweetUrl) {
      return NextResponse.json(
        { error: "Post has no tweet URL to refresh metrics from" },
        { status: 400 }
      );
    }

    // Check rate limit
    if (post.lastMetricsUpdate) {
      const timeSinceLastUpdate = Date.now() - post.lastMetricsUpdate.getTime();
      if (timeSinceLastUpdate < REFRESH_COOLDOWN_MS) {
        const minutesRemaining = Math.ceil((REFRESH_COOLDOWN_MS - timeSinceLastUpdate) / 60000);
        return NextResponse.json(
          { error: `Rate limited. Try again in ${minutesRemaining} minutes.` },
          { status: 429 }
        );
      }
    }

    // Extract tweet ID from URL if not stored
    const tweetId = post.tweetId || extractTweetId(post.tweetUrl);
    if (!tweetId) {
      return NextResponse.json(
        { error: "Could not extract tweet ID from URL" },
        { status: 400 }
      );
    }

    // Fetch metrics from X syndication API
    const metrics = await fetchTweetMetrics(tweetId);
    if (!metrics) {
      return NextResponse.json(
        { error: "Failed to fetch metrics from X" },
        { status: 502 }
      );
    }

    // Calculate engagement rate
    const totalEngagements = metrics.likes + metrics.retweets + metrics.replies + metrics.quotes;
    const engagementRate = metrics.impressions > 0
      ? (totalEngagements / metrics.impressions) * 100
      : 0;

    // Update post with new metrics
    await db.post.update({
      where: { id },
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

    // Create metric snapshot
    await db.postMetricSnapshot.create({
      data: {
        postId: id,
        impressions: metrics.impressions,
        likes: metrics.likes,
        retweets: metrics.retweets,
        replies: metrics.replies,
        quotes: metrics.quotes,
        bookmarks: metrics.bookmarks,
        engagementRate: Math.round(engagementRate * 100) / 100,
      },
    });

    return NextResponse.json({
      success: true,
      metrics: {
        impressions: metrics.impressions,
        likes: metrics.likes,
        retweets: metrics.retweets,
        replies: metrics.replies,
        quotes: metrics.quotes,
        bookmarks: metrics.bookmarks,
        engagementRate: Math.round(engagementRate * 100) / 100,
      },
    });
  } catch (error) {
    console.error("Failed to refresh post metrics:", error);
    return NextResponse.json(
      { error: "Failed to refresh metrics" },
      { status: 500 }
    );
  }
}

function extractTweetId(url: string | null): string | null {
  if (!url) return null;
  // Match patterns like:
  // https://twitter.com/user/status/1234567890
  // https://x.com/user/status/1234567890
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
