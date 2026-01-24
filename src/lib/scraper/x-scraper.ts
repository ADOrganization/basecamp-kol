/**
 * Free X/Twitter Scraper
 * Uses multiple methods to scrape tweets without API limits:
 * 1. Nitter instances (open-source Twitter frontend)
 * 2. Twitter Syndication API (used for embeds)
 * 3. Alternative Twitter frontends
 */

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
function parseNitterHTML(html: string, handle: string, instance: string): ScrapedTweet[] {
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

  // Try Nitter HTML first
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
