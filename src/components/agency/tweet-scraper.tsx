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
  X,
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
  alreadyImported?: boolean;
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

  // Apify auth state
  const [orgHasApiKey, setOrgHasApiKey] = useState(false);

  // Load saved auth on mount - check org settings first
  useEffect(() => {
    const loadAuth = async () => {
      // Check organization settings for Apify key
      try {
        const response = await fetch("/api/organization/twitter");
        if (response.ok) {
          const data = await response.json();
          if (data.hasApifyKey) {
            setOrgHasApiKey(true);
            console.log("[TweetScraper] Org has Apify API key configured");
          }
        }
      } catch (error) {
        console.log("[TweetScraper] Failed to check org settings:", error);
      }
    };
    loadAuth();
  }, []);

  // Scrape state
  const [selectedKols, setSelectedKols] = useState<string[]>(kols.map(k => k.id));
  const [scrapeResults, setScrapeResults] = useState<ScrapeResult[]>([]);
  const [scrapedTweets, setScrapedTweets] = useState<ScrapedTweet[]>([]);
  const [selectedTweets, setSelectedTweets] = useState<Set<string>>(new Set());
  const [showOnlyKeywordMatches, setShowOnlyKeywordMatches] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{ apifyConfigured: boolean } | null>(null);

  // Keyword filter state - filter BEFORE scraping
  const [filterByKeywords, setFilterByKeywords] = useState(true);
  const [activeKeywords, setActiveKeywords] = useState<string[]>(keywords);
  const [newKeyword, setNewKeyword] = useState("");

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
          filterKeywords: filterByKeywords ? activeKeywords : undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("[TweetScraper] Scrape response debug:", data.debug);
        setScrapeResults(data.results || []);
        setScrapedTweets(data.tweets || []);
        setDebugInfo(data.debug || null);

        // Pre-select tweets with keyword matches (excluding already imported)
        const keywordMatches = new Set<string>(
          (data.tweets || [])
            .filter((t: ScrapedTweet) => t.hasKeywordMatch && !t.alreadyImported)
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
    // Filter out already imported tweets from selection
    const selectableTweets = displayedTweets.filter(t => !t.alreadyImported);

    if (selectedTweets.size === selectableTweets.length && selectableTweets.length > 0) {
      setSelectedTweets(new Set());
    } else {
      setSelectedTweets(new Set(selectableTweets.map(t => t.id)));
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
            X Post Scraper
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

          {/* Apify Status */}
          <div className="mt-3 p-3 border rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              {orgHasApiKey ? (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-700 dark:text-green-400">
                    Apify API key configured
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm text-amber-700 dark:text-amber-400">
                    No Apify key - go to Settings → Integrations to add your key
                  </span>
                </div>
              )}
            </div>
          </div>

          <TabsContent value="scrape" className="flex-1 overflow-hidden flex flex-col mt-4">
            {kols.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-2">No KOLs Assigned</h3>
                <p className="text-muted-foreground max-w-md">
                  Add KOLs to this campaign first before you can scrape their posts.
                  Go to the KOLs tab and click &quot;Add KOL&quot; to assign influencers to this campaign.
                </p>
              </div>
            ) : scrapedTweets.length === 0 ? (
              <div className="space-y-4">
                {/* Workflow Steps */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                  <div className="flex items-center gap-1">
                    <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                    <span>Select KOLs</span>
                  </div>
                  <span className="text-muted-foreground">→</span>
                  <div className="flex items-center gap-1">
                    <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                    <span>Set Keywords</span>
                  </div>
                  <span className="text-muted-foreground">→</span>
                  <div className="flex items-center gap-1">
                    <span className="w-5 h-5 rounded-full bg-muted-foreground/30 text-muted-foreground flex items-center justify-center text-xs font-bold">3</span>
                    <span>Scrape</span>
                  </div>
                  <span className="text-muted-foreground">→</span>
                  <div className="flex items-center gap-1">
                    <span className="w-5 h-5 rounded-full bg-muted-foreground/30 text-muted-foreground flex items-center justify-center text-xs font-bold">4</span>
                    <span>Select & Import</span>
                  </div>
                </div>

                {/* KOL Selection */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                    Select KOLs to Scrape
                  </Label>
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

                {/* Keyword Filter Section */}
                <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                      Keyword Filter
                    </Label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={filterByKeywords}
                        onCheckedChange={(checked) => setFilterByKeywords(!!checked)}
                      />
                      <span className="text-sm font-medium">
                        {filterByKeywords ? "Enabled" : "Disabled"}
                      </span>
                    </label>
                  </div>

                  {filterByKeywords && (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Only scrape posts containing these keywords:
                      </p>

                      {/* Add keyword input */}
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add keyword (e.g., $TOKEN, #launch)..."
                          value={newKeyword}
                          onChange={(e) => setNewKeyword(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newKeyword.trim()) {
                              if (!activeKeywords.includes(newKeyword.trim())) {
                                setActiveKeywords([...activeKeywords, newKeyword.trim()]);
                              }
                              setNewKeyword("");
                            }
                          }}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            if (newKeyword.trim() && !activeKeywords.includes(newKeyword.trim())) {
                              setActiveKeywords([...activeKeywords, newKeyword.trim()]);
                              setNewKeyword("");
                            }
                          }}
                        >
                          Add
                        </Button>
                      </div>

                      {/* Active keywords */}
                      <div className="flex flex-wrap gap-2">
                        {activeKeywords.length === 0 ? (
                          <p className="text-sm text-muted-foreground italic">
                            No keywords set. Add keywords above or disable filter to scrape all posts.
                          </p>
                        ) : (
                          activeKeywords.map((kw) => (
                            <Badge
                              key={kw}
                              variant="secondary"
                              className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                              onClick={() => setActiveKeywords(activeKeywords.filter(k => k !== kw))}
                            >
                              <Hash className="h-3 w-3 mr-1" />
                              {kw}
                              <X className="h-3 w-3 ml-1" />
                            </Badge>
                          ))
                        )}
                      </div>
                    </>
                  )}

                  {!filterByKeywords && (
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      Filter disabled - will scrape ALL posts from selected KOLs
                    </p>
                  )}
                </div>

                {/* Scrape Button - Step 3 */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                    Scrape Posts
                  </Label>
                  <Button
                    onClick={handleScrape}
                    disabled={isLoading || selectedKols.length === 0 || (filterByKeywords && activeKeywords.length === 0)}
                    className="w-full"
                    size="lg"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Scraping posts from {selectedKols.length} KOL{selectedKols.length !== 1 ? "s" : ""}...
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-2" />
                        Scrape {selectedKols.length} KOL{selectedKols.length !== 1 ? "s" : ""}
                        {filterByKeywords && activeKeywords.length > 0 && ` (${activeKeywords.length} keywords)`}
                      </>
                    )}
                  </Button>
                  {filterByKeywords && activeKeywords.length === 0 && (
                    <p className="text-sm text-destructive">Add at least one keyword or disable the filter to scrape.</p>
                  )}
                </div>

                {/* Results Summary */}
                {scrapeResults.length > 0 && (
                  <div className="space-y-2 p-3 rounded-lg bg-muted/50">
                    <p className="font-medium text-sm">Scrape Results</p>
                    {debugInfo && (
                      <div className="text-xs text-muted-foreground border-b pb-2 mb-2">
                        Apify: {debugInfo.apifyConfigured ? (
                          <span className="text-green-600">Configured</span>
                        ) : (
                          <span className="text-amber-600">Not configured - add key in Settings → Integrations</span>
                        )}
                      </div>
                    )}
                    {scrapeResults.map((result, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span>{result.kol}</span>
                        <span className="flex items-center gap-1">
                          {result.success ? (
                            <>
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              {result.count} posts
                            </>
                          ) : (
                            <>
                              <XCircle className="h-4 w-4 text-red-600" />
                              <span className="max-w-[200px] truncate">{result.error || "Failed"}</span>
                            </>
                          )}
                        </span>
                      </div>
                    ))}
                    {scrapeResults.some(r => !r.success) && debugInfo?.apifyConfigured && (
                      <p className="text-xs text-muted-foreground mt-2">
                        If the search returned no results, try different keywords or check that the KOL handle is correct.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 overflow-hidden flex flex-col">
                {/* Step 4 Header */}
                <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">4</span>
                    <span className="font-semibold">Select & Import Posts</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Found <strong>{displayedTweets.length}</strong> posts. Select the ones you want to track, then click <strong>Import</strong> to add them to your campaign&apos;s Posts.
                  </p>
                </div>

                {/* Toolbar */}
                <div className="flex items-center justify-between mb-3 p-2 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={selectedTweets.size === displayedTweets.length && displayedTweets.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                      Select All
                    </label>
                    {keywords.length > 0 && (
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={showOnlyKeywordMatches}
                          onCheckedChange={(checked) => setShowOnlyKeywordMatches(!!checked)}
                        />
                        <Hash className="h-3 w-3" />
                        Keyword matches only
                      </label>
                    )}
                    <Badge variant="secondary">
                      {selectedTweets.size} of {displayedTweets.length} selected
                    </Badge>
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
                      Start Over
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
                      Import {selectedTweets.size} to Campaign
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
                          disabled={tweet.alreadyImported}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{tweet.authorName || tweet.kolName}</span>
                            <span className="text-muted-foreground text-sm">@{tweet.authorHandle}</span>
                            <span className="text-muted-foreground text-xs">
                              {new Date(tweet.postedAt).toLocaleDateString()}
                            </span>
                            {tweet.alreadyImported && (
                              <Badge variant="secondary" className="text-xs">
                                Already Imported
                              </Badge>
                            )}
                            {tweet.hasKeywordMatch && !tweet.alreadyImported && (
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
                <Label>Post URLs</Label>
                <Textarea
                  value={manualUrls}
                  onChange={(e) => setManualUrls(e.target.value)}
                  placeholder="Paste post URLs, one per line...&#10;https://twitter.com/user/status/123456&#10;https://x.com/user/status/789012"
                  rows={6}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Enter X post URLs to fetch post data and metrics
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
                    Fetch Post Data
                  </>
                )}
              </Button>

              {/* Manual Results */}
              {manualResults.length > 0 && (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  <p className="font-medium text-sm">Fetched Posts</p>
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
