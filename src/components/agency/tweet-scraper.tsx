"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Download,
  Search,
  Loader2,
  CheckCircle,
  XCircle,
  ExternalLink,
  Hash,
  Eye,
  ThumbsUp,
  Repeat2,
  MessageCircle,
  Import,
  RefreshCw,
  Settings,
  ChevronDown,
  Cookie,
} from "lucide-react";
import { formatNumber } from "@/lib/utils";

interface KOL {
  id: string;
  name: string;
  handle: string;
}

interface ScrapedTweet {
  id: string;
  url: string;
  content: string;
  authorHandle: string;
  authorName: string;
  postedAt: string;
  matchedKeywords: string[];
  hasKeywordMatch: boolean;
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
    views: number;
  };
  kolId?: string;
  kolName?: string;
}

interface ScrapeResult {
  kol: string;
  success: boolean;
  count: number;
  error?: string;
}

interface TweetScraperProps {
  campaignId: string;
  kols: KOL[];
  keywords: string[];
  open: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

export function TweetScraper({
  campaignId,
  kols,
  keywords,
  open,
  onClose,
  onImportComplete,
}: TweetScraperProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("scrape");
  const [showSettings, setShowSettings] = useState(false);

  // Twitter auth state - persist in localStorage
  const [twitterApiKey, setTwitterApiKey] = useState("");
  const [twitterCookies, setTwitterCookies] = useState("");
  const [twitterCsrfToken, setTwitterCsrfToken] = useState("");

  // Load saved auth on mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem("twitter_api_key");
    const savedCookies = localStorage.getItem("twitter_cookies");
    const savedCsrf = localStorage.getItem("twitter_csrf");
    if (savedApiKey) setTwitterApiKey(savedApiKey);
    if (savedCookies) setTwitterCookies(savedCookies);
    if (savedCsrf) setTwitterCsrfToken(savedCsrf);
  }, []);

  // Save auth when changed
  const saveAuth = () => {
    if (twitterApiKey) {
      localStorage.setItem("twitter_api_key", twitterApiKey);
    } else {
      localStorage.removeItem("twitter_api_key");
    }
    if (twitterCookies) {
      localStorage.setItem("twitter_cookies", twitterCookies);
    } else {
      localStorage.removeItem("twitter_cookies");
    }
    if (twitterCsrfToken) {
      localStorage.setItem("twitter_csrf", twitterCsrfToken);
    } else {
      localStorage.removeItem("twitter_csrf");
    }
  };

  // Scrape state
  const [selectedKols, setSelectedKols] = useState<string[]>(kols.map(k => k.id));
  const [scrapeResults, setScrapeResults] = useState<ScrapeResult[]>([]);
  const [scrapedTweets, setScrapedTweets] = useState<ScrapedTweet[]>([]);
  const [selectedTweets, setSelectedTweets] = useState<Set<string>>(new Set());
  const [showOnlyKeywordMatches, setShowOnlyKeywordMatches] = useState(false);

  // Manual import state
  const [manualUrls, setManualUrls] = useState("");
  const [manualResults, setManualResults] = useState<ScrapedTweet[]>([]);

  const handleScrape = async () => {
    setIsLoading(true);
    setScrapeResults([]);
    setScrapedTweets([]);
    setSelectedTweets(new Set());

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "all",
          kolIds: selectedKols.length === kols.length ? undefined : selectedKols,
          autoImport: false,
          twitterApiKey: twitterApiKey || undefined,
          twitterCookies: twitterCookies || undefined,
          twitterCsrfToken: twitterCsrfToken || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setScrapeResults(data.results || []);
        setScrapedTweets(data.tweets || []);

        // Pre-select tweets with keyword matches
        const keywordMatches = new Set<string>(
          (data.tweets || [])
            .filter((t: ScrapedTweet) => t.hasKeywordMatch)
            .map((t: ScrapedTweet) => t.id)
        );
        setSelectedTweets(keywordMatches);
      }
    } catch (error) {
      console.error("Scrape failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualScrape = async () => {
    const urls = manualUrls
      .split("\n")
      .map(u => u.trim())
      .filter(u => u.includes("twitter.com") || u.includes("x.com"));

    if (urls.length === 0) return;

    setIsLoading(true);
    setManualResults([]);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "single",
          tweetUrls: urls,
          autoImport: false,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setManualResults(data.tweets || []);
      }
    } catch (error) {
      console.error("Manual scrape failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportSelected = async () => {
    const tweetsToImport = scrapedTweets.filter(t => selectedTweets.has(t.id));
    if (tweetsToImport.length === 0) return;

    setIsLoading(true);

    try {
      // Import each tweet
      for (const tweet of tweetsToImport) {
        // Find KOL ID
        const kol = kols.find(
          k => k.handle.toLowerCase() === tweet.authorHandle.toLowerCase()
        );

        if (!kol) continue;

        await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignId,
            kolId: kol.id,
            type: "POST",
            content: tweet.content,
            tweetUrl: tweet.url,
            postedAt: tweet.postedAt,
            impressions: tweet.metrics.views || 0,
            likes: tweet.metrics.likes,
            retweets: tweet.metrics.retweets,
            replies: tweet.metrics.replies,
            quotes: tweet.metrics.quotes,
          }),
        });
      }

      // Remove imported tweets from list
      setScrapedTweets(prev => prev.filter(t => !selectedTweets.has(t.id)));
      setSelectedTweets(new Set());

      if (onImportComplete) {
        onImportComplete();
      }
    } catch (error) {
      console.error("Import failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelectAll = () => {
    const visibleTweets = showOnlyKeywordMatches
      ? scrapedTweets.filter(t => t.hasKeywordMatch)
      : scrapedTweets;

    if (selectedTweets.size === visibleTweets.length) {
      setSelectedTweets(new Set());
    } else {
      setSelectedTweets(new Set(visibleTweets.map(t => t.id)));
    }
  };

  const toggleTweetSelection = (tweetId: string) => {
    const newSelection = new Set(selectedTweets);
    if (newSelection.has(tweetId)) {
      newSelection.delete(tweetId);
    } else {
      newSelection.add(tweetId);
    }
    setSelectedTweets(newSelection);
  };

  const displayedTweets = showOnlyKeywordMatches
    ? scrapedTweets.filter(t => t.hasKeywordMatch)
    : scrapedTweets;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            X/Twitter Scraper
          </DialogTitle>
          <DialogDescription>
            Scrape posts from KOLs without API limits. Uses Nitter and other free methods.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="scrape">
              <Search className="h-4 w-4 mr-2" />
              Scrape KOLs
            </TabsTrigger>
            <TabsTrigger value="manual">
              <Import className="h-4 w-4 mr-2" />
              Manual Import
            </TabsTrigger>
          </TabsList>

          {/* Twitter Auth Settings */}
          <Collapsible open={showSettings} onOpenChange={setShowSettings} className="mt-3">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Twitter API {twitterApiKey ? "(Configured)" : "(Not Set)"}
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showSettings ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 p-3 border rounded-lg bg-muted/50">
              <div className="space-y-4">
                {/* API Key - Primary method */}
                <div className="space-y-2">
                  <Label htmlFor="apikey" className="text-sm font-medium">Twitter API Key (Recommended)</Label>
                  <Input
                    id="apikey"
                    type="password"
                    placeholder="twitterx_xxx..."
                    value={twitterApiKey}
                    onChange={(e) => setTwitterApiKey(e.target.value)}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Get an API key from RapidAPI Twitter endpoints for reliable scraping.
                  </p>
                </div>

                {/* Cookies - Fallback method */}
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-start text-xs text-muted-foreground">
                      <Cookie className="h-3 w-3 mr-2" />
                      Advanced: Browser Cookies (Fallback)
                      <ChevronDown className="h-3 w-3 ml-auto" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-2">
                    <div className="space-y-2">
                      <Label htmlFor="cookies" className="text-xs">Cookie Header Value</Label>
                      <Textarea
                        id="cookies"
                        placeholder='auth_token=xxx; ct0=xxx; ...'
                        value={twitterCookies}
                        onChange={(e) => setTwitterCookies(e.target.value)}
                        className="h-16 text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="csrf" className="text-xs">CSRF Token (ct0)</Label>
                      <Input
                        id="csrf"
                        placeholder="ct0 value from cookies"
                        value={twitterCsrfToken}
                        onChange={(e) => setTwitterCsrfToken(e.target.value)}
                        className="text-xs font-mono"
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <div className="flex gap-2">
                  <Button size="sm" variant="default" onClick={saveAuth}>
                    Save Settings
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setTwitterApiKey(""); setTwitterCookies(""); setTwitterCsrfToken(""); }}>
                    Clear All
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <TabsContent value="scrape" className="flex-1 overflow-hidden flex flex-col mt-4">
            {kols.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-2">No KOLs Assigned</h3>
                <p className="text-muted-foreground max-w-md">
                  Add KOLs to this campaign first before you can scrape their tweets.
                  Go to the KOLs tab and click &quot;Add KOL&quot; to assign influencers to this campaign.
                </p>
              </div>
            ) : scrapedTweets.length === 0 ? (
              <div className="space-y-4">
                {/* KOL Selection */}
                <div className="space-y-2">
                  <Label>Select KOLs to Scrape</Label>
                  <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto p-2 border rounded-lg">
                    {kols.map((kol) => (
                      <label
                        key={kol.id}
                        className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedKols.includes(kol.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedKols([...selectedKols, kol.id]);
                            } else {
                              setSelectedKols(selectedKols.filter(id => id !== kol.id));
                            }
                          }}
                        />
                        <span className="text-sm">
                          {kol.name} <span className="text-muted-foreground">@{kol.handle}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Keywords */}
                {keywords.length > 0 && (
                  <div className="space-y-2">
                    <Label>Tracking Keywords</Label>
                    <div className="flex flex-wrap gap-2">
                      {keywords.map((kw) => (
                        <Badge key={kw} variant="outline">
                          <Hash className="h-3 w-3 mr-1" />
                          {kw}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Tweets containing these keywords will be highlighted
                    </p>
                  </div>
                )}

                {/* Scrape Button */}
                <Button
                  onClick={handleScrape}
                  disabled={isLoading || selectedKols.length === 0}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Scraping...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Scrape {selectedKols.length} KOL{selectedKols.length !== 1 ? "s" : ""}
                    </>
                  )}
                </Button>

                {/* Results Summary */}
                {scrapeResults.length > 0 && (
                  <div className="space-y-2 p-3 rounded-lg bg-muted/50">
                    <p className="font-medium text-sm">Scrape Results</p>
                    {scrapeResults.map((result, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span>{result.kol}</span>
                        <span className="flex items-center gap-1">
                          {result.success ? (
                            <>
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              {result.count} tweets
                            </>
                          ) : (
                            <>
                              <XCircle className="h-4 w-4 text-red-600" />
                              {result.error || "Failed"}
                            </>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 overflow-hidden flex flex-col">
                {/* Toolbar */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selectedTweets.size === displayedTweets.length && displayedTweets.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                      Select All
                    </label>
                    {keywords.length > 0 && (
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={showOnlyKeywordMatches}
                          onCheckedChange={(checked) => setShowOnlyKeywordMatches(!!checked)}
                        />
                        <Hash className="h-3 w-3" />
                        Keyword matches only
                      </label>
                    )}
                    <span className="text-sm text-muted-foreground">
                      {selectedTweets.size} selected
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setScrapedTweets([]);
                        setScrapeResults([]);
                      }}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Reset
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleImportSelected}
                      disabled={isLoading || selectedTweets.size === 0}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Import className="h-4 w-4 mr-1" />
                      )}
                      Import {selectedTweets.size}
                    </Button>
                  </div>
                </div>

                {/* Tweet List */}
                <div className="flex-1 overflow-y-auto space-y-2">
                  {displayedTweets.map((tweet) => (
                    <div
                      key={tweet.id}
                      className={`p-3 rounded-lg border ${
                        selectedTweets.has(tweet.id)
                          ? "border-primary bg-primary/5"
                          : "border-border"
                      } ${tweet.hasKeywordMatch ? "ring-1 ring-green-500/30" : ""}`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedTweets.has(tweet.id)}
                          onCheckedChange={() => toggleTweetSelection(tweet.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{tweet.authorName || tweet.kolName}</span>
                            <span className="text-muted-foreground text-sm">@{tweet.authorHandle}</span>
                            <span className="text-muted-foreground text-xs">
                              {new Date(tweet.postedAt).toLocaleDateString()}
                            </span>
                            {tweet.hasKeywordMatch && (
                              <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                                <Hash className="h-3 w-3 mr-0.5" />
                                Match
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm line-clamp-2">{tweet.content}</p>
                          {tweet.matchedKeywords.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {tweet.matchedKeywords.map((kw) => (
                                <Badge key={kw} variant="outline" className="text-xs">
                                  {kw}
                                </Badge>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            {tweet.metrics.views > 0 && (
                              <span className="flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                {formatNumber(tweet.metrics.views)}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <ThumbsUp className="h-3 w-3" />
                              {formatNumber(tweet.metrics.likes)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Repeat2 className="h-3 w-3" />
                              {formatNumber(tweet.metrics.retweets)}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageCircle className="h-3 w-3" />
                              {formatNumber(tweet.metrics.replies)}
                            </span>
                            <a
                              href={tweet.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              View
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="manual" className="flex-1 overflow-hidden flex flex-col mt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tweet URLs</Label>
                <Textarea
                  value={manualUrls}
                  onChange={(e) => setManualUrls(e.target.value)}
                  placeholder="Paste tweet URLs, one per line...&#10;https://twitter.com/user/status/123456&#10;https://x.com/user/status/789012"
                  rows={6}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Enter Twitter/X URLs to fetch tweet data and metrics
                </p>
              </div>

              <Button
                onClick={handleManualScrape}
                disabled={isLoading || !manualUrls.trim()}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Fetching...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Fetch Tweet Data
                  </>
                )}
              </Button>

              {/* Manual Results */}
              {manualResults.length > 0 && (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  <p className="font-medium text-sm">Fetched Tweets</p>
                  {manualResults.map((tweet) => (
                    <div key={tweet.id} className="p-3 rounded-lg border">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">@{tweet.authorHandle}</span>
                        <span className="text-muted-foreground text-xs">
                          {new Date(tweet.postedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm line-clamp-2">{tweet.content}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <ThumbsUp className="h-3 w-3" />
                          {formatNumber(tweet.metrics.likes)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Repeat2 className="h-3 w-3" />
                          {formatNumber(tweet.metrics.retweets)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
