/**
 * X/Twitter Scraper - SocialData.tools (primary) + Apify (fallback)
 * Uses SocialData.tools API for reliable metrics with Apify as backup
 */

// API key storage
let apifyApiKey: string | null = null;
let socialDataApiKey: string | null = null;

// SocialData API functions (primary)
export function setSocialDataApiKey(apiKey: string | null) {
  console.log(`[Scraper] setSocialDataApiKey called with: ${apiKey ? `${apiKey.slice(0, 12)}...` : 'null'}`);
  socialDataApiKey = apiKey;
}

export function clearSocialDataApiKey() {
  socialDataApiKey = null;
}

export function hasSocialDataApiKey(): boolean {
  return !!socialDataApiKey;
}

export function getSocialDataApiKey(): string | null {
  return socialDataApiKey;
}

// Apify API functions (fallback)
export function setApifyApiKey(apiKey: string | null) {
  console.log(`[Scraper] setApifyApiKey called with: ${apiKey ? `${apiKey.slice(0, 12)}...` : 'null'}`);
  apifyApiKey = apiKey;
}

export function clearApifyApiKey() {
  apifyApiKey = null;
}

export function hasApifyApiKey(): boolean {
  return !!apifyApiKey;
}

export function getApifyApiKey(): string | null {
  return apifyApiKey;
}

// Check if any scraper is configured
export function hasAnyScraperConfigured(): boolean {
  return hasSocialDataApiKey() || hasApifyApiKey();
}

// Legacy exports for compatibility (no-op)
export function setTwitterApiKey(_apiKey: string | null) {
  console.log(`[Scraper] setTwitterApiKey called (no-op)`);
}
export function clearTwitterApiKey() {}
export function hasTwitterApiKey(): boolean { return false; }
export function setTwitterAuth(_cookies: string, _authToken?: string, _csrfToken?: string) {}
export function clearTwitterAuth() {}
export function hasTwitterAuth(): boolean { return false; }

export interface ScrapedTweet {
  id: string;
  url: string;
  content: string;
  authorHandle: string;
  authorName: string;
  postedAt: Date;
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
    views: number;
    bookmarks: number;
  };
  mediaUrls: string[];
  isRetweet: boolean;
  isQuote: boolean;
  quotedTweetUrl?: string;
}

export interface ScrapeOptions {
  handle: string;
  keywords?: string[];
  maxTweets?: number;
  includeReplies?: boolean;
  includeRetweets?: boolean;
  sinceDate?: Date;
}

export interface ScrapeResult {
  success: boolean;
  tweets: ScrapedTweet[];
  error?: string;
  method: string;
}

// ============================================
// SOCIALDATA.TOOLS API (PRIMARY)
// ============================================


/**
 * Extract media URLs from tweet data
 */
function extractMediaUrls(data: Record<string, unknown>): string[] {
  const urls: string[] = [];
  try {
    const extendedEntities = data.extended_entities as Record<string, unknown> | undefined;
    const media = (extendedEntities?.media || data.media) as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(media)) {
      for (const item of media) {
        if (item.media_url_https) {
          urls.push(String(item.media_url_https));
        } else if (item.url) {
          urls.push(String(item.url));
        }
      }
    }
  } catch {
    // Ignore media extraction errors
  }
  return urls;
}

/**
 * Scrape a single tweet using SocialData.tools GET API (fallback)
 * Endpoint: GET https://api.socialdata.tools/twitter/tweets/{id}
 */
async function scrapeSingleTweetWithSocialDataGet(tweetId: string): Promise<ScrapedTweet | null> {
  const apiKey = getSocialDataApiKey();
  if (!apiKey) return null;

  console.log(`[SocialData GET] Fetching tweet ${tweetId}...`);

  try {
    const response = await fetch(
      `https://api.socialdata.tools/twitter/tweets/${tweetId}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[SocialData GET] HTTP ${response.status}: ${errorText.slice(0, 200)}`);
      return null;
    }

    const data = await response.json();
    console.log(`[SocialData GET] Raw response keys:`, Object.keys(data));

    // Extract tweet content
    const content = data.full_text || data.text || '';
    if (!content) {
      console.log(`[SocialData GET] No content found in response`);
      return null;
    }

    // Extract author info
    const user = data.user || {};
    const authorHandle = user.screen_name || '';

    // Extract metrics - SocialData returns these directly
    const metrics = {
      likes: Number(data.favorite_count || 0),
      retweets: Number(data.retweet_count || 0),
      replies: Number(data.reply_count || 0),
      quotes: Number(data.quote_count || 0),
      views: Number(data.views_count || data.views?.count || 0),
      bookmarks: Number(data.bookmark_count || 0),
    };

    console.log(`[SocialData GET] Extracted metrics for ${tweetId}:`, JSON.stringify(metrics));

    return {
      id: data.id_str || tweetId,
      url: `https://x.com/${authorHandle}/status/${tweetId}`,
      content,
      authorHandle,
      authorName: user.name || authorHandle,
      postedAt: data.created_at ? new Date(data.created_at) : new Date(),
      metrics,
      mediaUrls: extractMediaUrls(data),
      isRetweet: !!data.retweeted_status,
      isQuote: !!data.is_quote_status,
      quotedTweetUrl: data.quoted_status_permalink?.expanded || undefined,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.log(`[SocialData GET] Error fetching tweet ${tweetId}:`, errorMsg);
    return null;
  }
}

/**
 * Scrape a single tweet using SocialData GET API
 */
async function scrapeSingleTweetWithSocialData(tweetId: string): Promise<ScrapedTweet | null> {
  return scrapeSingleTweetWithSocialDataGet(tweetId);
}

/**
 * Search tweets using SocialData.tools GET API
 * Endpoint: GET https://api.socialdata.tools/twitter/search
 * Supports search operators: from:user, since:date, until:date
 */
async function scrapeFromSocialDataGet(options: ScrapeOptions): Promise<ScrapeResult> {
  const apiKey = getSocialDataApiKey();

  if (!apiKey) {
    return {
      success: false,
      tweets: [],
      error: 'No SocialData API key configured.',
      method: 'socialdata'
    };
  }

  const { handle, keywords, maxTweets = 100 } = options;
  const cleanHandle = handle.replace('@', '');

  console.log(`[SocialData GET] Starting search for @${cleanHandle}...`);

  try {
    // Build search query
    const query = `from:${cleanHandle}`;
    const encodedQuery = encodeURIComponent(query);

    const allTweets: ScrapedTweet[] = [];
    let cursor: string | null = null;
    let pages = 0;
    const maxPages = Math.ceil(maxTweets / 20); // ~20 results per page

    while (pages < maxPages) {
      const url: string = cursor
        ? `https://api.socialdata.tools/twitter/search?query=${encodedQuery}&cursor=${encodeURIComponent(cursor)}`
        : `https://api.socialdata.tools/twitter/search?query=${encodedQuery}`;

      console.log(`[SocialData GET] Fetching page ${pages + 1}...`);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`[SocialData GET] HTTP ${response.status}: ${errorText.slice(0, 200)}`);

        if (response.status === 402) {
          return {
            success: false,
            tweets: allTweets,
            error: 'SocialData: Not enough credits. Please top up your account.',
            method: 'socialdata'
          };
        }

        break;
      }

      const data = await response.json();
      const tweets = data.tweets || [];

      if (tweets.length === 0) {
        console.log(`[SocialData GET] No more tweets found`);
        break;
      }

      // Parse tweets
      for (const item of tweets) {
        try {
          const content = item.full_text || item.text || '';

          // Skip retweets
          if (content.startsWith('RT @')) continue;

          // Skip replies (unless they're from the user we're searching)
          if (item.in_reply_to_status_id_str && !content.startsWith(`@${cleanHandle}`)) continue;

          const user = item.user || {};
          const authorHandle = user.screen_name || cleanHandle;

          allTweets.push({
            id: item.id_str || String(item.id),
            url: `https://x.com/${authorHandle}/status/${item.id_str || item.id}`,
            content,
            authorHandle,
            authorName: user.name || authorHandle,
            postedAt: item.created_at ? new Date(item.created_at) : new Date(),
            metrics: {
              likes: Number(item.favorite_count || 0),
              retweets: Number(item.retweet_count || 0),
              replies: Number(item.reply_count || 0),
              quotes: Number(item.quote_count || 0),
              views: Number(item.views_count || item.views?.count || 0),
              bookmarks: Number(item.bookmark_count || 0),
            },
            mediaUrls: extractMediaUrls(item),
            isRetweet: false,
            isQuote: !!item.is_quote_status,
          });
        } catch {
          continue;
        }
      }

      // Check for next page
      cursor = data.next_cursor || null;
      pages++;

      if (!cursor || allTweets.length >= maxTweets) {
        break;
      }

      // Small delay between pages to be respectful
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`[SocialData GET] Fetched ${allTweets.length} tweets from @${cleanHandle}`);

    // Apply keyword filtering if specified
    let filteredTweets = allTweets;
    if (keywords && keywords.length > 0 && allTweets.length > 0) {
      const beforeFilter = allTweets.length;
      const lowerKeywords = keywords.map(kw => kw.toLowerCase());

      filteredTweets = allTweets.filter(tweet => {
        const lowerContent = tweet.content.toLowerCase();
        return lowerKeywords.some(kw => lowerContent.includes(kw));
      });

      console.log(`[SocialData GET] Keyword filter: ${beforeFilter} → ${filteredTweets.length} tweets`);

      if (filteredTweets.length === 0) {
        return {
          success: false,
          tweets: [],
          error: `Found ${beforeFilter} tweets from @${cleanHandle} but none matched keywords: ${keywords.join(', ')}`,
          method: 'socialdata',
        };
      }
    }

    return {
      success: filteredTweets.length > 0,
      tweets: filteredTweets.slice(0, maxTweets),
      error: filteredTweets.length === 0 ? `No tweets found for @${cleanHandle}` : undefined,
      method: 'socialdata',
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.log(`[SocialData GET] Error:`, errorMsg);
    return { success: false, tweets: [], error: `SocialData GET: ${errorMsg}`, method: 'socialdata' };
  }
}

/**
 * Search tweets using SocialData.tools API
 */
async function scrapeFromSocialData(options: ScrapeOptions): Promise<ScrapeResult> {
  return scrapeFromSocialDataGet(options);
}

/**
 * Fetch Twitter profile using SocialData.tools API
 * Endpoint: GET https://api.socialdata.tools/twitter/user/{screen_name}
 */
async function fetchProfileFromSocialData(handle: string): Promise<TwitterProfile | null> {
  const apiKey = getSocialDataApiKey();
  if (!apiKey) return null;

  const cleanHandle = handle.replace('@', '').toLowerCase();
  console.log(`[SocialData] Fetching profile for @${cleanHandle}...`);

  try {
    const response = await fetch(
      `https://api.socialdata.tools/twitter/user/${cleanHandle}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) {
      console.log(`[SocialData] Profile fetch failed: HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();

    return {
      screenName: data.screen_name || cleanHandle,
      name: data.name || cleanHandle,
      followersCount: Number(data.followers_count || 0),
      followingCount: Number(data.friends_count || 0),
      avatarUrl: data.profile_image_url_https?.replace('_normal', '_400x400') || null,
    };
  } catch (error) {
    console.log(`[SocialData] Profile error:`, error);
    return null;
  }
}

// ============================================
// APIFY API (FALLBACK)
// ============================================

/**
 * Parse Apify Twitter Scraper response
 * Actual response format from KaitoEasyAPI actor:
 * { type: "tweet", id: "123", url: "...", text: "...", retweetCount, likeCount, etc. }
 */
function parseApifyResponse(data: unknown[], handle: string): ScrapedTweet[] {
  const tweets: ScrapedTweet[] = [];

  if (!Array.isArray(data)) return tweets;

  for (const item of data as Array<Record<string, unknown>>) {
    try {
      // Skip mock data entries
      if (item.type === 'mock_tweet') {
        continue;
      }

      // Get tweet ID - Apify returns it as a string number
      const tweetId = String(item.id || '');
      if (!tweetId || tweetId === '-1' || tweetId === 'undefined') continue;

      // Parse the tweet content
      const content = String(item.text || item.full_text || item.content || '');

      // Skip mock data from KaitoEasyAPI (returned when no real results found)
      if (content.includes('KaitoEasyAPI') && content.includes('mock data')) {
        continue;
      }

      // Skip retweets (they start with "RT @")
      if (content.startsWith('RT @')) continue;

      // Skip replies based on isReply flag or content starting with @
      if (item.isReply === true) continue;
      if (content.startsWith('@') && !content.startsWith('@' + handle)) continue;

      // Extract handle from URL if available
      const urlStr = String(item.url || item.twitterUrl || '');
      const urlMatch = urlStr.match(/x\.com\/([^/]+)\/status/) || urlStr.match(/twitter\.com\/([^/]+)\/status/);
      const authorHandle = urlMatch ? urlMatch[1] : handle;

      tweets.push({
        id: tweetId,
        url: String(item.url || item.twitterUrl || `https://x.com/${authorHandle}/status/${tweetId}`),
        content,
        authorHandle,
        authorName: authorHandle, // Apify doesn't return display name in this format
        postedAt: new Date(String(item.createdAt || item.created_at || Date.now())),
        metrics: {
          likes: Number(item.likeCount || item.favorite_count || 0),
          retweets: Number(item.retweetCount || item.retweet_count || 0),
          replies: Number(item.replyCount || item.reply_count || 0),
          quotes: Number(item.quoteCount || item.quote_count || 0),
          views: Number(item.viewCount || item.view_count || 0),
          bookmarks: Number(item.bookmarkCount || item.bookmark_count || 0),
        },
        mediaUrls: [],
        isRetweet: false,
        isQuote: !!item.isQuote || !!item.is_quote_status,
      });
    } catch {
      continue;
    }
  }

  return tweets;
}

/**
 * Scrape tweets using Apify Twitter Scraper
 * Actor ID: CJdippxWmn9uRfooo
 */
async function scrapeFromApify(options: ScrapeOptions): Promise<ScrapeResult> {
  const apiKey = getApifyApiKey();

  if (!apiKey) {
    return {
      success: false,
      tweets: [],
      error: 'No Apify API key configured. Add your key in Settings → Integrations.',
      method: 'apify'
    };
  }

  const { handle, keywords, maxTweets = 100 } = options;
  const cleanHandle = handle.replace('@', '');

  console.log(`[Scraper] Starting Apify scrape for @${cleanHandle}...`);

  try {
    // Actor ID for the Twitter scraper
    const actorId = 'CJdippxWmn9uRfooo';

    // IMPORTANT: Always fetch ALL tweets from user, then filter client-side
    // Twitter search doesn't do partial word matching (e.g., "infrared" won't match "@InfraredFinance")
    // So we fetch all tweets and filter locally for more reliable keyword matching
    const searchTerms = [`from:${cleanHandle}`];

    // Build the input - match Apify actor documentation exactly
    const input = {
      searchTerms,
      maxItems: maxTweets,
    };

    console.log(`[Scraper] Apify search terms:`, searchTerms);
    console.log(`[Scraper] Will filter client-side for keywords:`, keywords || 'none');

    console.log(`[Scraper] Apify input:`, JSON.stringify(input, null, 2));

    // Start the actor run
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs?token=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(30000),
      }
    );

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.log(`[Scraper] Apify run failed: HTTP ${runResponse.status} - ${errorText}`);
      return {
        success: false,
        tweets: [],
        error: `Apify: HTTP ${runResponse.status} - ${errorText.slice(0, 100)}`,
        method: 'apify'
      };
    }

    const runData = await runResponse.json();
    const runId = runData.data?.id;

    if (!runId) {
      console.log(`[Scraper] Apify response:`, JSON.stringify(runData));
      return { success: false, tweets: [], error: 'Apify: Failed to start run', method: 'apify' };
    }

    console.log(`[Scraper] Apify run started: ${runId}`);

    // Poll for completion (max 120 seconds for larger scrapes)
    const maxWait = 120000;
    const pollInterval = 3000;
    let elapsed = 0;

    while (elapsed < maxWait) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      elapsed += pollInterval;

      const statusResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${apiKey}`,
        { signal: AbortSignal.timeout(10000) }
      );

      if (!statusResponse.ok) continue;

      const statusData = await statusResponse.json();
      const status = statusData.data?.status;

      console.log(`[Scraper] Apify status: ${status} (${elapsed / 1000}s)`);

      if (status === 'SUCCEEDED') {
        // Get the results
        const datasetId = statusData.data?.defaultDatasetId;
        if (!datasetId) {
          return { success: false, tweets: [], error: 'Apify: No dataset ID', method: 'apify' };
        }

        const resultsResponse = await fetch(
          `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiKey}&limit=${maxTweets}`,
          { signal: AbortSignal.timeout(15000) }
        );

        if (!resultsResponse.ok) {
          return { success: false, tweets: [], error: 'Apify: Failed to get results', method: 'apify' };
        }

        const results = await resultsResponse.json();
        console.log(`[Scraper] Apify raw results: ${Array.isArray(results) ? results.length : 0} items`);

        // Log first result to understand the data structure
        if (Array.isArray(results) && results.length > 0) {
          console.log(`[Scraper] Apify first result keys:`, Object.keys(results[0]));
          console.log(`[Scraper] Apify first result:`, JSON.stringify(results[0]).slice(0, 800));
        }

        let tweets = parseApifyResponse(results, cleanHandle);
        console.log(`[Scraper] Apify parsed: ${tweets.length} tweets from @${cleanHandle}`);

        // Check if we only got mock data (no real results)
        if (tweets.length === 0 && Array.isArray(results) && results.length > 0) {
          const firstResult = results[0] as Record<string, unknown>;
          const firstContent = String(firstResult?.full_text || firstResult?.text || firstResult?.content || '');

          if (firstContent.includes('KaitoEasyAPI') && firstContent.includes('mock data')) {
            console.log(`[Scraper] Apify returned only mock data - no real tweets found`);
            return {
              success: false,
              tweets: [],
              error: `No tweets found for @${cleanHandle}`,
              method: 'apify',
            };
          }

          console.log(`[Scraper] First result sample:`, JSON.stringify(results[0]).slice(0, 500));
        }

        // Apply keyword filtering client-side (Twitter search doesn't do partial matching)
        // This filter is case-insensitive and matches substrings (prefix/suffix/middle)
        // e.g., keyword "infrared" matches "InfraredFinance", "INFRARED", "preinfrared", etc.
        if (keywords && keywords.length > 0 && tweets.length > 0) {
          const beforeFilter = tweets.length;
          const lowerKeywords = keywords.map(kw => kw.toLowerCase());

          tweets = tweets.filter(tweet => {
            const lowerContent = tweet.content.toLowerCase();
            const matchedKw = lowerKeywords.find(kw => lowerContent.includes(kw));
            if (matchedKw) {
              console.log(`[Scraper] ✓ Tweet matched keyword "${matchedKw}": "${tweet.content.slice(0, 80)}..."`);
              return true;
            }
            return false;
          });

          console.log(`[Scraper] Keyword filter: ${beforeFilter} → ${tweets.length} tweets`);
          console.log(`[Scraper] Keywords used (case-insensitive substring match): ${keywords.join(', ')}`);

          if (tweets.length === 0) {
            return {
              success: false,
              tweets: [],
              error: `Found ${beforeFilter} tweets from @${cleanHandle} but none matched keywords: ${keywords.join(', ')}`,
              method: 'apify',
            };
          }
        }

        return {
          success: tweets.length > 0,
          tweets: tweets.slice(0, maxTweets),
          error: tweets.length === 0 ? `No tweets found for @${cleanHandle}` : undefined,
          method: 'apify',
        };
      } else if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
        return {
          success: false,
          tweets: [],
          error: `Apify run ${status.toLowerCase()}`,
          method: 'apify'
        };
      }
    }

    return { success: false, tweets: [], error: 'Apify: Timeout waiting for results', method: 'apify' };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.log(`[Scraper] Apify error:`, errorMsg);
    return { success: false, tweets: [], error: `Apify: ${errorMsg}`, method: 'apify' };
  }
}

/**
 * Main scrape function - uses SocialData (primary) with Apify fallback
 */
export async function scrapeTweets(options: ScrapeOptions): Promise<ScrapeResult> {
  console.log(`[Scraper] Starting scrape for @${options.handle}`);

  // Check if any scraper is configured
  if (!hasSocialDataApiKey() && !hasApifyApiKey()) {
    return {
      success: false,
      tweets: [],
      error: 'No API key configured. Add SocialData or Apify key in Settings → Integrations.',
      method: 'none',
    };
  }

  // Try SocialData first (primary)
  if (hasSocialDataApiKey()) {
    console.log(`[Scraper] Trying SocialData API (primary)...`);
    const result = await scrapeFromSocialData(options);

    if (result.success) {
      console.log(`[Scraper] SocialData success: ${result.tweets.length} tweets from @${options.handle}`);
      return result;
    }

    console.log(`[Scraper] SocialData failed: ${result.error}`);

    // If SocialData failed and Apify is configured, try fallback
    if (hasApifyApiKey()) {
      console.log(`[Scraper] Falling back to Apify...`);
    } else {
      return result; // Return SocialData error if no fallback available
    }
  }

  // Fallback to Apify
  if (hasApifyApiKey()) {
    console.log(`[Scraper] Using Apify API${hasSocialDataApiKey() ? ' (fallback)' : ''}...`);
    const result = await scrapeFromApify(options);

    if (result.success) {
      console.log(`[Scraper] Apify success: ${result.tweets.length} tweets from @${options.handle}`);
    } else {
      console.log(`[Scraper] Apify failed: ${result.error}`);
    }

    return result;
  }

  return {
    success: false,
    tweets: [],
    error: 'No API key configured.',
    method: 'none',
  };
}

/**
 * Batch fetch multiple tweets by ID using Apify KaitoEasyAPI
 * Uses tweetIDs parameter to fetch all tweets in a single actor run
 * Returns a map of tweet ID to ScrapedTweet (or null if not found)
 */
export async function scrapeTweetsByIds(tweetIds: string[]): Promise<Map<string, ScrapedTweet | null>> {
  const results = new Map<string, ScrapedTweet | null>();

  if (tweetIds.length === 0) {
    return results;
  }

  const apiKey = getApifyApiKey();

  // If Apify isn't configured, fall back to individual fetches
  if (!apiKey) {
    console.log(`[Batch] No Apify API key, falling back to individual fetches`);
    for (const tweetId of tweetIds) {
      results.set(tweetId, await scrapeSingleTweet(tweetId));
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    return results;
  }

  console.log(`[Batch] Fetching ${tweetIds.length} tweets via KaitoEasyAPI searchTerms...`);

  try {
    const actorId = 'CJdippxWmn9uRfooo';

    // Convert tweet IDs to URLs for searchTerms (tweetIDs param doesn't work reliably)
    const tweetUrls = tweetIds.map(id => `https://x.com/i/status/${id}`);

    // Start actor with tweet URLs
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs?token=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchTerms: tweetUrls,
          maxItems: tweetIds.length,
        }),
        signal: AbortSignal.timeout(60000),
      }
    );

    if (!runResponse.ok) {
      console.log(`[Batch] Failed to start actor: ${runResponse.status}, falling back to individual fetches`);
      for (const tweetId of tweetIds) {
        results.set(tweetId, await scrapeSingleTweet(tweetId));
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      return results;
    }

    const runData = await runResponse.json();
    const runId = runData.data?.id;

    if (!runId) {
      console.log(`[Batch] No run ID returned, falling back to individual fetches`);
      for (const tweetId of tweetIds) {
        results.set(tweetId, await scrapeSingleTweet(tweetId));
      }
      return results;
    }

    // Poll for completion (max 120 seconds for batch)
    let attempts = 0;
    const maxAttempts = 60;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;

      const statusResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${apiKey}`
      );

      if (!statusResponse.ok) continue;

      const statusData = await statusResponse.json();
      const status = statusData.data?.status;

      console.log(`[Batch] Run status: ${status} (${attempts * 2}s)`);

      if (status === 'SUCCEEDED') {
        const datasetId = statusData.data?.defaultDatasetId;
        if (!datasetId) break;

        const itemsResponse = await fetch(
          `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiKey}&limit=${tweetIds.length}`
        );

        if (!itemsResponse.ok) break;

        const items = await itemsResponse.json();
        console.log(`[Batch] Received ${items?.length || 0} items from actor`);

        // Parse all returned tweets into a map
        const receivedTweets = new Map<string, ScrapedTweet>();

        for (const item of items || []) {
          try {
            const id = String(item.id || '');
            if (!id) continue;

            const content = String(item.text || item.full_text || '');
            if (content.includes('KaitoEasyAPI') && content.includes('mock data')) {
              continue;
            }

            receivedTweets.set(id, {
              id,
              url: item.url || item.twitterUrl || `https://x.com/i/status/${id}`,
              content,
              authorHandle: item.author?.userName || item.user?.screen_name || '',
              authorName: item.author?.name || item.user?.name || '',
              postedAt: item.createdAt ? new Date(item.createdAt) : new Date(),
              metrics: {
                likes: Number(item.likeCount || item.favorite_count || 0),
                retweets: Number(item.retweetCount || item.retweet_count || 0),
                replies: Number(item.replyCount || item.reply_count || 0),
                quotes: Number(item.quoteCount || item.quote_count || 0),
                views: Number(item.viewCount || item.views?.count || item.view_count || 0),
                bookmarks: Number(item.bookmarkCount || item.bookmark_count || 0),
              },
              mediaUrls: [],
              isRetweet: false,
              isQuote: false,
            });
          } catch {
            continue;
          }
        }

        // Map results to requested tweet IDs
        for (const tweetId of tweetIds) {
          results.set(tweetId, receivedTweets.get(tweetId) || null);
        }

        const foundCount = Array.from(results.values()).filter(t => t !== null).length;
        console.log(`[Batch] Matched ${foundCount}/${tweetIds.length} tweets`);

        return results;
      } else if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
        console.log(`[Batch] Run failed: ${status}`);
        break;
      }
    }

    // If batch failed, fall back to individual fetches
    console.log(`[Batch] Batch failed, falling back to individual fetches`);
    for (const tweetId of tweetIds) {
      results.set(tweetId, await scrapeSingleTweet(tweetId));
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return results;
  } catch (error) {
    console.log(`[Batch] Error:`, error);
    // Fall back to individual fetches
    for (const tweetId of tweetIds) {
      results.set(tweetId, await scrapeSingleTweet(tweetId));
    }
    return results;
  }
}

/**
 * Scrape a single tweet by URL or ID
 * Uses SocialData (primary) with Apify fallback, then syndication API
 */
export async function scrapeSingleTweet(urlOrId: string): Promise<ScrapedTweet | null> {
  // Extract tweet ID from URL if needed
  const tweetIdMatch = urlOrId.match(/status\/(\d+)/);
  const tweetId = tweetIdMatch ? tweetIdMatch[1] : urlOrId;

  if (!tweetId || !/^\d+$/.test(tweetId)) return null;

  // Try to extract author handle from URL (e.g., https://x.com/elonmusk/status/123)
  const handleMatch = urlOrId.match(/(?:x\.com|twitter\.com)\/([^/]+)\/status/);
  const authorHandle = handleMatch ? handleMatch[1] : undefined;

  // Try SocialData first (primary - most reliable for metrics)
  if (hasSocialDataApiKey()) {
    try {
      const tweet = await scrapeSingleTweetWithSocialData(tweetId);
      if (tweet) {
        console.log(`[ScrapeSingleTweet] SocialData success for ${tweetId}`);
        return tweet;
      }
    } catch (error) {
      console.log(`[ScrapeSingleTweet] SocialData failed for ${tweetId}:`, error);
    }
  }

  // Fallback to Apify (requires author handle to search tweets)
  if (hasApifyApiKey() && authorHandle) {
    try {
      const tweet = await scrapeSingleTweetWithApify(tweetId, authorHandle);
      if (tweet) {
        console.log(`[ScrapeSingleTweet] Apify success for ${tweetId}`);
        return tweet;
      }
    } catch (error) {
      console.log(`[ScrapeSingleTweet] Apify failed for ${tweetId}:`, error);
    }
  } else if (hasApifyApiKey() && !authorHandle) {
    console.log(`[ScrapeSingleTweet] Skipping Apify - no author handle in URL: ${urlOrId}`);
  }

  // Last resort: syndication API (may not work, limited metrics)
  try {
    console.log(`[ScrapeSingleTweet] Trying syndication API for ${tweetId}...`);
    const url = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=0`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;

    const data = await response.json();

    if (data && data.text) {
      return {
        id: tweetId,
        url: `https://x.com/${data.user?.screen_name || 'i'}/status/${tweetId}`,
        content: data.text || '',
        authorHandle: data.user?.screen_name || '',
        authorName: data.user?.name || '',
        postedAt: data.created_at ? new Date(data.created_at) : new Date(),
        metrics: {
          likes: data.favorite_count || 0,
          retweets: data.retweet_count || 0,
          replies: data.reply_count || 0,
          quotes: data.quote_count || 0,
          views: data.views?.count || data.views_count || 0,
          bookmarks: data.bookmark_count || 0,
        },
        mediaUrls: [],
        isRetweet: false,
        isQuote: false,
      };
    }
  } catch {
    // Fall through
  }

  return null;
}

/**
 * Scrape a single tweet using Apify KaitoEasyAPI actor
 * Uses searchTerms with author handle since tweetIDs/URLs don't work reliably
 * Actor: CJdippxWmn9uRfooo (kaitoeasyapi/twitter-x-data-tweet-scraper-pay-per-result-cheapest)
 */
async function scrapeSingleTweetWithApify(tweetId: string, authorHandle?: string): Promise<ScrapedTweet | null> {
  const apiKey = getApifyApiKey();
  if (!apiKey) return null;

  const actorId = 'CJdippxWmn9uRfooo';

  // If we don't have the author handle, we can't use Apify effectively
  // The tweetIDs and URL-based searches don't work with this actor
  if (!authorHandle) {
    console.log(`[Apify] No author handle provided for tweet ${tweetId}, skipping Apify`);
    return null;
  }

  const cleanHandle = authorHandle.replace('@', '');
  console.log(`[Apify] Fetching tweets from @${cleanHandle} to find tweet ${tweetId}...`);

  try {
    // Search for recent tweets from this user
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs?token=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchTerms: [`from:${cleanHandle}`],
          maxItems: 50, // Fetch more to find our specific tweet
        }),
        signal: AbortSignal.timeout(30000),
      }
    );

    if (!runResponse.ok) {
      console.log(`[Apify] Failed to start actor: ${runResponse.status}`);
      return null;
    }

    const runData = await runResponse.json();
    const runId = runData.data?.id;
    if (!runId) return null;

    // Poll for completion (max 60 seconds)
    let attempts = 0;
    const maxAttempts = 30;
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;

      const statusResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${apiKey}`
      );

      if (!statusResponse.ok) continue;

      const statusData = await statusResponse.json();
      const status = statusData.data?.status;

      if (status === 'SUCCEEDED') {
        const datasetId = statusData.data?.defaultDatasetId;
        if (!datasetId) return null;

        // Fetch the results
        const itemsResponse = await fetch(
          `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiKey}&limit=1`
        );

        if (!itemsResponse.ok) return null;

        const items = await itemsResponse.json();
        if (!items || items.length === 0) {
          console.log(`[Apify] No items returned for tweet ${tweetId}`);
          return null;
        }

        console.log(`[Apify] Received ${items.length} items, searching for tweet ${tweetId}...`);

        // Find the specific tweet by ID
        for (const item of items) {
          // Skip mock data
          const content = String(item.text || item.full_text || item.content || '');
          if (content.includes('KaitoEasyAPI') && content.includes('mock data')) {
            continue;
          }

          // Check if this is our tweet
          const itemId = String(item.id || '');
          if (itemId !== tweetId) {
            continue;
          }

          console.log(`[Apify] Found matching tweet ${tweetId}`);
          console.log(`[Apify] Raw item keys:`, Object.keys(item));

          // Extract metrics
          const metrics = {
            likes: Number(item.likeCount || item.favorite_count || 0),
            retweets: Number(item.retweetCount || item.retweet_count || 0),
            replies: Number(item.replyCount || item.reply_count || 0),
            quotes: Number(item.quoteCount || item.quote_count || 0),
            views: Number(item.viewCount || item.views?.count || item.view_count || 0),
            bookmarks: Number(item.bookmarkCount || item.bookmark_count || 0),
          };

          console.log(`[Apify] Extracted metrics for ${tweetId}:`, JSON.stringify(metrics));

          const actualUrl = item.url || item.twitterUrl || `https://x.com/${cleanHandle}/status/${tweetId}`;

          return {
            id: itemId,
            url: actualUrl,
            content,
            authorHandle: item.author?.userName || item.user?.screen_name || cleanHandle,
            authorName: item.author?.name || item.user?.name || cleanHandle,
            postedAt: item.createdAt ? new Date(item.createdAt) : new Date(),
            metrics,
            mediaUrls: [],
            isRetweet: false,
            isQuote: false,
          };
        }

        console.log(`[Apify] Tweet ${tweetId} not found in results from @${cleanHandle}`);
        return null;
      } else if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
        console.log(`[Apify] Run failed with status: ${status}`);
        return null;
      }
    }

    console.log(`[Apify] Timed out waiting for run ${runId}`);
    return null;
  } catch (error) {
    console.log(`[Apify] Error scraping tweet ${tweetId}:`, error);
    return null;
  }
}

/**
 * Scrape multiple KOLs sequentially to avoid rate limiting
 */
export async function scrapeMultipleKOLs(
  handles: string[],
  keywords?: string[],
  maxTweetsPerKOL: number = 20
): Promise<Map<string, ScrapeResult>> {
  const results = new Map<string, ScrapeResult>();

  // Check if any scraper is configured
  if (!hasSocialDataApiKey() && !hasApifyApiKey()) {
    for (const handle of handles) {
      results.set(handle.replace('@', '').toLowerCase(), {
        success: false,
        tweets: [],
        error: 'No API key configured. Add SocialData or Apify key in Settings → Integrations.',
        method: 'none',
      });
    }
    return results;
  }

  // Process handles sequentially to avoid rate limiting
  for (let i = 0; i < handles.length; i++) {
    const handle = handles[i];
    console.log(`[Scraper] Processing handle ${i + 1}/${handles.length}: @${handle}`);

    const result = await scrapeTweets({
      handle,
      keywords,
      maxTweets: maxTweetsPerKOL,
      includeReplies: false,
      includeRetweets: false,
    });

    results.set(handle.replace('@', '').toLowerCase(), result);

    // Delay between requests to avoid rate limiting
    if (i < handles.length - 1) {
      console.log(`[Scraper] Waiting 3s before next request...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  return results;
}

export interface TwitterProfile {
  screenName: string;
  name: string;
  followersCount: number;
  followingCount: number;
  avatarUrl: string | null;
}

/**
 * Fetch Twitter profile data including followers count
 * Uses SocialData (primary) with Apify fallback
 */
export async function fetchTwitterProfile(handle: string): Promise<TwitterProfile | null> {
  const cleanHandle = handle.replace('@', '').toLowerCase();

  // Method 1: Try SocialData first (primary)
  if (hasSocialDataApiKey()) {
    const profile = await fetchProfileFromSocialData(handle);
    if (profile && profile.followersCount > 0) {
      console.log(`[Profile] Found via SocialData for @${cleanHandle}: ${profile.followersCount} followers`);
      return profile;
    }
    console.log(`[Profile] SocialData did not return profile for @${cleanHandle}`);
  }

  // Method 2: Use Apify Twitter Profile Scraper as fallback
  const apiKey = getApifyApiKey();
  if (apiKey) {
    try {
      console.log(`[Profile] Fetching @${cleanHandle} via Apify...`);

      // Use the tweet scraper actor to get user info from a recent tweet
      const actorId = 'CJdippxWmn9uRfooo';
      const input = {
        searchTerms: [`from:${cleanHandle}`],
        maxItems: 1,
      };

      const runResponse = await fetch(
        `https://api.apify.com/v2/acts/${actorId}/runs?token=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
          signal: AbortSignal.timeout(30000),
        }
      );

      if (runResponse.ok) {
        const runData = await runResponse.json();
        const runId = runData.data?.id;

        if (runId) {
          // Poll for completion (max 60 seconds)
          const maxWait = 60000;
          const pollInterval = 2000;
          let elapsed = 0;

          while (elapsed < maxWait) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            elapsed += pollInterval;

            const statusResponse = await fetch(
              `https://api.apify.com/v2/actor-runs/${runId}?token=${apiKey}`,
              { signal: AbortSignal.timeout(10000) }
            );

            if (!statusResponse.ok) continue;

            const statusData = await statusResponse.json();
            const status = statusData.data?.status;

            if (status === 'SUCCEEDED') {
              const datasetId = statusData.data?.defaultDatasetId;
              if (datasetId) {
                const resultsResponse = await fetch(
                  `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiKey}&limit=1`,
                  { signal: AbortSignal.timeout(10000) }
                );

                if (resultsResponse.ok) {
                  const results = await resultsResponse.json();
                  if (Array.isArray(results) && results.length > 0) {
                    const tweet = results[0] as Record<string, unknown>;
                    // The tweet data includes author info
                    const author = tweet.author as Record<string, unknown> | undefined;
                    const followersCount = Number(author?.followers || tweet.author_followers || 0);
                    const followingCount = Number(author?.following || tweet.author_following || 0);
                    const avatarUrl = String(author?.profilePicture || author?.avatar || tweet.author_profile_image || '');
                    const name = String(author?.name || tweet.author_name || cleanHandle);

                    if (followersCount > 0) {
                      console.log(`[Profile] Found via Apify for @${cleanHandle}: ${followersCount} followers`);
                      return {
                        screenName: cleanHandle,
                        name,
                        followersCount,
                        followingCount,
                        avatarUrl: avatarUrl || null,
                      };
                    }
                  }
                }
              }
              break;
            } else if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
              console.log(`[Profile] Apify run ${status} for @${cleanHandle}`);
              break;
            }
          }
        }
      }
      console.log(`[Profile] Apify method did not return followers for @${cleanHandle}`);
    } catch (error) {
      console.log(`[Profile] Apify error for @${cleanHandle}:`, error);
    }
  }

  // Method 2: Try Twitter syndication API
  try {
    const embedUrl = `https://cdn.syndication.twimg.com/widgets/followbutton/info.json?screen_names=${cleanHandle}`;
    const response = await fetch(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://twitter.com/',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        const profile = data[0];
        if (profile.followers_count > 0) {
          console.log(`[Profile] Found via syndication API for @${cleanHandle}: ${profile.followers_count} followers`);
          return {
            screenName: profile.screen_name || cleanHandle,
            name: profile.name || cleanHandle,
            followersCount: profile.followers_count || 0,
            followingCount: profile.friends_count || 0,
            avatarUrl: profile.profile_image_url_https
              ? profile.profile_image_url_https.replace('_normal', '_400x400')
              : null,
          };
        }
      }
    }
    console.log(`[Profile] Syndication API failed for @${cleanHandle}`);
  } catch (error) {
    console.log(`[Profile] Syndication API error for @${cleanHandle}:`, error);
  }

  // Method 3: Return partial data with just avatar from unavatar.io
  try {
    const avatarUrl = `https://unavatar.io/twitter/${cleanHandle}`;
    const response = await fetch(avatarUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      console.log(`[Profile] Got avatar only for @${cleanHandle} via unavatar.io`);
      return {
        screenName: cleanHandle,
        name: cleanHandle,
        followersCount: 0,
        followingCount: 0,
        avatarUrl: avatarUrl,
      };
    }
  } catch (error) {
    console.log(`[Profile] Unavatar failed for @${cleanHandle}:`, error);
  }

  console.log(`[Profile] All methods failed for @${cleanHandle}`);
  return null;
}

/**
 * Fetch Twitter banner URL for a given handle
 * Returns the banner image URL or null if not found
 */
export async function fetchTwitterBanner(handle: string): Promise<string | null> {
  const cleanHandle = handle.replace('@', '').toLowerCase();
  const apiKey = getApifyApiKey();

  // Method 1: Use Apify Profile Scraper if API key available
  if (apiKey) {
    try {
      console.log(`[Banner] Fetching @${cleanHandle} profile via Apify...`);

      // Use a dedicated Twitter profile scraper that returns banner data
      // Try multiple profile scraper actors
      const profileActors = [
        'apidojo~twitter-profile-scraper',
        'epctex~twitter-profile-scraper',
        'microworlds~twitter-profile-scraper',
      ];

      for (const actorId of profileActors) {
        try {
          console.log(`[Banner] Trying actor: ${actorId}`);

          // Input format for profile scrapers
          const input = {
            handles: [cleanHandle],
            proxyConfiguration: { useApifyProxy: true },
          };

          const runResponse = await fetch(
            `https://api.apify.com/v2/acts/${actorId}/runs?token=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(input),
              signal: AbortSignal.timeout(30000),
            }
          );

          if (!runResponse.ok) {
            console.log(`[Banner] Actor ${actorId} not available: HTTP ${runResponse.status}`);
            continue;
          }

          const runData = await runResponse.json();
          const runId = runData.data?.id;

          if (!runId) continue;

          // Poll for completion (max 60 seconds)
          const maxWait = 60000;
          const pollInterval = 3000;
          let elapsed = 0;

          while (elapsed < maxWait) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            elapsed += pollInterval;

            const statusResponse = await fetch(
              `https://api.apify.com/v2/actor-runs/${runId}?token=${apiKey}`,
              { signal: AbortSignal.timeout(10000) }
            );

            if (!statusResponse.ok) continue;

            const statusData = await statusResponse.json();
            const status = statusData.data?.status;

            if (status === 'SUCCEEDED') {
              const datasetId = statusData.data?.defaultDatasetId;
              if (datasetId) {
                const resultsResponse = await fetch(
                  `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiKey}&limit=1`,
                  { signal: AbortSignal.timeout(10000) }
                );

                if (resultsResponse.ok) {
                  const results = await resultsResponse.json();
                  console.log(`[Banner] Actor ${actorId} returned:`, JSON.stringify(results).slice(0, 500));

                  if (Array.isArray(results) && results.length > 0) {
                    const profile = results[0] as Record<string, unknown>;
                    // Try various field names for banner URL from profile data
                    const bannerUrl = profile.profileBannerUrl ||
                      profile.profile_banner_url ||
                      profile.bannerUrl ||
                      profile.banner_url ||
                      profile.coverImageUrl ||
                      profile.cover_image_url ||
                      profile.headerImageUrl ||
                      profile.header_image_url ||
                      profile.profileBanner;

                    if (bannerUrl && typeof bannerUrl === 'string') {
                      console.log(`[Banner] Found via ${actorId} for @${cleanHandle}: ${bannerUrl.slice(0, 80)}...`);
                      return bannerUrl;
                    }

                    // Also check if there's a nested user object
                    const user = profile.user as Record<string, unknown> | undefined;
                    if (user) {
                      const userBanner = user.profile_banner_url || user.profileBannerUrl;
                      if (userBanner && typeof userBanner === 'string') {
                        console.log(`[Banner] Found in user object via ${actorId} for @${cleanHandle}`);
                        return userBanner;
                      }
                    }
                  }
                }
              }
              break;
            } else if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
              console.log(`[Banner] Apify run ${status} for @${cleanHandle} with ${actorId}`);
              break;
            }
          }
        } catch (actorError) {
          console.log(`[Banner] Actor ${actorId} error:`, actorError);
          continue;
        }
      }

      console.log(`[Banner] No Apify profile actors returned banner for @${cleanHandle}`);
    } catch (error) {
      console.log(`[Banner] Apify error for @${cleanHandle}:`, error);
    }
  }

  // Method 2: Try Twitter timeline embed (most reliable - no API key needed!)
  try {
    console.log(`[Banner] Trying Twitter timeline embed for @${cleanHandle}...`);
    const timelineUrl = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${cleanHandle}`;
    const response = await fetch(timelineUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (response.ok) {
      const html = await response.text();
      // Extract profile_banner_url from the embedded JSON
      const bannerMatch = html.match(/profile_banner_url['"]\s*:\s*['"]([^'"]+)['"]/);
      if (bannerMatch && bannerMatch[1]) {
        // Unescape the URL and add size suffix
        const bannerUrl = bannerMatch[1].replace(/\\\//g, '/');
        console.log(`[Banner] Found via timeline embed for @${cleanHandle}: ${bannerUrl}`);
        return bannerUrl + '/1500x500';
      } else {
        console.log(`[Banner] Timeline embed returned no banner for @${cleanHandle}`);
      }
    } else {
      console.log(`[Banner] Timeline embed failed for @${cleanHandle}: HTTP ${response.status}`);
    }
  } catch (error) {
    console.log(`[Banner] Timeline embed error for @${cleanHandle}:`, error);
  }

  // Method 3: Try syndication API (fallback)
  try {
    const embedUrl = `https://cdn.syndication.twimg.com/widgets/followbutton/info.json?screen_names=${cleanHandle}`;
    const response = await fetch(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      const text = await response.text();
      if (text && text.trim()) {
        try {
          const data = JSON.parse(text);
          if (Array.isArray(data) && data.length > 0) {
            const profile = data[0];
            if (profile.profile_banner_url) {
              console.log(`[Banner] Found via syndication API for @${cleanHandle}`);
              return profile.profile_banner_url + '/1500x500';
            }
            if (profile.id_str || profile.id) {
              const userId = profile.id_str || profile.id;
              const bannerUrl = `https://pbs.twimg.com/profile_banners/${userId}/1500x500`;
              const bannerCheck = await fetch(bannerUrl, {
                method: 'HEAD',
                signal: AbortSignal.timeout(5000),
              });
              if (bannerCheck.ok) {
                console.log(`[Banner] Constructed from user ID for @${cleanHandle}`);
                return bannerUrl;
              }
            }
          }
        } catch {
          // Ignore JSON parse errors
        }
      }
    }
  } catch (error) {
    console.log(`[Banner] Syndication API error for @${cleanHandle}:`, error);
  }

  console.log(`[Banner] Could not fetch banner for @${cleanHandle}`);
  return null;
}

/**
 * Fetch both Twitter avatar and banner for a given handle
 * Uses Apify if available to get both in a single call
 */
export async function fetchTwitterMedia(handle: string): Promise<{
  avatarUrl: string | null;
  bannerUrl: string | null;
}> {
  const cleanHandle = handle.replace('@', '').toLowerCase();
  const apiKey = getApifyApiKey();

  // Method 1: Use Apify to get both avatar and banner in one call
  if (apiKey) {
    try {
      console.log(`[Media] Fetching @${cleanHandle} profile via Apify...`);

      // Use the tweet scraper actor to get user info from a recent tweet
      const actorId = 'CJdippxWmn9uRfooo';
      const input = {
        searchTerms: [`from:${cleanHandle}`],
        maxItems: 1,
      };

      const runResponse = await fetch(
        `https://api.apify.com/v2/acts/${actorId}/runs?token=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
          signal: AbortSignal.timeout(30000),
        }
      );

      if (runResponse.ok) {
        const runData = await runResponse.json();
        const runId = runData.data?.id;

        if (runId) {
          // Poll for completion (max 60 seconds)
          const maxWait = 60000;
          const pollInterval = 2000;
          let elapsed = 0;

          while (elapsed < maxWait) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            elapsed += pollInterval;

            const statusResponse = await fetch(
              `https://api.apify.com/v2/actor-runs/${runId}?token=${apiKey}`,
              { signal: AbortSignal.timeout(10000) }
            );

            if (!statusResponse.ok) continue;

            const statusData = await statusResponse.json();
            const status = statusData.data?.status;

            if (status === 'SUCCEEDED') {
              const datasetId = statusData.data?.defaultDatasetId;
              if (datasetId) {
                const resultsResponse = await fetch(
                  `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiKey}&limit=1`,
                  { signal: AbortSignal.timeout(10000) }
                );

                if (resultsResponse.ok) {
                  const results = await resultsResponse.json();
                  if (Array.isArray(results) && results.length > 0) {
                    const tweet = results[0] as Record<string, unknown>;
                    const author = tweet.author as Record<string, unknown> | undefined;

                    // Extract avatar URL
                    let avatarUrl: string | null = null;
                    const profilePic = author?.profilePicture ||
                      author?.avatar ||
                      author?.profile_image_url_https ||
                      tweet.author_profile_image;
                    if (profilePic && typeof profilePic === 'string') {
                      // Get higher resolution version
                      avatarUrl = profilePic.replace('_normal', '_400x400');
                      console.log(`[Media] Found avatar via Apify for @${cleanHandle}`);
                    }

                    // Extract banner URL
                    let bannerUrl: string | null = null;
                    const banner = author?.profileBannerUrl ||
                      author?.profile_banner_url ||
                      author?.banner_url ||
                      author?.coverImageUrl ||
                      tweet.author_profile_banner_url;
                    if (banner && typeof banner === 'string') {
                      bannerUrl = banner;
                      console.log(`[Media] Found banner via Apify for @${cleanHandle}`);
                    }

                    // If we got at least one, fill in missing with fallback methods
                    if (avatarUrl || bannerUrl) {
                      // If no avatar from Apify, try unavatar
                      if (!avatarUrl) {
                        avatarUrl = await fetchTwitterAvatar(handle);
                      }
                      // If no banner from Apify, try timeline embed method
                      if (!bannerUrl) {
                        console.log(`[Media] Apify returned avatar but no banner, trying timeline embed...`);
                        bannerUrl = await fetchTwitterBanner(handle);
                      }
                      return { avatarUrl, bannerUrl };
                    }
                  }
                }
              }
              break;
            } else if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
              console.log(`[Media] Apify run ${status} for @${cleanHandle}`);
              break;
            }
          }
        }
      }
      console.log(`[Media] Apify method did not return media for @${cleanHandle}, falling back`);
    } catch (error) {
      console.log(`[Media] Apify error for @${cleanHandle}:`, error);
    }
  }

  // Method 2: Fetch avatar and banner separately as fallback
  const [avatarUrl, bannerUrl] = await Promise.all([
    fetchTwitterAvatar(handle),
    fetchTwitterBanner(handle),
  ]);

  return { avatarUrl, bannerUrl };
}

/**
 * Fetch Twitter profile picture URL for a given handle
 */
export async function fetchTwitterAvatar(handle: string): Promise<string | null> {
  const cleanHandle = handle.replace('@', '').toLowerCase();

  // Use unavatar.io (reliable, no API key needed)
  try {
    const unavatarUrl = `https://unavatar.io/twitter/${cleanHandle}`;
    const response = await fetch(unavatarUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      console.log(`[Avatar] Found via unavatar.io for @${cleanHandle}`);
      return unavatarUrl;
    }
  } catch (error) {
    console.log(`[Avatar] unavatar.io failed:`, error);
  }

  // Fallback to syndication API
  try {
    const embedUrl = `https://cdn.syndication.twimg.com/widgets/followbutton/info.json?screen_names=${cleanHandle}`;
    const response = await fetch(embedUrl, {
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = await response.json();
      if (data[0]?.profile_image_url_https) {
        const avatarUrl = data[0].profile_image_url_https.replace('_normal', '_400x400');
        console.log(`[Avatar] Found via syndication API for @${cleanHandle}`);
        return avatarUrl;
      }
    }
  } catch (error) {
    console.log(`[Avatar] Syndication API failed:`, error);
  }

  console.log(`[Avatar] Could not fetch avatar for @${cleanHandle}`);
  return null;
}
