import { NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";
import {
  scrapeSingleTweet,
  setSocialDataApiKey,
  setApifyApiKey,
  hasSocialDataApiKey,
  hasApifyApiKey,
} from "@/lib/scraper/x-scraper";

// Rate limit: 1 refresh per post per 5 minutes (admin users bypass this)
const REFRESH_COOLDOWN_MS = 5 * 60 * 1000;

export async function POST(
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

  try {
    // Get post with organization info
    const post = await db.post.findFirst({
      where: {
        id,
        campaign: {
          agencyId: authContext.organizationId,
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

    // Check rate limit (admin users bypass this)
    if (!authContext.isAdmin && post.lastMetricsUpdate) {
      const timeSinceLastUpdate = Date.now() - post.lastMetricsUpdate.getTime();
      if (timeSinceLastUpdate < REFRESH_COOLDOWN_MS) {
        const minutesRemaining = Math.ceil((REFRESH_COOLDOWN_MS - timeSinceLastUpdate) / 60000);
        return NextResponse.json(
          { error: `Rate limited. Try again in ${minutesRemaining} minutes.` },
          { status: 429 }
        );
      }
    }

    // Use full tweet URL if available (needed for Apify to extract author handle)
    // Fall back to tweet ID if URL not available
    const tweetUrlOrId = post.tweetUrl || post.tweetId;
    if (!tweetUrlOrId) {
      return NextResponse.json(
        { error: "No tweet URL or ID available" },
        { status: 400 }
      );
    }

    // Extract tweet ID for logging
    const tweetId = post.tweetId || extractTweetId(post.tweetUrl);

    // Load API keys from organization settings
    // SECURITY: Never log API keys or their prefixes
    const org = post.campaign.agency;

    if (org.socialDataApiKey) {
      setSocialDataApiKey(org.socialDataApiKey);
    }
    if (org.apifyApiKey) {
      setApifyApiKey(org.apifyApiKey);
    }

    // Try scraper first (uses SocialData/Apify APIs), fallback to syndication
    let metrics = await fetchTweetMetricsViaScraper(tweetUrlOrId);

    // Fallback to syndication API if scraper fails
    if (!metrics && tweetId) {
      metrics = await fetchTweetMetricsSyndication(tweetId);
    }

    if (!metrics) {
      return NextResponse.json(
        { error: "Failed to fetch metrics from X" },
        { status: 502 }
      );
    }

    console.log(`[RefreshMetrics] SUCCESS - Updating post with metrics:`, JSON.stringify(metrics));

    // Calculate engagement rate
    const totalEngagements = metrics.likes + metrics.retweets + metrics.replies + metrics.quotes;
    const engagementRate = metrics.impressions > 0
      ? (totalEngagements / metrics.impressions) * 100
      : 0;

    // Update post with new metrics and content (if available)
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
        // Update content if scraped and post doesn't already have content
        ...(metrics.content && { content: metrics.content }),
        // Update postedAt if scraped and post doesn't already have it
        ...(metrics.postedAt && { postedAt: metrics.postedAt }),
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

interface MetricsResult {
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  bookmarks: number;
  content?: string;
  postedAt?: Date;
}

/**
 * Fetch tweet metrics via x-scraper (uses SocialData/Apify APIs)
 * @param tweetUrlOrId - Full tweet URL (preferred) or just the tweet ID
 */
async function fetchTweetMetricsViaScraper(tweetUrlOrId: string): Promise<MetricsResult | null> {
  // Check if any API key is configured
  if (!hasSocialDataApiKey() && !hasApifyApiKey()) {
    console.log(`[RefreshMetrics] No API keys configured, skipping scraper`);
    return null;
  }

  try {
    console.log(`[RefreshMetrics] Fetching tweet via scraper: ${tweetUrlOrId}`);
    const tweet = await scrapeSingleTweet(tweetUrlOrId);

    if (!tweet) {
      console.log(`[RefreshMetrics] Scraper returned null for ${tweetUrlOrId}`);
      return null;
    }

    const metrics: MetricsResult = {
      impressions: tweet.metrics.views,
      likes: tweet.metrics.likes,
      retweets: tweet.metrics.retweets,
      replies: tweet.metrics.replies,
      quotes: tweet.metrics.quotes,
      bookmarks: tweet.metrics.bookmarks,
      content: tweet.content || undefined,
      postedAt: tweet.postedAt || undefined,
    };

    console.log(`[RefreshMetrics] Scraper metrics:`, JSON.stringify(metrics));

    // Only return if we have valid data
    const hasAnyData = metrics.impressions > 0 || metrics.likes > 0 ||
                       metrics.retweets > 0 || metrics.replies > 0;

    if (!hasAnyData) {
      console.log(`[RefreshMetrics] No valid metrics from scraper`);
      return null;
    }

    return metrics;
  } catch (error) {
    console.error(`[RefreshMetrics] Scraper error:`, error);
    return null;
  }
}

/**
 * Fallback: Fetch tweet metrics via syndication API
 */
async function fetchTweetMetricsSyndication(tweetId: string): Promise<MetricsResult | null> {
  try {
    // Try multiple syndication endpoints
    const urls = [
      `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=0`,
      `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en`,
    ];

    for (const url of urls) {
      try {
        const response = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Accept": "application/json",
          },
          cache: "no-store",
        });

        if (!response.ok) {
          console.log(`[RefreshMetrics] Syndication returned ${response.status} for ${tweetId}`);
          continue;
        }

        const data = await response.json();

        if (!data) continue;

        const metrics: MetricsResult = {
          impressions: data.views?.count || data.view_count || 0,
          likes: data.favorite_count || data.like_count || 0,
          retweets: data.retweet_count || 0,
          replies: data.reply_count || 0,
          quotes: data.quote_count || 0,
          bookmarks: data.bookmark_count || 0,
          // Extract content from syndication data
          content: data.text || data.full_text || undefined,
          // Extract posted date from syndication data
          postedAt: data.created_at ? new Date(data.created_at) : undefined,
        };

        const hasAnyData = metrics.impressions > 0 || metrics.likes > 0 ||
                           metrics.retweets > 0 || metrics.replies > 0;

        if (hasAnyData) {
          console.log(`[RefreshMetrics] Syndication metrics for ${tweetId}:`, JSON.stringify(metrics));
          return metrics;
        }
      } catch {
        continue;
      }
    }

    console.log(`[RefreshMetrics] All syndication methods failed for ${tweetId}`);
    return null;
  } catch (error) {
    console.error(`[RefreshMetrics] Syndication error for ${tweetId}:`, error);
    return null;
  }
}
