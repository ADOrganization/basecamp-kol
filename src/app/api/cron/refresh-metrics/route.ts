import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  fetchTwitterProfile as fetchProfile,
  scrapeSingleTweet,
  setSocialDataApiKey,
  setApifyApiKey,
} from "@/lib/scraper/x-scraper";
import { decryptSensitiveData, isEncrypted } from "@/lib/crypto";

// Secret for protecting cron endpoint
const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: Request) {
  // SECURITY: Always require cron secret in production
  const authHeader = request.headers.get("authorization");
  if (!CRON_SECRET) {
    if (process.env.NODE_ENV === "production") {
      console.error("[Cron] CRON_SECRET not configured in production");
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }
    // Allow in development without secret for testing
    console.warn("[Cron] WARNING: CRON_SECRET not set, allowing unauthenticated access (dev only)");
  } else if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Load API keys from all organizations that have them
    const orgsWithKeys = await db.organization.findMany({
      where: {
        OR: [
          { socialDataApiKey: { not: null } },
          { apifyApiKey: { not: null } },
        ],
      },
      select: {
        id: true,
        socialDataApiKey: true,
        apifyApiKey: true,
      },
    });

    // Use the first org's keys (cron job context)
    if (orgsWithKeys.length > 0) {
      const org = orgsWithKeys[0];

      // SECURITY: Decrypt API keys if encrypted
      let socialDataKey = org.socialDataApiKey;
      let apifyKey = org.apifyApiKey;

      if (socialDataKey && isEncrypted(socialDataKey)) {
        socialDataKey = decryptSensitiveData(socialDataKey);
      }
      if (apifyKey && isEncrypted(apifyKey)) {
        apifyKey = decryptSensitiveData(apifyKey);
      }

      if (socialDataKey) {
        setSocialDataApiKey(socialDataKey);
        console.log(`[Cron] Using SocialData API key from org ${org.id}`);
      }
      if (apifyKey) {
        setApifyApiKey(apifyKey);
        console.log(`[Cron] Using Apify API key from org ${org.id}`);
      }
    }

    // Get all POSTED/VERIFIED posts from last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const posts = await db.post.findMany({
      where: {
        status: {
          in: ["POSTED", "VERIFIED"],
        },
        postedAt: {
          gte: thirtyDaysAgo,
        },
        tweetUrl: {
          not: null,
        },
      },
      select: {
        id: true,
        tweetId: true,
        tweetUrl: true,
      },
    });

    console.log(`Found ${posts.length} posts to refresh metrics for`);

    let successCount = 0;
    let failCount = 0;

    // Process posts in batches to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < posts.length; i += batchSize) {
      const batch = posts.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (post) => {
          try {
            const tweetId = post.tweetId || extractTweetId(post.tweetUrl);
            if (!tweetId) {
              failCount++;
              return;
            }

            const metrics = await fetchTweetMetrics(tweetId);
            if (!metrics) {
              failCount++;
              return;
            }

            // Calculate engagement rate
            const totalEngagements = metrics.likes + metrics.retweets + metrics.replies + metrics.quotes;
            const engagementRate = metrics.impressions > 0
              ? (totalEngagements / metrics.impressions) * 100
              : 0;

            // Update post
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

            // Create snapshot
            await db.postMetricSnapshot.create({
              data: {
                postId: post.id,
                impressions: metrics.impressions,
                likes: metrics.likes,
                retweets: metrics.retweets,
                replies: metrics.replies,
                quotes: metrics.quotes,
                bookmarks: metrics.bookmarks,
                engagementRate: Math.round(engagementRate * 100) / 100,
              },
            });

            successCount++;
          } catch (error) {
            console.error(`Failed to refresh metrics for post ${post.id}:`, error);
            failCount++;
          }
        })
      );

      // Small delay between batches to avoid rate limits
      if (i + batchSize < posts.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Also refresh KOL follower counts
    const kols = await db.kOL.findMany({
      where: {
        status: "ACTIVE",
        NOT: {
          twitterHandle: "",
        },
      },
      select: {
        id: true,
        twitterHandle: true,
        followersCount: true,
      },
    });

    console.log(`Found ${kols.length} KOLs to refresh follower counts for`);

    let kolSuccessCount = 0;
    let kolFailCount = 0;

    for (let i = 0; i < kols.length; i += batchSize) {
      const batch = kols.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (kol) => {
          try {
            const followerData = await fetchTwitterProfile(kol.twitterHandle);
            if (!followerData) {
              kolFailCount++;
              return;
            }

            const previousCount = kol.followersCount;
            const change = followerData.followersCount - previousCount;

            // Update KOL
            await db.kOL.update({
              where: { id: kol.id },
              data: {
                followersCount: followerData.followersCount,
                followingCount: followerData.followingCount,
                lastMetricsUpdate: new Date(),
              },
            });

            // Create snapshot
            await db.kOLFollowerSnapshot.create({
              data: {
                kolId: kol.id,
                followersCount: followerData.followersCount,
                followingCount: followerData.followingCount,
                followersChange: change,
              },
            });

            kolSuccessCount++;
          } catch (error) {
            console.error(`Failed to refresh followers for KOL ${kol.id}:`, error);
            kolFailCount++;
          }
        })
      );

      if (i + batchSize < kols.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return NextResponse.json({
      success: true,
      posts: {
        total: posts.length,
        success: successCount,
        failed: failCount,
      },
      kols: {
        total: kols.length,
        success: kolSuccessCount,
        failed: kolFailCount,
      },
    });
  } catch (error) {
    console.error("Cron job failed:", error);
    return NextResponse.json(
      { error: "Cron job failed" },
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
    // Use the scraper which tries SocialData first, then Apify, then syndication
    const tweet = await scrapeSingleTweet(tweetId);

    if (tweet) {
      return {
        impressions: tweet.metrics.views,
        likes: tweet.metrics.likes,
        retweets: tweet.metrics.retweets,
        replies: tweet.metrics.replies,
        quotes: tweet.metrics.quotes,
        bookmarks: tweet.metrics.bookmarks,
      };
    }

    // Fallback to syndication API if scraper fails
    const response = await fetch(
      `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) return null;

    const data = await response.json();

    return {
      impressions: data.views?.count || 0,
      likes: data.favorite_count || 0,
      retweets: data.retweet_count || 0,
      replies: data.reply_count || 0,
      quotes: data.quote_count || 0,
      bookmarks: data.bookmark_count || 0,
    };
  } catch {
    return null;
  }
}

async function fetchTwitterProfile(handle: string): Promise<{
  followersCount: number;
  followingCount: number;
} | null> {
  try {
    const profile = await fetchProfile(handle);
    if (!profile) return null;
    return {
      followersCount: profile.followersCount,
      followingCount: profile.followingCount,
    };
  } catch {
    return null;
  }
}
