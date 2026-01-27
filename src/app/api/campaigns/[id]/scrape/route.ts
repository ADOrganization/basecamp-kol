import { NextRequest, NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { scrapeMultipleKOLs, scrapeSingleTweet, setApifyApiKey, clearApifyApiKey, setSocialDataApiKey, clearSocialDataApiKey, hasSocialDataApiKey, hasApifyApiKey, type ScrapedTweet } from "@/lib/scraper/x-scraper";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";
import { safeDecrypt } from "@/lib/crypto";

// Helper function to find keyword matches in content
function findKeywordMatches(content: string, keywords: string[]): string[] {
  if (!content || !keywords || keywords.length === 0) return [];
  const lowerContent = content.toLowerCase();
  return keywords.filter(kw => lowerContent.includes(kw.toLowerCase()));
}

// Map post type from scraper to database
function getPostType(tweet: ScrapedTweet): "POST" | "THREAD" | "RETWEET" | "QUOTE" | "SPACE" {
  if (tweet.isRetweet) return "RETWEET";
  if (tweet.isQuote) return "QUOTE";
  return "POST";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Apply strict rate limiting for scraping (heavy external API calls)
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.heavy);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (authContext.organizationType !== "AGENCY" && !authContext.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: campaignId } = await params;
    const body = await request.json();
    const { mode = "all", kolIds, tweetUrls, autoImport = false, filterKeywords } = body;

    // Load organization's API keys
    const org = await db.organization.findUnique({
      where: { id: authContext.organizationId },
      select: { apifyApiKey: true, socialDataApiKey: true },
    });

    // SECURITY: Decrypt API keys if encrypted (safeDecrypt handles both)
    const apifyKeyToUse = safeDecrypt(org?.apifyApiKey || null);
    const socialDataKeyToUse = safeDecrypt(org?.socialDataApiKey || null);

    // SECURITY: Only log presence, not key content
    console.log(`[Scrape API] SocialData key: ${socialDataKeyToUse ? 'configured' : 'none'}`);
    console.log(`[Scrape API] Apify key: ${apifyKeyToUse ? 'configured' : 'none'}`);

    // Set SocialData API key (primary)
    if (socialDataKeyToUse) {
      setSocialDataApiKey(socialDataKeyToUse);
    } else {
      clearSocialDataApiKey();
    }

    // Set Apify API key (fallback)
    if (apifyKeyToUse) {
      setApifyApiKey(apifyKeyToUse);
    } else {
      clearApifyApiKey();
    }

    // Get campaign with KOLs
    const campaign = await db.campaign.findFirst({
      where: {
        id: campaignId,
        agencyId: authContext.organizationId,
      },
      include: {
        campaignKols: {
          include: {
            kol: {
              select: {
                id: true,
                name: true,
                twitterHandle: true,
              },
            },
          },
        },
        posts: {
          select: {
            tweetUrl: true,
          },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Get existing tweet URLs to avoid duplicates
    const existingTweetUrls = new Set(
      campaign.posts
        .map(p => p.tweetUrl)
        .filter((url): url is string => url !== null)
        .map(url => {
          const match = url.match(/status\/(\d+)/);
          return match ? match[1] : url;
        })
    );

    const scrapedTweets: ScrapedTweet[] = [];
    const scrapeResults: { kol: string; success: boolean; count: number; error?: string }[] = [];

    if (mode === "single" && tweetUrls && tweetUrls.length > 0) {
      // Scrape specific tweet URLs
      for (const url of tweetUrls) {
        const tweet = await scrapeSingleTweet(url);
        if (tweet) {
          scrapedTweets.push(tweet);
        }
      }

      scrapeResults.push({
        kol: "Manual Import",
        success: scrapedTweets.length > 0,
        count: scrapedTweets.length,
      });
    } else {
      // Scrape KOLs
      let kolsToScrape = campaign.campaignKols;

      if (kolIds && kolIds.length > 0) {
        kolsToScrape = campaign.campaignKols.filter(ck => kolIds.includes(ck.kol.id));
      }

      const handles = kolsToScrape.map(ck => ck.kol.twitterHandle);
      console.log(`[Scrape API] KOLs to scrape:`, kolsToScrape.map(ck => ({ name: ck.kol.name, handle: ck.kol.twitterHandle })));

      if (handles.length === 0) {
        return NextResponse.json({ error: "No KOLs to scrape" }, { status: 400 });
      }

      // Scrape all KOLs - use filterKeywords if provided, otherwise use campaign keywords
      const keywordsToUse = filterKeywords && filterKeywords.length > 0 ? filterKeywords : campaign.keywords;
      console.log(`[Scrape API] Scraping handles: ${handles.join(', ')}`);
      const results = await scrapeMultipleKOLs(handles, keywordsToUse, 100);

      // Process results
      for (const ck of kolsToScrape) {
        const handle = ck.kol.twitterHandle.toLowerCase();
        const result = results.get(handle);

        if (result) {
          scrapeResults.push({
            kol: `${ck.kol.name} (@${ck.kol.twitterHandle})`,
            success: result.success,
            count: result.tweets.length,
            error: result.error,
          });

          if (result.success) {
            // Add KOL ID to tweets and mark if already imported
            const tweetsWithMeta = result.tweets.map(t => ({
              ...t,
              kolId: ck.kol.id,
              kolName: ck.kol.name,
              kolHandle: ck.kol.twitterHandle,
              alreadyImported: existingTweetUrls.has(t.id),
            }));

            scrapedTweets.push(...tweetsWithMeta);
          }
        }
      }
    }

    // Calculate keyword matches for each tweet
    const tweetsWithKeywords = scrapedTweets.map(tweet => {
      const matchedKeywords = findKeywordMatches(tweet.content, campaign.keywords);
      return {
        ...tweet,
        matchedKeywords,
        hasKeywordMatch: matchedKeywords.length > 0,
      };
    });

    // Auto-import if requested
    let importedCount = 0;
    if (autoImport && tweetsWithKeywords.length > 0) {
      const postsToCreate = tweetsWithKeywords.map(tweet => {
        // Find the KOL ID
        const ckMatch = campaign.campaignKols.find(
          ck => ck.kol.twitterHandle.toLowerCase() === tweet.authorHandle.toLowerCase()
        );

        if (!ckMatch) return null;

        return {
          campaignId,
          kolId: ckMatch.kol.id,
          type: getPostType(tweet),
          content: tweet.content,
          tweetUrl: tweet.url,
          status: "POSTED" as const,
          postedAt: tweet.postedAt,
          matchedKeywords: tweet.matchedKeywords,
          hasKeywordMatch: tweet.hasKeywordMatch,
          impressions: tweet.metrics.views || 0,
          likes: tweet.metrics.likes,
          retweets: tweet.metrics.retweets,
          replies: tweet.metrics.replies,
          quotes: tweet.metrics.quotes,
        };
      }).filter((p): p is NonNullable<typeof p> => p !== null);

      if (postsToCreate.length > 0) {
        await db.post.createMany({
          data: postsToCreate,
          skipDuplicates: true,
        });
        importedCount = postsToCreate.length;
      }
    }

    return NextResponse.json({
      success: true,
      results: scrapeResults,
      tweets: tweetsWithKeywords,
      totalScraped: scrapedTweets.length,
      newTweets: scrapedTweets.length,
      imported: importedCount,
      keywords: campaign.keywords,
      debug: {
        socialDataConfigured: !!socialDataKeyToUse,
        apifyConfigured: !!apifyKeyToUse,
      },
    });
  } catch (error) {
    console.error("Error scraping tweets:", error);
    return NextResponse.json(
      { error: "Failed to scrape tweets" },
      { status: 500 }
    );
  }
}

// GET endpoint to check scraper status and get recent scrapes
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Apply rate limiting
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.standard);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: campaignId } = await params;
    const isAgency = authContext.organizationType === "AGENCY" || authContext.isAdmin;

    const campaign = await db.campaign.findFirst({
      where: {
        id: campaignId,
        ...(isAgency
          ? { agencyId: authContext.organizationId }
          : { clientId: authContext.organizationId }),
      },
      select: {
        id: true,
        keywords: true,
        campaignKols: {
          select: {
            kol: {
              select: {
                id: true,
                name: true,
                twitterHandle: true,
              },
            },
          },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json({
      campaignId: campaign.id,
      keywords: campaign.keywords,
      kols: campaign.campaignKols.map(ck => ({
        id: ck.kol.id,
        name: ck.kol.name,
        handle: ck.kol.twitterHandle,
      })),
      scraperAvailable: true,
    });
  } catch (error) {
    console.error("Error getting scraper info:", error);
    return NextResponse.json(
      { error: "Failed to get scraper info" },
      { status: 500 }
    );
  }
}
