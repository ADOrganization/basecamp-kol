import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  scrapeSingleTweet,
  setSocialDataApiKey,
  setApifyApiKey,
  hasSocialDataApiKey,
  hasApifyApiKey,
  getSocialDataApiKey,
} from "@/lib/scraper/x-scraper";

/**
 * Test endpoint to debug scraper functionality
 * GET /api/test-scraper?tweetId=1234567890
 */
export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const tweetId = url.searchParams.get("tweetId") || "1846987139428634858"; // Default test tweet

  try {
    // Load organization's API keys
    const org = await db.organization.findUnique({
      where: { id: session.user.organizationId },
      select: {
        id: true,
        name: true,
        socialDataApiKey: true,
        apifyApiKey: true,
      },
    });

    const debug: Record<string, unknown> = {
      orgId: org?.id,
      orgName: org?.name,
      hasSocialDataKey: !!org?.socialDataApiKey,
      hasApifyKey: !!org?.apifyApiKey,
      socialDataKeyPrefix: org?.socialDataApiKey?.slice(0, 8) || null,
    };

    // Set API keys
    if (org?.socialDataApiKey) {
      setSocialDataApiKey(org.socialDataApiKey);
    }
    if (org?.apifyApiKey) {
      setApifyApiKey(org.apifyApiKey);
    }

    debug.scraperHasSocialData = hasSocialDataApiKey();
    debug.scraperHasApify = hasApifyApiKey();

    // Test direct SocialData API call
    if (org?.socialDataApiKey) {
      console.log(`[Test] Testing SocialData GET API for tweet ${tweetId}...`);

      const response = await fetch(
        `https://api.socialdata.tools/twitter/tweets/${tweetId}`,
        {
          headers: {
            'Authorization': `Bearer ${org.socialDataApiKey}`,
            'Accept': 'application/json',
          },
          cache: 'no-store',
        }
      );

      debug.socialDataStatus = response.status;
      debug.socialDataStatusText = response.statusText;

      if (response.ok) {
        const data = await response.json();
        debug.socialDataResponse = {
          hasData: !!data,
          keys: Object.keys(data || {}),
          id_str: data?.id_str,
          text_preview: (data?.full_text || data?.text || '').slice(0, 100),
          favorite_count: data?.favorite_count,
          retweet_count: data?.retweet_count,
          reply_count: data?.reply_count,
          quote_count: data?.quote_count,
          views_count: data?.views_count,
          views: data?.views,
          bookmark_count: data?.bookmark_count,
          user_screen_name: data?.user?.screen_name,
        };

        // Store full raw response for debugging
        debug.rawApiResponse = JSON.stringify(data).slice(0, 2000);
      } else {
        const errorText = await response.text();
        debug.socialDataError = errorText.slice(0, 500);
      }
    }

    // Test Apify KaitoEasyAPI with tweetIDs parameter
    if (org?.apifyApiKey) {
      console.log(`[Test] Testing Apify KaitoEasyAPI with tweetIDs for ${tweetId}...`);

      try {
        const actorId = 'CJdippxWmn9uRfooo';
        const runResponse = await fetch(
          `https://api.apify.com/v2/acts/${actorId}/runs?token=${org.apifyApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tweetIDs: [tweetId],
              maxItems: 1,
            }),
          }
        );

        debug.apifyRunStatus = runResponse.status;

        if (runResponse.ok) {
          const runData = await runResponse.json();
          const runId = runData.data?.id;
          debug.apifyRunId = runId;

          if (runId) {
            // Wait for completion (simplified - just poll a few times)
            for (let i = 0; i < 15; i++) {
              await new Promise(r => setTimeout(r, 2000));

              const statusRes = await fetch(
                `https://api.apify.com/v2/actor-runs/${runId}?token=${org.apifyApiKey}`
              );
              const statusData = await statusRes.json();
              const status = statusData.data?.status;

              debug.apifyPollStatus = status;
              debug.apifyPollAttempt = i + 1;

              if (status === 'SUCCEEDED') {
                const datasetId = statusData.data?.defaultDatasetId;
                const itemsRes = await fetch(
                  `https://api.apify.com/v2/datasets/${datasetId}/items?token=${org.apifyApiKey}&limit=1`
                );
                const items = await itemsRes.json();

                if (items && items.length > 0) {
                  const item = items[0];
                  debug.apifyResponse = {
                    keys: Object.keys(item),
                    id: item.id,
                    text_preview: (item.text || item.full_text || '').slice(0, 100),
                    likeCount: item.likeCount,
                    retweetCount: item.retweetCount,
                    replyCount: item.replyCount,
                    quoteCount: item.quoteCount,
                    viewCount: item.viewCount,
                    bookmarkCount: item.bookmarkCount,
                    // Alternative field names
                    favorite_count: item.favorite_count,
                    retweet_count: item.retweet_count,
                    views: item.views,
                  };
                  debug.apifyRawSample = JSON.stringify(item).slice(0, 1000);
                }
                break;
              } else if (status === 'FAILED' || status === 'ABORTED') {
                debug.apifyError = `Run ${status}`;
                break;
              }
            }
          }
        } else {
          const errText = await runResponse.text();
          debug.apifyError = errText.slice(0, 300);
        }
      } catch (apifyErr) {
        debug.apifyError = apifyErr instanceof Error ? apifyErr.message : 'Unknown';
      }
    }

    // Also test syndication API
    try {
      console.log(`[Test] Testing syndication API for tweet ${tweetId}...`);
      const syndicationResponse = await fetch(
        `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=0`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
            'Accept': 'application/json',
          },
          cache: 'no-store',
        }
      );

      debug.syndicationStatus = syndicationResponse.status;

      if (syndicationResponse.ok) {
        const synData = await syndicationResponse.json();
        debug.syndicationResponse = {
          hasData: !!synData,
          favorite_count: synData?.favorite_count || synData?.like_count,
          retweet_count: synData?.retweet_count,
          reply_count: synData?.reply_count,
          quote_count: synData?.quote_count,
          views: synData?.views?.count || synData?.view_count,
          bookmark_count: synData?.bookmark_count,
        };
      } else {
        debug.syndicationError = `HTTP ${syndicationResponse.status}`;
      }
    } catch (synErr) {
      debug.syndicationError = synErr instanceof Error ? synErr.message : 'Unknown error';
    }

    // Test via scraper
    console.log(`[Test] Testing via scrapeSingleTweet for ${tweetId}...`);
    const tweet = await scrapeSingleTweet(tweetId);

    if (tweet) {
      debug.scraperResult = {
        success: true,
        id: tweet.id,
        content: tweet.content.slice(0, 100) + "...",
        metrics: tweet.metrics,
        authorHandle: tweet.authorHandle,
      };
    } else {
      debug.scraperResult = {
        success: false,
        error: "scrapeSingleTweet returned null",
      };
    }

    // Check if there's a post with this tweet ID in the database
    const post = await db.post.findFirst({
      where: {
        OR: [
          { tweetId: tweetId },
          { tweetUrl: { contains: tweetId } },
        ],
        campaign: {
          agencyId: session.user.organizationId,
        },
      },
      select: {
        id: true,
        tweetId: true,
        tweetUrl: true,
        impressions: true,
        likes: true,
        retweets: true,
        replies: true,
        quotes: true,
        bookmarks: true,
        lastMetricsUpdate: true,
      },
    });

    if (post) {
      debug.databasePost = {
        id: post.id,
        tweetId: post.tweetId,
        impressions: post.impressions,
        likes: post.likes,
        retweets: post.retweets,
        replies: post.replies,
        quotes: post.quotes,
        bookmarks: post.bookmarks,
        lastMetricsUpdate: post.lastMetricsUpdate?.toISOString(),
      };
    }

    return NextResponse.json({
      tweetId,
      debug,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Test] Error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
