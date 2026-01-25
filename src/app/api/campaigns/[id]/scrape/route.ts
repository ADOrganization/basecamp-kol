import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { scrapeMultipleKOLs, scrapeSingleTweet, setTwitterAuth, clearTwitterAuth, setTwitterApiKey, clearTwitterApiKey, type ScrapedTweet } from "@/lib/scraper/x-scraper";

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
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.organizationType !== "AGENCY") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: campaignId } = await params;
    const body = await request.json();
    const { mode = "all", kolIds, tweetUrls, autoImport = false, filterKeywords, twitterCookies, twitterCsrfToken, twitterApiKey } = body;

    // Load organization's saved Twitter API key if not provided in request
    let apiKeyToUse = twitterApiKey;
    if (!apiKeyToUse) {
      const org = await db.organization.findUnique({
        where: { id: session.user.organizationId },
        select: { twitterApiKey: true },
      });
      apiKeyToUse = org?.twitterApiKey || null;
      console.log(`[Scrape API] Loaded org API key: ${apiKeyToUse ? `${apiKeyToUse.slice(0, 12)}...` : 'none'}`);
    } else {
      console.log(`[Scrape API] Using request API key: ${apiKeyToUse.slice(0, 12)}...`);
    }

    // Set Twitter API key if available (preferred method)
    if (apiKeyToUse) {
      console.log(`[Scrape API] Setting Twitter API key`);
      setTwitterApiKey(apiKeyToUse);
    } else {
      console.log(`[Scrape API] No API key available, clearing`);
      clearTwitterApiKey();
    }

    // Set Twitter cookies as fallback
    if (twitterCookies) {
      setTwitterAuth(twitterCookies, undefined, twitterCsrfToken);
    } else {
      clearTwitterAuth();
    }

    // Get campaign with KOLs
    const campaign = await db.campaign.findFirst({
      where: {
        id: campaignId,
        agencyId: session.user.organizationId,
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
      const results = await scrapeMultipleKOLs(handles, keywordsToUse, 30);

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
            // Add KOL ID to tweets and filter out existing
            const newTweets = result.tweets
              .filter(t => !existingTweetUrls.has(t.id))
              .map(t => ({
                ...t,
                kolId: ck.kol.id,
                kolName: ck.kol.name,
                kolHandle: ck.kol.twitterHandle,
              }));

            scrapedTweets.push(...newTweets);
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
        apiKeyConfigured: !!apiKeyToUse,
        apiKeySource: twitterApiKey ? 'request' : (apiKeyToUse ? 'organization' : 'none'),
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
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: campaignId } = await params;
    const isAgency = session.user.organizationType === "AGENCY";

    const campaign = await db.campaign.findFirst({
      where: {
        id: campaignId,
        ...(isAgency
          ? { agencyId: session.user.organizationId }
          : { clientId: session.user.organizationId }),
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
