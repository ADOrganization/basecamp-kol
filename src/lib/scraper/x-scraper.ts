/**
 * X/Twitter Scraper
 * Uses multiple methods to scrape tweets:
 * 1. Twitter API via RapidAPI (most reliable - requires API key)
 * 2. Direct Twitter with user-provided cookies
 * 3. Nitter instances (open-source Twitter frontend)
 * 4. Twitter Syndication API (used for embeds)
 */

// Default API key - users should provide their own RapidAPI key
// Set to empty since the placeholder key is not subscribed
const DEFAULT_TWITTER_API_KEY = "";

// Custom API key storage - users can override via the UI
let customTwitterApiKey: string | null = null;

// Get the active API key (custom or default)
function getTwitterApiKey(): string | null {
  return customTwitterApiKey || DEFAULT_TWITTER_API_KEY || null;
}

// Legacy variable for compatibility
let twitterApiKey: string | null = null;

// Cookie storage (fallback)
let twitterCookies: string | null = null;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let _twitterAuthToken: string | null = null; // Reserved for future auth token usage
let twitterCsrfToken: string | null = null;

export function setTwitterApiKey(apiKey: string | null) {
  customTwitterApiKey = apiKey;
  twitterApiKey = apiKey; // Keep for compatibility
}

export function clearTwitterApiKey() {
  customTwitterApiKey = null;
  twitterApiKey = null;
}

export function hasTwitterApiKey(): boolean {
  return !!(customTwitterApiKey || DEFAULT_TWITTER_API_KEY);
}

export function getDefaultApiKey(): string {
  return DEFAULT_TWITTER_API_KEY;
}

export function setTwitterAuth(cookies: string, authToken?: string, csrfToken?: string) {
  twitterCookies = cookies;
  _twitterAuthToken = authToken || null;
  twitterCsrfToken = csrfToken || null;
}

export function clearTwitterAuth() {
  twitterCookies = null;
  _twitterAuthToken = null;
  twitterCsrfToken = null;
}

export function hasTwitterAuth(): boolean {
  return !!twitterCookies || !!twitterApiKey;
}

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

// Updated list of Nitter and alternative instances (Jan 2025)
const NITTER_INSTANCES = [
  'xcancel.com',
  'nitter.privacydev.net',
  'nitter.poast.org',
  'nitter.woodland.cafe',
  'nitter.adminforge.de',
  'nitter.cz',
  'nitter.1d4.us',
  'nitter.kavin.rocks',
  'nitter.unixfox.eu',
];

// Parse numbers with K/M suffixes
function parseMetricNumber(text: string): number {
  if (!text) return 0;
  const cleaned = text.trim().replace(/,/g, '');

  if (cleaned.endsWith('K') || cleaned.endsWith('k')) {
    return Math.round(parseFloat(cleaned.slice(0, -1)) * 1000);
  }
  if (cleaned.endsWith('M') || cleaned.endsWith('m')) {
    return Math.round(parseFloat(cleaned.slice(0, -1)) * 1000000);
  }
  if (cleaned.endsWith('B') || cleaned.endsWith('b')) {
    return Math.round(parseFloat(cleaned.slice(0, -1)) * 1000000000);
  }

  return parseInt(cleaned, 10) || 0;
}

// Extract tweet ID from URL
function extractTweetId(url: string): string | null {
  const match = url.match(/status\/(\d+)/);
  return match ? match[1] : null;
}

// Check if tweet matches keywords
function matchesKeywords(content: string, keywords: string[]): boolean {
  if (!keywords || keywords.length === 0) return true;
  const lowerContent = content.toLowerCase();
  return keywords.some(kw => lowerContent.includes(kw.toLowerCase()));
}

/**
 * Method 0: Twitter API via RapidAPI (most reliable)
 * Uses third-party API services for reliable access
 */
async function scrapeFromRapidAPI(options: ScrapeOptions): Promise<ScrapeResult> {
  const apiKey = getTwitterApiKey();

  if (!apiKey) {
    return { success: false, tweets: [], error: 'No API key configured', method: 'rapidapi' };
  }

  const { handle, keywords, maxTweets = 50, includeReplies = false, includeRetweets = true, sinceDate } = options;
  const cleanHandle = handle.replace('@', '');

  try {
    // Try Twitter API v2 via RapidAPI
    const url = `https://twitter-api45.p.rapidapi.com/timeline.php?screenname=${cleanHandle}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'twitter-api45.p.rapidapi.com',
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      // Try alternative endpoint
      const altUrl = `https://twitter241.p.rapidapi.com/user-tweets?user=${cleanHandle}&count=${maxTweets}`;
      const altResponse = await fetch(altUrl, {
        method: 'GET',
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': 'twitter241.p.rapidapi.com',
        },
        signal: AbortSignal.timeout(20000),
      });

      if (!altResponse.ok) {
        return { success: false, tweets: [], error: `API error: ${response.status}`, method: 'rapidapi' };
      }

      const altData = await altResponse.json();
      const tweets = parseRapidAPIResponse(altData, cleanHandle, 'twitter241');
      return filterTweets(tweets, { keywords, includeReplies, includeRetweets, sinceDate, maxTweets });
    }

    const data = await response.json();
    const tweets = parseRapidAPIResponse(data, cleanHandle, 'twitter-api45');
    return filterTweets(tweets, { keywords, includeReplies, includeRetweets, sinceDate, maxTweets });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, tweets: [], error: errorMsg, method: 'rapidapi' };
  }
}

// Parse RapidAPI response (handles multiple API formats)
function parseRapidAPIResponse(data: unknown, handle: string, source: string): ScrapedTweet[] {
  const tweets: ScrapedTweet[] = [];

  try {
    // Handle twitter-api45 format
    if (source === 'twitter-api45') {
      const timeline = (data as Record<string, unknown>)?.timeline || [];
      for (const item of timeline as Array<Record<string, unknown>>) {
        try {
          const tweet = item as Record<string, unknown>;
          const tweetId = String(tweet.tweet_id || tweet.id || '');
          if (!tweetId) continue;

          tweets.push({
            id: tweetId,
            url: `https://x.com/${handle}/status/${tweetId}`,
            content: String(tweet.text || tweet.full_text || ''),
            authorHandle: String(tweet.screen_name || handle),
            authorName: String(tweet.name || handle),
            postedAt: new Date(String(tweet.created_at || Date.now())),
            metrics: {
              likes: Number(tweet.favorites || tweet.favorite_count || 0),
              retweets: Number(tweet.retweets || tweet.retweet_count || 0),
              replies: Number(tweet.replies || tweet.reply_count || 0),
              quotes: Number(tweet.quotes || tweet.quote_count || 0),
              views: Number(tweet.views || tweet.view_count || 0),
            },
            mediaUrls: [],
            isRetweet: !!tweet.retweeted_status,
            isQuote: !!tweet.is_quote_status,
          });
        } catch {
          continue;
        }
      }
    }

    // Handle twitter241 format
    if (source === 'twitter241') {
      const results = (data as Record<string, unknown>)?.result || (data as Record<string, unknown>)?.tweets || [];
      for (const item of (Array.isArray(results) ? results : []) as Array<Record<string, unknown>>) {
        try {
          const tweet = item?.tweet || item;
          const tweetId = String((tweet as Record<string, unknown>)?.rest_id || (tweet as Record<string, unknown>)?.id || '');
          if (!tweetId) continue;

          const legacy = (tweet as Record<string, unknown>)?.legacy as Record<string, unknown> || tweet;
          const core = (tweet as Record<string, unknown>)?.core as Record<string, unknown>;
          const userLegacy = ((core?.user_results as Record<string, unknown>)?.result as Record<string, unknown>)?.legacy as Record<string, unknown>;

          tweets.push({
            id: tweetId,
            url: `https://x.com/${handle}/status/${tweetId}`,
            content: String(legacy?.full_text || legacy?.text || ''),
            authorHandle: String(userLegacy?.screen_name || handle),
            authorName: String(userLegacy?.name || handle),
            postedAt: new Date(String(legacy?.created_at || Date.now())),
            metrics: {
              likes: Number(legacy?.favorite_count || 0),
              retweets: Number(legacy?.retweet_count || 0),
              replies: Number(legacy?.reply_count || 0),
              quotes: Number(legacy?.quote_count || 0),
              views: Number(((tweet as Record<string, unknown>)?.views as Record<string, unknown>)?.count || 0),
            },
            mediaUrls: [],
            isRetweet: !!legacy?.retweeted_status_result,
            isQuote: !!legacy?.is_quote_status,
          });
        } catch {
          continue;
        }
      }
    }
  } catch {
    // Return empty if parsing fails
  }

  return tweets;
}

// Filter tweets helper
function filterTweets(
  tweets: ScrapedTweet[],
  options: { keywords?: string[]; includeReplies?: boolean; includeRetweets?: boolean; sinceDate?: Date; maxTweets?: number }
): ScrapeResult {
  let filtered = tweets;

  if (!options.includeReplies) {
    filtered = filtered.filter(t => !t.content.startsWith('@'));
  }

  if (!options.includeRetweets) {
    filtered = filtered.filter(t => !t.isRetweet);
  }

  if (options.keywords && options.keywords.length > 0) {
    filtered = filtered.filter(t => matchesKeywords(t.content, options.keywords!));
  }

  if (options.sinceDate) {
    filtered = filtered.filter(t => t.postedAt >= options.sinceDate!);
  }

  return {
    success: true,
    tweets: filtered.slice(0, options.maxTweets || 50),
    method: 'rapidapi',
  };
}

/**
 * Method 1: Direct Twitter API with user cookies
 * Requires user to paste their cookies from browser dev tools
 */
async function scrapeFromTwitterDirect(options: ScrapeOptions): Promise<ScrapeResult> {
  if (!twitterCookies) {
    return { success: false, tweets: [], error: 'No Twitter cookies set', method: 'twitter-direct' };
  }

  const { handle, keywords, maxTweets = 50, includeReplies = false, includeRetweets = true, sinceDate } = options;
  const cleanHandle = handle.replace('@', '');

  try {
    // Feature flags required by Twitter GraphQL API
    const userFeatures = {
      hidden_profile_subscriptions_enabled: true,
      rweb_tipjar_consumption_enabled: true,
      responsive_web_graphql_exclude_directive_enabled: true,
      verified_phone_label_enabled: false,
      subscriptions_verification_info_is_identity_verified_enabled: true,
      subscriptions_verification_info_verified_since_enabled: true,
      highlights_tweets_tab_ui_enabled: true,
      responsive_web_twitter_article_notes_tab_enabled: true,
      subscriptions_feature_can_gift_premium: true,
      creator_subscriptions_tweet_preview_api_enabled: true,
      responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
      responsive_web_graphql_timeline_navigation_enabled: true,
      hidden_profile_likes_enabled: true,
    };

    // First get user ID from handle
    const userVariables = { screen_name: cleanHandle, withSafetyModeUserFields: true };
    const userUrl = `https://api.twitter.com/graphql/G3KGOASz96M-Qu0nwmGXNg/UserByScreenName?variables=${encodeURIComponent(JSON.stringify(userVariables))}&features=${encodeURIComponent(JSON.stringify(userFeatures))}`;

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.5',
      'Cookie': twitterCookies,
      'authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
      'x-twitter-active-user': 'yes',
      'x-twitter-client-language': 'en',
    };

    if (twitterCsrfToken) {
      headers['x-csrf-token'] = twitterCsrfToken;
    }

    const userResponse = await fetch(userUrl, { headers, signal: AbortSignal.timeout(15000) });

    if (!userResponse.ok) {
      return { success: false, tweets: [], error: `Twitter API error: ${userResponse.status}`, method: 'twitter-direct' };
    }

    const userData = await userResponse.json();
    const userId = userData?.data?.user?.result?.rest_id;

    if (!userId) {
      return { success: false, tweets: [], error: 'Could not find user', method: 'twitter-direct' };
    }

    // Get user tweets
    const tweetsVariables = {
      userId,
      count: maxTweets,
      includePromotedContent: false,
      withQuickPromoteEligibilityTweetFields: false,
      withVoice: false,
      withV2Timeline: true,
    };

    const tweetsUrl = `https://api.twitter.com/graphql/V7H0Ap3_Hh2FyS75OCDO3Q/UserTweets?variables=${encodeURIComponent(JSON.stringify(tweetsVariables))}&features=${encodeURIComponent(JSON.stringify({
      rweb_tipjar_consumption_enabled: true,
      responsive_web_graphql_exclude_directive_enabled: true,
      verified_phone_label_enabled: false,
      creator_subscriptions_tweet_preview_api_enabled: true,
      responsive_web_graphql_timeline_navigation_enabled: true,
      responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
      communities_web_enable_tweet_community_results_fetch: true,
      c9s_tweet_anatomy_moderator_badge_enabled: true,
      articles_preview_enabled: true,
      tweetypie_unmention_optimization_enabled: true,
      responsive_web_edit_tweet_api_enabled: true,
      graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
      view_counts_everywhere_api_enabled: true,
      longform_notetweets_consumption_enabled: true,
      responsive_web_twitter_article_tweet_consumption_enabled: true,
      tweet_awards_web_tipping_enabled: false,
      creator_subscriptions_quote_tweet_preview_enabled: false,
      freedom_of_speech_not_reach_fetch_enabled: true,
      standardized_nudges_misinfo: true,
      tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
      rweb_video_timestamps_enabled: true,
      longform_notetweets_rich_text_read_enabled: true,
      longform_notetweets_inline_media_enabled: true,
      responsive_web_enhance_cards_enabled: false,
    }))}`;

    const tweetsResponse = await fetch(tweetsUrl, { headers, signal: AbortSignal.timeout(20000) });

    if (!tweetsResponse.ok) {
      return { success: false, tweets: [], error: `Twitter API error: ${tweetsResponse.status}`, method: 'twitter-direct' };
    }

    const tweetsData = await tweetsResponse.json();
    const tweets = parseTwitterAPIResponse(tweetsData, cleanHandle);

    // Filter tweets
    let filtered = tweets;

    if (!includeReplies) {
      filtered = filtered.filter(t => !t.content.startsWith('@'));
    }

    if (!includeRetweets) {
      filtered = filtered.filter(t => !t.isRetweet);
    }

    if (keywords && keywords.length > 0) {
      filtered = filtered.filter(t => matchesKeywords(t.content, keywords));
    }

    if (sinceDate) {
      filtered = filtered.filter(t => t.postedAt >= sinceDate);
    }

    return {
      success: true,
      tweets: filtered.slice(0, maxTweets),
      method: 'twitter-direct',
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, tweets: [], error: errorMsg, method: 'twitter-direct' };
  }
}

// Helper to safely get nested properties
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

// Parse Twitter GraphQL API response
function parseTwitterAPIResponse(data: unknown, handle: string): ScrapedTweet[] {
  const tweets: ScrapedTweet[] = [];

  try {
    // Navigate the complex Twitter API response structure
    const instructions = getNestedValue(data, 'data.user.result.timeline_v2.timeline.instructions') || [];

    for (const instruction of instructions) {
      if (instruction?.type !== 'TimelineAddEntries') continue;

      const entries = instruction?.entries || [];

      for (const entry of entries) {
        try {
          const content = entry?.content;
          if (content?.entryType !== 'TimelineTimelineItem') continue;

          const tweetResult = getNestedValue(content, 'itemContent.tweet_results.result');
          if (!tweetResult) continue;

          const legacy = tweetResult?.legacy;
          const core = tweetResult?.core;

          if (!legacy) continue;

          const tweetId = legacy.id_str as string;
          const fullText = (legacy.full_text as string) || '';
          const createdAt = legacy.created_at as string;
          const userLegacy = getNestedValue(core, 'user_results.result.legacy');

          tweets.push({
            id: tweetId,
            url: `https://x.com/${handle}/status/${tweetId}`,
            content: fullText.replace(/https:\/\/t\.co\/\S+/g, '').trim(),
            authorHandle: userLegacy?.screen_name || handle,
            authorName: userLegacy?.name || handle,
            postedAt: new Date(createdAt),
            metrics: {
              likes: legacy.favorite_count || 0,
              retweets: legacy.retweet_count || 0,
              replies: legacy.reply_count || 0,
              quotes: legacy.quote_count || 0,
              views: tweetResult.views?.count || 0,
            },
            mediaUrls: [],
            isRetweet: !!legacy.retweeted_status_result,
            isQuote: !!legacy.is_quote_status,
          });
        } catch {
          continue;
        }
      }
    }
  } catch {
    // Return empty if parsing fails
  }

  return tweets;
}

/**
 * Method 1: Scrape from Nitter/Alternative instances
 */
async function scrapeFromNitter(options: ScrapeOptions): Promise<ScrapeResult> {
  const { handle, keywords, maxTweets = 50, includeReplies = false, includeRetweets = true, sinceDate } = options;
  const cleanHandle = handle.replace('@', '');
  const errors: string[] = [];

  for (const instance of NITTER_INSTANCES) {
    try {
      const url = `https://${instance}/${cleanHandle}`;
      console.log(`[Scraper] Trying ${instance}...`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cache-Control': 'no-cache',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        errors.push(`${instance}: HTTP ${response.status}`);
        continue;
      }

      const html = await response.text();

      // Check if we got a valid response (not an error page)
      if (html.includes('Instance has been rate limited') ||
          html.includes('blocked') ||
          html.includes('Error') && html.length < 1000) {
        errors.push(`${instance}: Rate limited or blocked`);
        continue;
      }

      const tweets = parseNitterHTML(html, cleanHandle, instance);

      if (tweets.length === 0) {
        errors.push(`${instance}: No tweets parsed`);
        continue;
      }

      // Filter tweets
      let filtered = tweets;

      if (!includeReplies) {
        filtered = filtered.filter(t => !t.content.startsWith('@'));
      }

      if (!includeRetweets) {
        filtered = filtered.filter(t => !t.isRetweet);
      }

      if (keywords && keywords.length > 0) {
        filtered = filtered.filter(t => matchesKeywords(t.content, keywords));
      }

      if (sinceDate) {
        filtered = filtered.filter(t => t.postedAt >= sinceDate);
      }

      console.log(`[Scraper] Success from ${instance}: ${filtered.length} tweets`);

      return {
        success: true,
        tweets: filtered.slice(0, maxTweets),
        method: `nitter:${instance}`,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`${instance}: ${errorMsg}`);
      continue;
    }
  }

  return {
    success: false,
    tweets: [],
    error: `All instances failed: ${errors.slice(0, 3).join('; ')}`,
    method: 'nitter',
  };
}

// Parse Nitter HTML response - updated for various Nitter versions
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function parseNitterHTML(html: string, handle: string, _instance: string): ScrapedTweet[] {
  const tweets: ScrapedTweet[] = [];

  // Try multiple patterns for different Nitter versions

  // Pattern 1: Standard Nitter timeline-item
  const pattern1 = /<div class="timeline-item[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;

  // Pattern 2: tweet-body class
  const pattern2 = /<div class="tweet-body"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;

  // Pattern 3: xcancel style
  const pattern3 = /<article[^>]*class="[^"]*tweet[^"]*"[^>]*>([\s\S]*?)<\/article>/g;

  const patterns = [pattern1, pattern2, pattern3];

  for (const pattern of patterns) {
    const matches = html.matchAll(pattern);

    for (const match of matches) {
      try {
        const tweetHtml = match[1] || match[0];

        // Extract tweet link/ID - try multiple patterns
        let tweetId: string | null = null;
        const linkPatterns = [
          /href="\/[^/]+\/status\/(\d+)/,
          /data-tweet-id="(\d+)"/,
          /status\/(\d+)/,
        ];

        for (const linkPattern of linkPatterns) {
          const linkMatch = tweetHtml.match(linkPattern);
          if (linkMatch) {
            tweetId = linkMatch[1];
            break;
          }
        }

        if (!tweetId) continue;

        // Extract content - try multiple patterns
        let content = '';
        const contentPatterns = [
          /<div class="tweet-content[^"]*"[^>]*>([\s\S]*?)<\/div>/,
          /<p class="tweet-text[^"]*"[^>]*>([\s\S]*?)<\/p>/,
          /<div class="content"[^>]*>([\s\S]*?)<\/div>/,
        ];

        for (const contentPattern of contentPatterns) {
          const contentMatch = tweetHtml.match(contentPattern);
          if (contentMatch) {
            content = contentMatch[1]
              .replace(/<[^>]+>/g, ' ')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/&nbsp;/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            break;
          }
        }

        if (!content) continue;

        // Extract timestamp
        const timePatterns = [
          /<span class="tweet-date"[^>]*>[\s\S]*?title="([^"]+)"/,
          /<time[^>]*datetime="([^"]+)"/,
          /data-time="(\d+)"/,
        ];

        let postedAt = new Date();
        for (const timePattern of timePatterns) {
          const timeMatch = tweetHtml.match(timePattern);
          if (timeMatch) {
            const parsed = new Date(timeMatch[1]);
            if (!isNaN(parsed.getTime())) {
              postedAt = parsed;
              break;
            }
          }
        }

        // Extract metrics
        const likesMatch = tweetHtml.match(/(?:icon-heart|like-count)[^>]*>[\s\S]*?(\d+[KkMmBb]?)/);
        const retweetsMatch = tweetHtml.match(/(?:icon-retweet|retweet-count)[^>]*>[\s\S]*?(\d+[KkMmBb]?)/);
        const repliesMatch = tweetHtml.match(/(?:icon-comment|reply-count)[^>]*>[\s\S]*?(\d+[KkMmBb]?)/);

        // Check if retweet
        const isRetweet = tweetHtml.includes('retweet-header') ||
                          tweetHtml.includes('retweeted') ||
                          content.toLowerCase().startsWith('rt @');

        // Check if quote tweet
        const isQuote = tweetHtml.includes('quote') && tweetHtml.includes('status');

        tweets.push({
          id: tweetId,
          url: `https://x.com/${handle}/status/${tweetId}`,
          content,
          authorHandle: handle,
          authorName: handle,
          postedAt,
          metrics: {
            likes: parseMetricNumber(likesMatch?.[1] || '0'),
            retweets: parseMetricNumber(retweetsMatch?.[1] || '0'),
            replies: parseMetricNumber(repliesMatch?.[1] || '0'),
            quotes: 0,
            views: 0,
          },
          mediaUrls: [],
          isRetweet,
          isQuote,
        });
      } catch {
        continue;
      }
    }

    if (tweets.length > 0) break;
  }

  return tweets;
}

/**
 * Method 2: Twitter Syndication API (embed API)
 */
async function scrapeFromSyndication(tweetIds: string[]): Promise<Map<string, Partial<ScrapedTweet>>> {
  const results = new Map<string, Partial<ScrapedTweet>>();

  for (const tweetId of tweetIds) {
    try {
      const url = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=0`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) continue;

      const data = await response.json();

      if (data && data.text) {
        results.set(tweetId, {
          id: tweetId,
          content: data.text || '',
          authorHandle: data.user?.screen_name || '',
          authorName: data.user?.name || '',
          postedAt: data.created_at ? new Date(data.created_at) : new Date(),
          metrics: {
            likes: data.favorite_count || 0,
            retweets: data.retweet_count || 0,
            replies: data.reply_count || 0,
            quotes: data.quote_count || 0,
            views: data.views_count || 0,
          },
        });
      }
    } catch {
      continue;
    }
  }

  return results;
}

/**
 * Method 3: RSS Feed via Nitter
 */
async function scrapeFromNitterRSS(options: ScrapeOptions): Promise<ScrapeResult> {
  const { handle, keywords, maxTweets = 50, sinceDate } = options;
  const cleanHandle = handle.replace('@', '');

  for (const instance of NITTER_INSTANCES) {
    try {
      const url = `https://${instance}/${cleanHandle}/rss`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) continue;

      const xml = await response.text();

      if (!xml.includes('<item>')) continue;

      const tweets = parseNitterRSS(xml, cleanHandle);

      if (tweets.length === 0) continue;

      // Filter
      let filtered = tweets;

      if (keywords && keywords.length > 0) {
        filtered = filtered.filter(t => matchesKeywords(t.content, keywords));
      }

      if (sinceDate) {
        filtered = filtered.filter(t => t.postedAt >= sinceDate);
      }

      return {
        success: true,
        tweets: filtered.slice(0, maxTweets),
        method: `nitter-rss:${instance}`,
      };
    } catch {
      continue;
    }
  }

  return {
    success: false,
    tweets: [],
    error: 'All RSS feeds failed',
    method: 'nitter-rss',
  };
}

// Parse Nitter RSS feed
function parseNitterRSS(xml: string, handle: string): ScrapedTweet[] {
  const tweets: ScrapedTweet[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  const matches = xml.matchAll(itemRegex);

  for (const match of matches) {
    try {
      const itemXml = match[1];

      const linkMatch = itemXml.match(/<link>([^<]+)<\/link>/);
      const link = linkMatch?.[1] || '';
      const tweetId = extractTweetId(link);

      if (!tweetId) continue;

      // Extract content from title or description
      let content = '';
      const titleMatch = itemXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
                         itemXml.match(/<title>([^<]+)<\/title>/);
      const descMatch = itemXml.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
                        itemXml.match(/<description>([^<]+)<\/description>/);

      content = (titleMatch?.[1] || descMatch?.[1] || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();

      if (!content) continue;

      const dateMatch = itemXml.match(/<pubDate>([^<]+)<\/pubDate>/);
      const postedAt = dateMatch ? new Date(dateMatch[1]) : new Date();

      const creatorMatch = itemXml.match(/<dc:creator>([^<]+)<\/dc:creator>/);
      const authorName = creatorMatch?.[1] || handle;

      tweets.push({
        id: tweetId,
        url: `https://x.com/${handle}/status/${tweetId}`,
        content,
        authorHandle: handle,
        authorName,
        postedAt,
        metrics: { likes: 0, retweets: 0, replies: 0, quotes: 0, views: 0 },
        mediaUrls: [],
        isRetweet: content.toLowerCase().startsWith('rt @'),
        isQuote: false,
      });
    } catch {
      continue;
    }
  }

  return tweets;
}

/**
 * Main scrape function - tries multiple methods
 */
export async function scrapeTweets(options: ScrapeOptions): Promise<ScrapeResult> {
  console.log(`[Scraper] Starting scrape for @${options.handle}`);

  // Try RapidAPI first if API key is configured
  if (hasTwitterApiKey()) {
    console.log(`[Scraper] Trying RapidAPI...`);
    const apiResult = await scrapeFromRapidAPI(options);
    if (apiResult.success && apiResult.tweets.length > 0) {
      console.log(`[Scraper] RapidAPI success: ${apiResult.tweets.length} tweets`);
      return apiResult;
    }
    console.log(`[Scraper] RapidAPI failed: ${apiResult.error}`);
  }

  // Try direct Twitter API if cookies are set
  if (twitterCookies) {
    console.log(`[Scraper] Trying direct Twitter API with cookies...`);
    const directResult = await scrapeFromTwitterDirect(options);
    if (directResult.success && directResult.tweets.length > 0) {
      console.log(`[Scraper] Direct Twitter API success: ${directResult.tweets.length} tweets`);
      return directResult;
    }
    console.log(`[Scraper] Direct Twitter API failed: ${directResult.error}`);
  }

  // Fall back to Nitter
  let result = await scrapeFromNitter(options);

  if (result.success && result.tweets.length > 0) {
    // Enrich with syndication API for better metrics
    try {
      const tweetIds = result.tweets.map(t => t.id).slice(0, 10);
      const enrichedData = await scrapeFromSyndication(tweetIds);

      result.tweets = result.tweets.map(tweet => {
        const enriched = enrichedData.get(tweet.id);
        if (enriched) {
          return {
            ...tweet,
            content: enriched.content || tweet.content,
            authorName: enriched.authorName || tweet.authorName,
            metrics: {
              ...tweet.metrics,
              likes: enriched.metrics?.likes || tweet.metrics.likes,
              retweets: enriched.metrics?.retweets || tweet.metrics.retweets,
              replies: enriched.metrics?.replies || tweet.metrics.replies,
              quotes: enriched.metrics?.quotes || tweet.metrics.quotes,
              views: enriched.metrics?.views || tweet.metrics.views,
            },
          };
        }
        return tweet;
      });
    } catch {
      // Continue with unenriched data
    }

    return result;
  }

  // Fall back to RSS
  console.log(`[Scraper] Nitter failed, trying RSS...`);
  result = await scrapeFromNitterRSS(options);

  if (result.success && result.tweets.length > 0) {
    // Enrich with syndication API
    try {
      const tweetIds = result.tweets.map(t => t.id).slice(0, 10);
      const enrichedData = await scrapeFromSyndication(tweetIds);

      result.tweets = result.tweets.map(tweet => {
        const enriched = enrichedData.get(tweet.id);
        if (enriched) {
          return {
            ...tweet,
            content: enriched.content || tweet.content,
            authorName: enriched.authorName || tweet.authorName,
            metrics: {
              ...tweet.metrics,
              likes: enriched.metrics?.likes || tweet.metrics.likes,
              retweets: enriched.metrics?.retweets || tweet.metrics.retweets,
              replies: enriched.metrics?.replies || tweet.metrics.replies,
              quotes: enriched.metrics?.quotes || tweet.metrics.quotes,
              views: enriched.metrics?.views || tweet.metrics.views,
            },
          };
        }
        return tweet;
      });
    } catch {
      // Continue with unenriched data
    }

    return result;
  }

  return {
    success: false,
    tweets: [],
    error: result.error || 'All scraping methods failed. Twitter/X may be blocking requests.',
    method: 'none',
  };
}

/**
 * Scrape a single tweet by URL or ID
 */
export async function scrapeSingleTweet(urlOrId: string): Promise<ScrapedTweet | null> {
  const tweetId = urlOrId.includes('/') ? extractTweetId(urlOrId) : urlOrId;

  if (!tweetId) return null;

  // Try syndication API
  const syndicationResults = await scrapeFromSyndication([tweetId]);
  const syndicationData = syndicationResults.get(tweetId);

  if (syndicationData && syndicationData.content) {
    return {
      id: tweetId,
      url: `https://x.com/i/status/${tweetId}`,
      content: syndicationData.content,
      authorHandle: syndicationData.authorHandle || '',
      authorName: syndicationData.authorName || '',
      postedAt: syndicationData.postedAt || new Date(),
      metrics: syndicationData.metrics || {
        likes: 0, retweets: 0, replies: 0, quotes: 0, views: 0,
      },
      mediaUrls: [],
      isRetweet: false,
      isQuote: false,
    };
  }

  return null;
}

/**
 * Scrape multiple KOLs in parallel
 */
export async function scrapeMultipleKOLs(
  handles: string[],
  keywords?: string[],
  maxTweetsPerKOL: number = 20
): Promise<Map<string, ScrapeResult>> {
  const results = new Map<string, ScrapeResult>();

  // Process in batches of 2 to be gentler on servers
  const batchSize = 2;

  for (let i = 0; i < handles.length; i += batchSize) {
    const batch = handles.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(handle =>
        scrapeTweets({
          handle,
          keywords,
          maxTweets: maxTweetsPerKOL,
          includeReplies: false,
          includeRetweets: true,
        })
      )
    );

    batch.forEach((handle, index) => {
      results.set(handle.replace('@', '').toLowerCase(), batchResults[index]);
    });

    // Delay between batches
    if (i + batchSize < handles.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return results;
}
