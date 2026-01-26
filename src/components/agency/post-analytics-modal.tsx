"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KPITile } from "@/components/analytics/kpi-tile";
import { MetricsBarChart } from "@/components/charts/metrics-bar-chart";
import { Loader2, RefreshCw, ExternalLink, BarChart3 } from "lucide-react";
import Link from "next/link";

interface PostAnalyticsModalProps {
  postId: string;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => Promise<void>;
}

type Period = "7d" | "14d" | "30d" | "90d" | "365d";
type Metric = "impressions" | "likes" | "retweets" | "replies" | "engagementRate";

const PERIOD_LABELS: Record<Period, string> = {
  "7d": "7D",
  "14d": "2W",
  "30d": "4W",
  "90d": "3M",
  "365d": "1Y",
};

const METRIC_OPTIONS: { value: Metric; label: string }[] = [
  { value: "impressions", label: "Impressions" },
  { value: "likes", label: "Likes" },
  { value: "retweets", label: "Reposts" },
  { value: "replies", label: "Replies" },
  { value: "engagementRate", label: "Engagement Rate" },
];

interface AnalyticsData {
  post: {
    id: string;
    content: string | null;
    tweetUrl: string | null;
    postedAt: string | null;
    kol: { name: string; twitterHandle: string };
    campaign: { name: string };
  };
  period: string;
  currentKPIs: {
    impressions: number;
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
    bookmarks: number;
    engagementRate: number;
  };
  deltas: {
    impressions: number;
    likes: number;
    retweets: number;
    replies: number;
    engagementRate: number;
  } | null;
  timeSeries: Array<{
    date: string;
    impressions: number;
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
    bookmarks: number;
    engagementRate: number;
  }>;
  snapshotCount: number;
}

export function PostAnalyticsModal({ postId, isOpen, onClose, onRefresh }: PostAnalyticsModalProps) {
  const [period, setPeriod] = useState<Period>("7d");
  const [primaryMetric, setPrimaryMetric] = useState<Metric>("impressions");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && postId) {
      fetchAnalytics();
    }
  }, [isOpen, postId, period]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/posts/${postId}/analytics?period=${period}`);
      if (!response.ok) {
        throw new Error("Failed to fetch analytics");
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError("Failed to load analytics data");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const response = await fetch(`/api/posts/${postId}/refresh-metrics`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to refresh metrics");
      }
      // Refetch analytics after refresh
      await fetchAnalytics();
      // Notify parent to refresh their data too
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh metrics");
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Post Analytics
            </DialogTitle>
            <div className="flex items-center gap-2">
              {/* Period selector */}
              <div className="flex bg-muted rounded-lg p-1">
                {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                  <Button
                    key={p}
                    variant={period === p ? "default" : "ghost"}
                    size="sm"
                    className="px-3 h-7"
                    onClick={() => setPeriod(p)}
                  >
                    {PERIOD_LABELS[p]}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-rose-500 mb-4">{error}</p>
            <Button onClick={fetchAnalytics}>Try Again</Button>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Post info */}
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{data.post.kol.name}</p>
                <p className="text-sm text-muted-foreground">
                  @{data.post.kol.twitterHandle} &middot; {data.post.campaign.name}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                >
                  {isRefreshing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1" />
                  )}
                  Refresh
                </Button>
                {data.post.tweetUrl && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={data.post.tweetUrl} target="_blank">
                      <ExternalLink className="h-4 w-4 mr-1" />
                      View Post
                    </Link>
                  </Button>
                )}
              </div>
            </div>

            {/* KPI tiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPITile
                label="Impressions"
                value={data.currentKPIs.impressions}
                delta={data.deltas?.impressions}
                format="compact"
              />
              <KPITile
                label="Likes"
                value={data.currentKPIs.likes}
                delta={data.deltas?.likes}
                format="compact"
              />
              <KPITile
                label="Retweets"
                value={data.currentKPIs.retweets}
                delta={data.deltas?.retweets}
                format="compact"
              />
              <KPITile
                label="Replies"
                value={data.currentKPIs.replies}
                delta={data.deltas?.replies}
                format="compact"
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPITile
                label="Quotes"
                value={data.currentKPIs.quotes}
                format="compact"
              />
              <KPITile
                label="Bookmarks"
                value={data.currentKPIs.bookmarks}
                format="compact"
              />
              <KPITile
                label="Engagement Rate"
                value={data.currentKPIs.engagementRate}
                delta={data.deltas?.engagementRate}
                format="percentage"
              />
            </div>

            {/* Chart */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Metrics Over Time</h3>
                <Select value={primaryMetric} onValueChange={(v) => setPrimaryMetric(v as Metric)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METRIC_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {data.timeSeries.length > 0 ? (
                <MetricsBarChart
                  data={data.timeSeries}
                  primaryMetric={primaryMetric}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mb-4" />
                  <p>No historical data yet</p>
                  <p className="text-sm">Data will be collected over time</p>
                </div>
              )}
            </div>

            {/* Data note */}
            <p className="text-xs text-muted-foreground text-center">
              {data.snapshotCount} data points collected &middot; Data refreshes daily
            </p>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
