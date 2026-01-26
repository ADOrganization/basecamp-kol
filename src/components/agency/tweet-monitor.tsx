"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Bell,
  BellOff,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Clock,
  Hash,
  Play,
  Pause,
  Settings,
} from "lucide-react";
import { formatNumber } from "@/lib/utils";

interface KOL {
  id: string;
  name: string;
  handle: string;
}

interface MonitoredTweet {
  id: string;
  url: string;
  content: string;
  authorHandle: string;
  authorName: string;
  postedAt: string;
  matchedKeywords: string[];
  hasKeywordMatch?: boolean;
  kolName: string;
  metrics: {
    likes: number;
    retweets: number;
    views: number;
  };
  isNew?: boolean;
}

interface TweetMonitorProps {
  campaignId: string;
  campaignName: string;
  kols: KOL[];
  keywords: string[];
  twitterApiKey?: string;
  twitterCookies?: string;
  twitterCsrfToken?: string;
}

const REFRESH_INTERVALS = [
  { value: "1", label: "Every 1 minute" },
  { value: "5", label: "Every 5 minutes" },
  { value: "15", label: "Every 15 minutes" },
  { value: "30", label: "Every 30 minutes" },
  { value: "60", label: "Every hour" },
];

export function TweetMonitor({
  campaignId,
  campaignName,
  kols,
  keywords: initialKeywords,
  twitterApiKey,
  twitterCookies,
  twitterCsrfToken,
}: TweetMonitorProps) {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState("15");
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [nextCheck, setNextCheck] = useState<Date | null>(null);
  const [monitoredTweets, setMonitoredTweets] = useState<MonitoredTweet[]>([]);
  const [seenTweetIds, setSeenTweetIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [keywords, setKeywords] = useState<string[]>(initialKeywords);
  const [newKeyword, setNewKeyword] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Load saved state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem(`monitor_${campaignId}`);
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        setSeenTweetIds(new Set(state.seenTweetIds || []));
        setMonitoredTweets(state.tweets || []);
        setRefreshInterval(state.interval || "15");
        if (state.keywords) setKeywords(state.keywords);
      } catch {
        // Ignore parse errors
      }
    }
  }, [campaignId]);

  // Save state to localStorage
  const saveState = useCallback(() => {
    localStorage.setItem(`monitor_${campaignId}`, JSON.stringify({
      seenTweetIds: Array.from(seenTweetIds),
      tweets: monitoredTweets.slice(0, 100), // Keep last 100
      interval: refreshInterval,
      keywords,
    }));
  }, [campaignId, seenTweetIds, monitoredTweets, refreshInterval, keywords]);

  useEffect(() => {
    saveState();
  }, [saveState]);

  // Fetch tweets and check for keyword matches
  const checkForNewTweets = useCallback(async () => {
    if (kols.length === 0 || keywords.length === 0) {
      setError("Add KOLs and keywords to monitor");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "all",
          autoImport: false,
          twitterApiKey,
          twitterCookies,
          twitterCsrfToken,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch tweets");
      }

      const data = await response.json();
      const tweets: MonitoredTweet[] = (data.tweets || [])
        .filter((t: MonitoredTweet) => t.hasKeywordMatch || t.matchedKeywords?.length > 0)
        .map((t: MonitoredTweet) => ({
          ...t,
          isNew: !seenTweetIds.has(t.id),
        }));

      // Find new tweets
      const newTweets = tweets.filter(t => t.isNew);

      if (newTweets.length > 0) {
        // Play notification sound or show browser notification
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          new Notification(`${campaignName}: ${newTweets.length} new keyword matches!`, {
            body: newTweets.map(t => `@${t.authorHandle}: ${t.content.slice(0, 50)}...`).join("\n"),
            icon: "/favicon.ico",
          });
        }
      }

      // Update seen tweets
      const newSeenIds = new Set(seenTweetIds);
      tweets.forEach(t => newSeenIds.add(t.id));
      setSeenTweetIds(newSeenIds);

      // Merge with existing, keeping new ones at top
      setMonitoredTweets(prev => {
        const merged = [
          ...newTweets,
          ...prev.map(t => ({ ...t, isNew: false })),
        ].filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i);
        return merged.slice(0, 100);
      });

      setLastCheck(new Date());

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check posts");
    } finally {
      setIsLoading(false);
    }
  }, [campaignId, campaignName, kols, keywords, seenTweetIds, twitterApiKey, twitterCookies, twitterCsrfToken]);

  // Start/stop monitoring
  const toggleMonitoring = useCallback(() => {
    if (isMonitoring) {
      // Stop
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      setIsMonitoring(false);
      setNextCheck(null);
    } else {
      // Request notification permission
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }

      // Start
      setIsMonitoring(true);
      checkForNewTweets(); // Run immediately

      const intervalMs = parseInt(refreshInterval) * 60 * 1000;
      setNextCheck(new Date(Date.now() + intervalMs));

      intervalRef.current = setInterval(() => {
        checkForNewTweets();
        setNextCheck(new Date(Date.now() + intervalMs));
      }, intervalMs);

      // Countdown timer
      countdownRef.current = setInterval(() => {
        setNextCheck(prev => prev ? new Date(prev.getTime()) : null);
      }, 1000);
    }
  }, [isMonitoring, refreshInterval, checkForNewTweets]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // Add keyword
  const addKeyword = () => {
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
      setKeywords([...keywords, newKeyword.trim()]);
      setNewKeyword("");
    }
  };

  // Remove keyword
  const removeKeyword = (kw: string) => {
    setKeywords(keywords.filter(k => k !== kw));
  };

  // Format countdown
  const formatCountdown = () => {
    if (!nextCheck) return "";
    const diff = nextCheck.getTime() - Date.now();
    if (diff <= 0) return "Checking...";
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {isMonitoring ? (
                <Bell className="h-5 w-5 text-green-500 animate-pulse" />
              ) : (
                <BellOff className="h-5 w-5 text-muted-foreground" />
              )}
              Keyword Monitor
            </CardTitle>
            <CardDescription>
              Auto-detect when KOLs post about your keywords
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={checkForNewTweets}
              disabled={isLoading || kols.length === 0}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant={isMonitoring ? "destructive" : "default"}
              size="sm"
              onClick={toggleMonitoring}
              disabled={kols.length === 0 || keywords.length === 0}
            >
              {isMonitoring ? (
                <>
                  <Pause className="h-4 w-4 mr-1" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-1" />
                  Start
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Settings */}
        {showSettings && (
          <div className="p-3 border rounded-lg bg-muted/50 space-y-3">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label className="text-xs">Refresh Interval</Label>
                <Select value={refreshInterval} onValueChange={setRefreshInterval}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REFRESH_INTERVALS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Monitor Keywords</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  placeholder="Add keyword..."
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addKeyword()}
                  className="h-8 text-sm"
                />
                <Button size="sm" variant="outline" onClick={addKeyword}>
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {keywords.map(kw => (
                  <Badge
                    key={kw}
                    variant="secondary"
                    className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => removeKeyword(kw)}
                  >
                    <Hash className="h-3 w-3 mr-1" />
                    {kw}
                    <span className="ml-1 text-xs">×</span>
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Status Bar */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            {lastCheck && (
              <span className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Last: {lastCheck.toLocaleTimeString()}
              </span>
            )}
            {isMonitoring && nextCheck && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Next: {formatCountdown()}
              </span>
            )}
          </div>
          <span>
            {monitoredTweets.filter(t => t.isNew).length} new matches
          </span>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* No keywords warning */}
        {keywords.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <Hash className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Add keywords to monitor</p>
            <p className="text-xs">Click Settings to add keywords like $TOKEN, #launch, etc.</p>
          </div>
        )}

        {/* Tweet List */}
        {monitoredTweets.length > 0 && (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {monitoredTweets.map(tweet => (
              <div
                key={tweet.id}
                className={`p-3 rounded-lg border ${
                  tweet.isNew
                    ? "border-green-500 bg-green-500/10"
                    : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">
                        {tweet.authorName || tweet.kolName}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        @{tweet.authorHandle}
                      </span>
                      {tweet.isNew && (
                        <Badge variant="default" className="text-xs bg-green-600">
                          NEW
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm line-clamp-2">{tweet.content}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>{new Date(tweet.postedAt).toLocaleString()}</span>
                      {tweet.metrics && (
                        <>
                          <span>{formatNumber(tweet.metrics.likes)} likes</span>
                          <span>{formatNumber(tweet.metrics.retweets)} reposts</span>
                        </>
                      )}
                    </div>
                    {tweet.matchedKeywords?.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {tweet.matchedKeywords.map(kw => (
                          <Badge key={kw} variant="outline" className="text-xs">
                            <Hash className="h-3 w-3 mr-0.5" />
                            {kw}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <a
                    href={tweet.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {monitoredTweets.length === 0 && keywords.length > 0 && !isLoading && (
          <div className="text-center py-6 text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No matching posts yet</p>
            <p className="text-xs">Start monitoring or run a manual check</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
