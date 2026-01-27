import { NextRequest, NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { scrapeSingleTweet, setApifyApiKey, clearApifyApiKey, setSocialDataApiKey, clearSocialDataApiKey, hasAnyScraperConfigured } from "@/lib/scraper/x-scraper";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";
import { safeDecrypt } from "@/lib/crypto";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Apply strict rate limiting for heavy operations (external API calls)
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.heavy);
  if (rateLimitResponse) return rateLimitResponse;

  const authContext = await getApiAuthContext();
  const { id: campaignId } = await params;

  console.log("[Refresh Metrics] Auth context:", authContext ? {
    organizationId: authContext.organizationId,
    organizationType: authContext.organizationType,
    isAdmin: authContext.isAdmin,
  } : "null");

  if (!authContext) {
    console.log("[Refresh Metrics] No auth context - returning 401");
    return NextResponse.json({ error: "Unauthorized - please log in again" }, { status: 401 });
  }

  if (authContext.organizationType !== "AGENCY" && !authContext.isAdmin) {
    console.log("[Refresh Metrics] Not agency and not admin - returning 403");
    return NextResponse.json({ error: "Forbidden - agency access required" }, { status: 403 });
  }

  try {
    // Load organization's API keys
    console.log(`[Refresh Metrics] Loading API keys for org: ${authContext.organizationId}`);
    const org = await db.organization.findUnique({
      where: { id: authContext.organizationId },
      select: { id: true, name: true, apifyApiKey: true, socialDataApiKey: true },
    });

    console.log(`[Refresh Metrics] Org found: ${org?.id}, name: ${org?.name}`);
    // SECURITY: Only log presence, not key content
    console.log(`[Refresh Metrics] SocialData key in DB: ${org?.socialDataApiKey ? 'configured' : 'NOT SET'}`);
    console.log(`[Refresh Metrics] Apify key in DB: ${org?.apifyApiKey ? 'configured' : 'NOT SET'}`);

    // SECURITY: Decrypt API keys if encrypted (safeDecrypt handles both encrypted and plain text)
    const socialDataKey = safeDecrypt(org?.socialDataApiKey || null);
    const apifyKey = safeDecrypt(org?.apifyApiKey || null);

    // Debug: Log key lengths to verify decryption worked (not actual keys)
    console.log(`[Refresh Metrics] Raw DB socialDataApiKey length: ${org?.socialDataApiKey?.length || 0}`);
    console.log(`[Refresh Metrics] Raw DB apifyApiKey length: ${org?.apifyApiKey?.length || 0}`);
    console.log(`[Refresh Metrics] After safeDecrypt socialDataKey length: ${socialDataKey?.length || 0}`);
    console.log(`[Refresh Metrics] After safeDecrypt apifyKey length: ${apifyKey?.length || 0}`);

    // Check if the key looks like an encrypted blob (base64, long) vs actual API key (shorter, alphanumeric)
    const socialDataLooksEncrypted = socialDataKey && socialDataKey.length > 100;
    const apifyLooksEncrypted = apifyKey && apifyKey.length > 100;

    if (socialDataLooksEncrypted) {
      console.log(`[Refresh Metrics] WARNING: socialDataKey looks like encrypted blob, decryption may have failed`);
    }
    if (apifyLooksEncrypted) {
      console.log(`[Refresh Metrics] WARNING: apifyKey looks like encrypted blob, decryption may have failed`);
    }

    // Set SocialData API key (primary)
    if (socialDataKey && !socialDataLooksEncrypted) {
      setSocialDataApiKey(socialDataKey);
      console.log(`[Refresh Metrics] SocialData key configured (primary)`);
    } else {
      clearSocialDataApiKey();
      console.log(`[Refresh Metrics] No valid SocialData key - cleared`);
    }

    // Set Apify API key (fallback)
    if (apifyKey && !apifyLooksEncrypted) {
      setApifyApiKey(apifyKey);
      console.log(`[Refresh Metrics] Apify key configured (fallback)`);
    } else {
      clearApifyApiKey();
      console.log(`[Refresh Metrics] No valid Apify key - cleared`);
    }

    if (!org?.socialDataApiKey && !org?.apifyApiKey) {
      console.log(`[Refresh Metrics] WARNING: No API keys configured - using syndication API (may fail)`);
    }

    console.log(`[Refresh Metrics] hasAnyScraperConfigured() = ${hasAnyScraperConfigured()}`);

    // Get campaign with posts
    console.log("[Refresh Metrics] Looking for campaign:", campaignId, "with agencyId:", authContext.organizationId);
    const campaign = await db.campaign.findFirst({
      where: {
        id: campaignId,
        agencyId: authContext.organizationId,
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
      // Debug: check if campaign exists at all
      const campaignExists = await db.campaign.findUnique({
        where: { id: campaignId },
        select: { id: true, agencyId: true },
      });
      console.log("[Refresh Metrics] Campaign not found for org. Campaign exists?", campaignExists);
      return NextResponse.json({ error: "Campaign not found or access denied" }, { status: 404 });
    }

    if (campaign.posts.length === 0) {
      return NextResponse.json({ message: "No posts to refresh", refreshed: 0 });
    }

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];
    const updatedMetrics: { postId: string; views: number; likes: number; retweets: number }[] = [];

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
        console.log(`[Refresh] Scraping post ${post.id}, URL: ${tweetUrl}`);
        const tweet = await scrapeSingleTweet(tweetUrl);
        console.log(`[Refresh] Scraper result for post ${post.id}:`, tweet ? 'SUCCESS' : 'FAILED');

        if (!tweet) {
          // Keep existing data if scrape fails
          console.log(`[Refresh] Post ${post.id}: scrapeSingleTweet returned null`);
          errors.push(`Post ${post.id}: Could not fetch tweet data`);
          failCount++;
          continue;
        }

        // Log what we got for debugging
        console.log(`[Refresh] Post ${post.id} metrics from API:`, JSON.stringify(tweet.metrics));

        // Calculate engagement rate
        const totalEngagements = tweet.metrics.likes + tweet.metrics.retweets +
                                 tweet.metrics.replies + tweet.metrics.quotes;
        const engagementRate = tweet.metrics.views > 0
          ? (totalEngagements / tweet.metrics.views) * 100
          : 0;

        // Update the post with new metrics
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

        // VERIFY: Re-read from database to confirm save worked
        const verifiedPost = await db.post.findUnique({
          where: { id: post.id },
          select: { impressions: true, likes: true, retweets: true },
        });

        // Track what we saved for debugging (using verified data)
        updatedMetrics.push({
          postId: post.id,
          views: verifiedPost?.impressions ?? 0,
          likes: verifiedPost?.likes ?? 0,
          retweets: verifiedPost?.retweets ?? 0,
        });

        console.log(`[Refresh] Post ${post.id} VERIFIED in DB: views=${verifiedPost?.impressions}, likes=${verifiedPost?.likes}`);
        successCount++;

        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`Error refreshing post ${post.id}:`, error);
        errors.push(`Post ${post.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        failCount++;
      }
    }

    // Provide clear feedback about API configuration
    const apiStatus = {
      socialDataConfigured: !!socialDataKey,
      apifyConfigured: !!apifyKey,
      usingFallback: !socialDataKey && !apifyKey,
    };

    return NextResponse.json({
      message: `Refreshed ${successCount}/${campaign.posts.length} posts`,
      refreshed: successCount,
      failed: failCount,
      total: campaign.posts.length,
      scraperConfigured: hasAnyScraperConfigured(),
      apiStatus,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
      // Debug: include actual metrics that were saved
      debug: updatedMetrics.length > 0 ? { savedMetrics: updatedMetrics } : undefined,
    });
  } catch (error) {
    console.error("Failed to refresh campaign metrics:", error);
    return NextResponse.json(
      { error: "Failed to refresh metrics" },
      { status: 500 }
    );
  }
}
