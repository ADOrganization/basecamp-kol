/**
 * Free X/Twitter Scraper
 * Uses multiple methods to scrape tweets without API limits:
 * 1. Nitter instances (open-source Twitter frontend)
 * 2. Twitter Syndication API (used for embeds)
 * 3. Direct HTML parsing
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

// List of public Nitter instances (these change frequently, may need updating)
const NITTER_INSTANCES = [
  'nitter.poast.org',
  'nitter.privacydev.net',
  'nitter.projectsegfau.lt',
  'nitter.adminforge.de',
  'nitter.woodland.cafe',
  'nitter.1d4.us',
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

// Parse relative time strings like "2h", "3d", "Jan 20"
function parseRelativeTime(timeStr: string): Date {
  const now = new Date();
  const cleaned = timeStr.trim().toLowerCase();

  // Handle relative times
  if (cleaned.endsWith('s')) {
    const seconds = parseInt(cleaned);
    return new Date(now.getTime() - seconds * 1000);
  }
  if (cleaned.endsWith('m') && !cleaned.includes(' ')) {
    const minutes = parseInt(cleaned);
    return new Date(now.getTime() - minutes * 60 * 1000);
  }
  if (cleaned.endsWith('h')) {
    const hours = parseInt(cleaned);
    return new Date(now.getTime() - hours * 60 * 60 * 1000);
  }
  if (cleaned.endsWith('d')) {
    const days = parseInt(cleaned);
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }

  // Try parsing as date
  const parsed = new Date(timeStr);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  return now;
}

// Check if tweet matches keywords
function matchesKeywords(content: string, keywords: string[]): boolean {
  if (!keywords || keywords.length === 0) return true;
  const lowerContent = content.toLowerCase();
  return keywords.some(kw => lowerContent.includes(kw.toLowerCase()));
}

/**
 * Method 1: Scrape from Nitter instances
 * Nitter is an open-source Twitter frontend that doesn't require authentication
 */
async function scrapeFromNitter(options: ScrapeOptions): Promise<ScrapeResult> {
  const { handle, keywords, maxTweets = 50, includeReplies = false, includeRetweets = true, sinceDate } = options;
  const cleanHandle = handle.replace('@', '');

  for (const instance of NITTER_INSTANCES) {
    try {
      const url = `https://${instance}/${cleanHandle}`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) continue;

      const html = await response.text();
      const tweets = parseNitterHTML(html, cleanHandle, instance);

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
        method: `nitter:${instance}`,
      };
    } catch (error) {
      // Try next instance
      continue;
    }
  }

  return {
    success: false,
    tweets: [],
    error: 'All Nitter instances failed',
    method: 'nitter',
  };
}

// Parse Nitter HTML response
function parseNitterHTML(html: string, handle: string, instance: string): ScrapedTweet[] {
  const tweets: ScrapedTweet[] = [];

  // Match tweet containers - Nitter uses timeline-item class
  const tweetRegex = /<div class="timeline-item[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
  const matches = html.matchAll(tweetRegex);

  for (const match of matches) {
    try {
      const tweetHtml = match[1];

      // Extract tweet link/ID
      const linkMatch = tweetHtml.match(/href="\/[^/]+\/status\/(\d+)/);
      if (!linkMatch) continue;

      const tweetId = linkMatch[1];

      // Extract content
      const contentMatch = tweetHtml.match(/<div class="tweet-content[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      const content = contentMatch
        ? contentMatch[1]
            .replace(/<[^>]+>/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, ' ')
            .trim()
        : '';

      // Extract timestamp
      const timeMatch = tweetHtml.match(/<span class="tweet-date"[^>]*>[\s\S]*?title="([^"]+)"/);
      const postedAt = timeMatch ? new Date(timeMatch[1]) : new Date();

      // Extract metrics
      const likesMatch = tweetHtml.match(/icon-heart[^>]*><\/span>\s*(\d+[KkMmBb]?)/);
      const retweetsMatch = tweetHtml.match(/icon-retweet[^>]*><\/span>\s*(\d+[KkMmBb]?)/);
      const repliesMatch = tweetHtml.match(/icon-comment[^>]*><\/span>\s*(\d+[KkMmBb]?)/);
      const quotesMatch = tweetHtml.match(/icon-quote[^>]*><\/span>\s*(\d+[KkMmBb]?)/);

      // Check if retweet
      const isRetweet = tweetHtml.includes('retweet-header') || tweetHtml.includes('icon-retweet') && tweetHtml.includes('retweeted');

      // Check if quote tweet
      const isQuote = tweetHtml.includes('quote-link');
      const quoteMatch = tweetHtml.match(/class="quote-link"[^>]*href="([^"]+)"/);

      // Extract media
      const mediaUrls: string[] = [];
      const mediaMatches = tweetHtml.matchAll(/class="still-image"[^>]*href="([^"]+)"/g);
      for (const mediaMatch of mediaMatches) {
        mediaUrls.push(`https://${instance}${mediaMatch[1]}`);
      }

      tweets.push({
        id: tweetId,
        url: `https://twitter.com/${handle}/status/${tweetId}`,
        content,
        authorHandle: handle,
        authorName: handle, // Nitter doesn't always show display name easily
        postedAt,
        metrics: {
          likes: parseMetricNumber(likesMatch?.[1] || '0'),
          retweets: parseMetricNumber(retweetsMatch?.[1] || '0'),
          replies: parseMetricNumber(repliesMatch?.[1] || '0'),
          quotes: parseMetricNumber(quotesMatch?.[1] || '0'),
          views: 0, // Nitter doesn't show views
        },
        mediaUrls,
        isRetweet,
        isQuote,
        quotedTweetUrl: quoteMatch ? `https://twitter.com${quoteMatch[1].replace(instance, '')}` : undefined,
      });
    } catch {
      // Skip malformed tweets
      continue;
    }
  }

  return tweets;
}

/**
 * Method 2: Twitter Syndication API
 * This is the API Twitter uses for embedded tweets - no auth required
 */
async function scrapeFromSyndication(tweetIds: string[]): Promise<Map<string, Partial<ScrapedTweet>>> {
  const results = new Map<string, Partial<ScrapedTweet>>();

  for (const tweetId of tweetIds) {
    try {
      // Twitter's syndication endpoint for embedded tweets
      const url = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=0`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) continue;

      const data = await response.json();

      if (data) {
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
      // Continue with next tweet
    }
  }

  return results;
}

/**
 * Method 3: RSS Feed via Nitter
 * Some Nitter instances provide RSS feeds
 */
async function scrapeFromNitterRSS(options: ScrapeOptions): Promise<ScrapeResult> {
  const { handle, keywords, maxTweets = 50, sinceDate } = options;
  const cleanHandle = handle.replace('@', '');

  for (const instance of NITTER_INSTANCES) {
    try {
      const url = `https://${instance}/${cleanHandle}/rss`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) continue;

      const xml = await response.text();
      const tweets = parseNitterRSS(xml, cleanHandle);

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
    error: 'All Nitter RSS feeds failed',
    method: 'nitter-rss',
  };
}

// Parse Nitter RSS feed
function parseNitterRSS(xml: string, handle: string): ScrapedTweet[] {
  const tweets: ScrapedTweet[] = [];

  // Parse RSS items
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  const matches = xml.matchAll(itemRegex);

  for (const match of matches) {
    try {
      const itemXml = match[1];

      // Extract link (contains tweet URL)
      const linkMatch = itemXml.match(/<link>([^<]+)<\/link>/);
      const link = linkMatch?.[1] || '';
      const tweetId = extractTweetId(link);

      if (!tweetId) continue;

      // Extract title/content
      const titleMatch = itemXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/);
      const descMatch = itemXml.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/);

      const content = (titleMatch?.[1] || descMatch?.[1] || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();

      // Extract date
      const dateMatch = itemXml.match(/<pubDate>([^<]+)<\/pubDate>/);
      const postedAt = dateMatch ? new Date(dateMatch[1]) : new Date();

      // Extract creator
      const creatorMatch = itemXml.match(/<dc:creator>([^<]+)<\/dc:creator>/);
      const authorName = creatorMatch?.[1] || handle;

      tweets.push({
        id: tweetId,
        url: `https://twitter.com/${handle}/status/${tweetId}`,
        content,
        authorHandle: handle,
        authorName,
        postedAt,
        metrics: {
          likes: 0,
          retweets: 0,
          replies: 0,
          quotes: 0,
          views: 0,
        },
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
  // Try Nitter HTML first (most reliable for metrics)
  let result = await scrapeFromNitter(options);

  if (result.success && result.tweets.length > 0) {
    // Optionally enrich with syndication API for better metrics
    const tweetIds = result.tweets.map(t => t.id);
    const enrichedData = await scrapeFromSyndication(tweetIds.slice(0, 20)); // Limit to avoid rate limits

    // Merge enriched data
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

    return result;
  }

  // Fall back to RSS
  result = await scrapeFromNitterRSS(options);

  if (result.success && result.tweets.length > 0) {
    // Enrich with syndication API
    const tweetIds = result.tweets.map(t => t.id);
    const enrichedData = await scrapeFromSyndication(tweetIds.slice(0, 20));

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

    return result;
  }

  return {
    success: false,
    tweets: [],
    error: 'All scraping methods failed',
    method: 'none',
  };
}

/**
 * Scrape a single tweet by URL or ID
 */
export async function scrapeSingleTweet(urlOrId: string): Promise<ScrapedTweet | null> {
  const tweetId = urlOrId.includes('/') ? extractTweetId(urlOrId) : urlOrId;

  if (!tweetId) return null;

  // Try syndication API first
  const syndicationResults = await scrapeFromSyndication([tweetId]);
  const syndicationData = syndicationResults.get(tweetId);

  if (syndicationData && syndicationData.content) {
    return {
      id: tweetId,
      url: `https://twitter.com/i/status/${tweetId}`,
      content: syndicationData.content,
      authorHandle: syndicationData.authorHandle || '',
      authorName: syndicationData.authorName || '',
      postedAt: syndicationData.postedAt || new Date(),
      metrics: syndicationData.metrics || {
        likes: 0,
        retweets: 0,
        replies: 0,
        quotes: 0,
        views: 0,
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

  // Process in batches of 3 to avoid overwhelming servers
  const batchSize = 3;

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

    // Small delay between batches
    if (i + batchSize < handles.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}
