"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Eye,
  Heart,
  MessageCircle,
  Repeat2,
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  Filter,
  Quote,
  Bookmark,
  Download,
  Calendar,
  Minus,
  ExternalLink,
  CheckCircle2,
  BarChart3,
  Zap,
} from "lucide-react";
import { formatNumber, cn } from "@/lib/utils";

interface Campaign {
  id: string;
  name: string;
  status: string;
  totalBudget: number;
  campaignKols: {
    requiredPosts: number;
    requiredThreads: number;
    requiredRetweets: number;
    requiredSpaces: number;
    kol: { id: string; name: string; twitterHandle: string; avatarUrl: string | null };
  }[];
  posts: {
    id: string;
    status: string;
    kolId: string;
    impressions: number;
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
    bookmarks: number;
    content: string | null;
    tweetUrl: string | null;
    postedAt: string | null;
    createdAt: string;
  }[];
}

type DateRange = "7d" | "30d" | "90d" | "all";

export default function ClientAnalyticsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange>("30d");

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const response = await fetch("/api/campaigns");
      if (response.ok) {
        const data = await response.json();
        setCampaigns(data);
      }
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter by date range
  const getDateFilter = () => {
    const now = new Date();
    switch (dateRange) {
      case "7d":
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case "30d":
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case "90d":
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      default:
        return null;
    }
  };

  const dateFilter = getDateFilter();

  const filteredCampaigns = (selectedCampaign === "all"
    ? campaigns
    : campaigns.filter(c => c.id === selectedCampaign)
  ).map(campaign => ({
    ...campaign,
    posts: dateFilter
      ? campaign.posts.filter(p => {
          const postDate = new Date(p.postedAt || p.createdAt);
          return postDate >= dateFilter;
        })
      : campaign.posts,
  }));

  // Calculate totals
  const totals = filteredCampaigns.reduce(
    (acc, campaign) => {
      const campaignStats = campaign.posts.reduce(
        (postAcc, post) => ({
          impressions: postAcc.impressions + post.impressions,
          likes: postAcc.likes + post.likes,
          retweets: postAcc.retweets + post.retweets,
          replies: postAcc.replies + post.replies,
          quotes: postAcc.quotes + (post.quotes || 0),
          bookmarks: postAcc.bookmarks + (post.bookmarks || 0),
        }),
        { impressions: 0, likes: 0, retweets: 0, replies: 0, quotes: 0, bookmarks: 0 }
      );
      return {
        impressions: acc.impressions + campaignStats.impressions,
        likes: acc.likes + campaignStats.likes,
        retweets: acc.retweets + campaignStats.retweets,
        replies: acc.replies + campaignStats.replies,
        quotes: acc.quotes + campaignStats.quotes,
        bookmarks: acc.bookmarks + campaignStats.bookmarks,
        posts: acc.posts + campaign.posts.length,
        kols: acc.kols + campaign.campaignKols.length,
      };
    },
    { impressions: 0, likes: 0, retweets: 0, replies: 0, quotes: 0, bookmarks: 0, posts: 0, kols: 0 }
  );

  const totalEngagement = totals.likes + totals.retweets + totals.replies + totals.quotes;
  const engagementRate = totals.impressions > 0
    ? (totalEngagement / totals.impressions * 100).toFixed(2)
    : "0";

  // Calculate REAL period-over-period changes
  const calculatePeriodChanges = () => {
    if (!dateFilter) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

      const currentPeriodPosts = campaigns.flatMap(c => c.posts).filter(p => {
        const d = new Date(p.postedAt || p.createdAt);
        return d >= thirtyDaysAgo;
      });

      const previousPeriodPosts = campaigns.flatMap(c => c.posts).filter(p => {
        const d = new Date(p.postedAt || p.createdAt);
        return d >= sixtyDaysAgo && d < thirtyDaysAgo;
      });

      return { currentPeriodPosts, previousPeriodPosts };
    }

    const periodDuration = Date.now() - dateFilter.getTime();
    const previousPeriodStart = new Date(dateFilter.getTime() - periodDuration);

    const currentPeriodPosts = campaigns.flatMap(c => c.posts).filter(p => {
      const d = new Date(p.postedAt || p.createdAt);
      return d >= dateFilter;
    });

    const previousPeriodPosts = campaigns.flatMap(c => c.posts).filter(p => {
      const d = new Date(p.postedAt || p.createdAt);
      return d >= previousPeriodStart && d < dateFilter;
    });

    return { currentPeriodPosts, previousPeriodPosts };
  };

  const { currentPeriodPosts, previousPeriodPosts } = calculatePeriodChanges();

  const currentImpressions = currentPeriodPosts.reduce((sum, p) => sum + p.impressions, 0);
  const prevImpressions = previousPeriodPosts.reduce((sum, p) => sum + p.impressions, 0);
  const currentEngagement = currentPeriodPosts.reduce((sum, p) => sum + p.likes + p.retweets + p.replies, 0);
  const prevEngagement = previousPeriodPosts.reduce((sum, p) => sum + p.likes + p.retweets + p.replies, 0);
  const currentEngRate = currentImpressions > 0 ? (currentEngagement / currentImpressions) * 100 : 0;
  const prevEngRate = prevImpressions > 0 ? (prevEngagement / prevImpressions) * 100 : 0;

  const calcChange = (current: number, previous: number): number => {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return Math.round(((current - previous) / previous) * 100);
  };

  const wowChanges = {
    impressions: calcChange(currentImpressions, prevImpressions),
    engagement: calcChange(currentEngagement, prevEngagement),
    rate: Math.round((currentEngRate - prevEngRate) * 10) / 10,
    posts: calcChange(currentPeriodPosts.length, previousPeriodPosts.length),
  };

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-3 w-3" />;
    if (change < 0) return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  // --- New section data ---

  // A. Top Performing Posts (sorted by total engagement)
  const allPosts = filteredCampaigns.flatMap(c =>
    c.posts.map(p => {
      const kol = c.campaignKols.find(ck => ck.kol.id === p.kolId)?.kol;
      return { ...p, kol, campaignName: c.name };
    })
  );

  const topPosts = [...allPosts]
    .sort((a, b) => {
      const engA = a.likes + a.retweets + a.replies + (a.quotes || 0);
      const engB = b.likes + b.retweets + b.replies + (b.quotes || 0);
      return engB - engA;
    })
    .slice(0, 5);

  // B. Deliverables Progress
  const deliverables = filteredCampaigns.flatMap(c =>
    c.campaignKols.map(ck => {
      const deliveredPosts = c.posts.filter(p => p.kolId === ck.kol.id).length;
      return {
        kol: ck.kol,
        requiredPosts: ck.requiredPosts || 0,
        deliveredPosts,
        campaignName: c.name,
      };
    })
  );

  const totalRequired = deliverables.reduce((sum, d) => sum + d.requiredPosts, 0);
  const totalDelivered = deliverables.reduce((sum, d) => sum + d.deliveredPosts, 0);
  const deliveryPercent = totalRequired > 0 ? Math.min(100, Math.round((totalDelivered / totalRequired) * 100)) : 0;

  // C. Per-Post Averages
  const postCount = totals.posts || 0;
  const avgImpressions = postCount > 0 ? Math.round(totals.impressions / postCount) : 0;
  const avgEngagement = postCount > 0 ? Math.round(totalEngagement / postCount) : 0;
  const avgLikes = postCount > 0 ? Math.round(totals.likes / postCount) : 0;
  const bestPostImpressions = allPosts.length > 0
    ? Math.max(...allPosts.map(p => p.impressions))
    : 0;

  // D. KOL Performance Table (aggregated per-KOL with per-post averages)
  const kolMap = new Map<string, {
    id: string;
    name: string;
    twitterHandle: string;
    avatarUrl: string | null;
    impressions: number;
    engagement: number;
    posts: number;
  }>();

  filteredCampaigns.forEach(c => {
    (c.campaignKols || []).filter(ck => ck.kol).forEach(ck => {
      const kolPosts = (c.posts || []).filter(post => post.kolId === ck.kol.id);
      const existing = kolMap.get(ck.kol.id);
      const newImpressions = kolPosts.reduce((sum, post) => sum + (post.impressions || 0), 0);
      const newEngagement = kolPosts.reduce(
        (sum, post) => sum + (post.likes || 0) + (post.retweets || 0) + (post.replies || 0) + (post.quotes || 0),
        0
      );

      if (existing) {
        existing.impressions += newImpressions;
        existing.engagement += newEngagement;
        existing.posts += kolPosts.length;
      } else {
        kolMap.set(ck.kol.id, {
          ...ck.kol,
          impressions: newImpressions,
          engagement: newEngagement,
          posts: kolPosts.length,
        });
      }
    });
  });

  const kolPerformance = Array.from(kolMap.values())
    .sort((a, b) => {
      const avgA = a.posts > 0 ? a.engagement / a.posts : 0;
      const avgB = b.posts > 0 ? b.engagement / b.posts : 0;
      return avgB - avgA;
    });

  // CSV Export with new metrics
  const handleExport = () => {
    const rows: string[][] = [
      ["Metric", "Value"],
      ["Total Impressions", String(totals.impressions)],
      ["Total Engagement", String(totalEngagement)],
      ["Engagement Rate", `${engagementRate}%`],
      ["Total Posts", String(totals.posts)],
      ["Total KOLs", String(totals.kols)],
      ["Likes", String(totals.likes)],
      ["Retweets", String(totals.retweets)],
      ["Replies", String(totals.replies)],
      ["Quotes", String(totals.quotes)],
      ["Bookmarks", String(totals.bookmarks)],
      ["Avg Impressions/Post", String(avgImpressions)],
      ["Avg Engagement/Post", String(avgEngagement)],
      ["Avg Likes/Post", String(avgLikes)],
      ["Best Post Impressions", String(bestPostImpressions)],
      ["Deliverables Required", String(totalRequired)],
      ["Deliverables Delivered", String(totalDelivered)],
      ["Delivery Rate", `${deliveryPercent}%`],
      [],
      ["KOL", "Posts", "Avg Impressions/Post", "Avg Engagement/Post", "Engagement Rate"],
      ...kolPerformance.map(k => [
        `@${k.twitterHandle}`,
        String(k.posts),
        String(k.posts > 0 ? Math.round(k.impressions / k.posts) : 0),
        String(k.posts > 0 ? Math.round(k.engagement / k.posts) : 0),
        k.impressions > 0 ? `${((k.engagement / k.impressions) * 100).toFixed(2)}%` : "0%",
      ]),
      [],
      ["Top Posts - KOL", "Impressions", "Engagement", "Content Preview"],
      ...topPosts.map(p => [
        `@${p.kol?.twitterHandle || "unknown"}`,
        String(p.impressions),
        String(p.likes + p.retweets + p.replies + (p.quotes || 0)),
        `"${(p.content || "").slice(0, 80).replace(/"/g, '""')}"`,
      ]),
    ];

    const csvContent = rows.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex gap-4">
          <div className="h-10 w-48 bg-muted rounded animate-pulse" />
          <div className="h-10 w-64 bg-muted rounded animate-pulse" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="relative overflow-hidden">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="h-4 w-24 bg-muted rounded animate-pulse mb-2" />
                    <div className="h-8 w-20 bg-muted rounded animate-pulse" />
                  </div>
                  <div className="h-12 w-12 bg-muted rounded-xl animate-pulse" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="h-10 w-10 bg-muted rounded-lg animate-pulse mx-auto mb-3" />
                <div className="h-6 w-16 bg-muted rounded animate-pulse mx-auto mb-1" />
                <div className="h-3 w-12 bg-muted rounded animate-pulse mx-auto" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-5 w-40 bg-muted rounded animate-pulse" />
                <div className="h-4 w-60 bg-muted rounded animate-pulse mt-1" />
              </CardHeader>
              <CardContent>
                <div className="h-[300px] bg-muted/50 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div className="flex border rounded-lg overflow-hidden">
              {(["7d", "30d", "90d", "all"] as DateRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium transition-colors",
                    dateRange === range
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  )}
                >
                  {range === "all" ? "All Time" : range.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value)}
              className="px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="all">All Campaigns</option>
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Key Metrics with WoW */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-0">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10" />
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-indigo-100 text-sm">Total Impressions</p>
                  <span className={cn(
                    "flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full",
                    wowChanges.impressions > 0 ? "bg-emerald-400/20 text-emerald-200" :
                    wowChanges.impressions < 0 ? "bg-rose-400/20 text-rose-200" : "bg-white/10"
                  )}>
                    {getTrendIcon(wowChanges.impressions)}
                    {wowChanges.impressions > 0 ? "+" : ""}{wowChanges.impressions}%
                  </span>
                </div>
                <p className="text-3xl font-bold mt-1">{formatNumber(totals.impressions)}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Eye className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-violet-500 to-violet-600 text-white border-0">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10" />
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-violet-100 text-sm">Total Engagement</p>
                  <span className={cn(
                    "flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full",
                    wowChanges.engagement > 0 ? "bg-emerald-400/20 text-emerald-200" :
                    wowChanges.engagement < 0 ? "bg-rose-400/20 text-rose-200" : "bg-white/10"
                  )}>
                    {getTrendIcon(wowChanges.engagement)}
                    {wowChanges.engagement > 0 ? "+" : ""}{wowChanges.engagement}%
                  </span>
                </div>
                <p className="text-3xl font-bold mt-1">{formatNumber(totalEngagement)}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Heart className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-teal-500 to-teal-600 text-white border-0">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10" />
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-teal-100 text-sm">Engagement Rate</p>
                  <span className={cn(
                    "flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full",
                    wowChanges.rate > 0 ? "bg-emerald-400/20 text-emerald-200" :
                    wowChanges.rate < 0 ? "bg-rose-400/20 text-rose-200" : "bg-white/10"
                  )}>
                    {getTrendIcon(wowChanges.rate)}
                    {wowChanges.rate > 0 ? "+" : ""}{wowChanges.rate}%
                  </span>
                </div>
                <p className="text-3xl font-bold mt-1">{engagementRate}%</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <TrendingUp className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-amber-500 to-amber-600 text-white border-0">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10" />
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-amber-100 text-sm">Total Posts</p>
                  <span className={cn(
                    "flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full",
                    wowChanges.posts > 0 ? "bg-emerald-400/20 text-emerald-200" :
                    wowChanges.posts < 0 ? "bg-rose-400/20 text-rose-200" : "bg-white/10"
                  )}>
                    {getTrendIcon(wowChanges.posts)}
                    {wowChanges.posts > 0 ? "+" : ""}{wowChanges.posts}%
                  </span>
                </div>
                <p className="text-3xl font-bold mt-1">{totals.posts}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <FileText className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Full Engagement Breakdown */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card className="relative overflow-hidden">
          <CardContent className="pt-6 text-center">
            <div className="h-10 w-10 rounded-lg bg-rose-100 dark:bg-rose-950 flex items-center justify-center mx-auto mb-2">
              <Heart className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            </div>
            <p className="text-xl font-bold">{formatNumber(totals.likes)}</p>
            <p className="text-xs text-muted-foreground">Likes</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardContent className="pt-6 text-center">
            <div className="h-10 w-10 rounded-lg bg-teal-100 dark:bg-teal-950 flex items-center justify-center mx-auto mb-2">
              <Repeat2 className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            </div>
            <p className="text-xl font-bold">{formatNumber(totals.retweets)}</p>
            <p className="text-xs text-muted-foreground">Retweets</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardContent className="pt-6 text-center">
            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center mx-auto mb-2">
              <MessageCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-xl font-bold">{formatNumber(totals.replies)}</p>
            <p className="text-xs text-muted-foreground">Replies</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardContent className="pt-6 text-center">
            <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-950 flex items-center justify-center mx-auto mb-2">
              <Quote className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <p className="text-xl font-bold">{formatNumber(totals.quotes)}</p>
            <p className="text-xs text-muted-foreground">Quotes</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardContent className="pt-6 text-center">
            <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-950 flex items-center justify-center mx-auto mb-2">
              <Bookmark className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-xl font-bold">{formatNumber(totals.bookmarks)}</p>
            <p className="text-xs text-muted-foreground">Bookmarks</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardContent className="pt-6 text-center">
            <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center mx-auto mb-2">
              <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <p className="text-xl font-bold">{totals.kols}</p>
            <p className="text-xs text-muted-foreground">KOLs Active</p>
          </CardContent>
        </Card>
      </div>

      {/* New Sections */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* A. Top Performing Posts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Top Performing Posts
            </CardTitle>
            <CardDescription>Highest engagement posts across your campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            {topPosts.length > 0 ? (
              <div className="space-y-3">
                {topPosts.map((post, index) => {
                  const eng = post.likes + post.retweets + post.replies + (post.quotes || 0);
                  const rate = post.impressions > 0 ? ((eng / post.impressions) * 100).toFixed(1) : "0";
                  return (
                    <div
                      key={post.id}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border",
                        index === 0 && "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20"
                      )}
                    >
                      <div className="flex-shrink-0 flex items-center gap-2">
                        <span className="text-sm font-bold text-muted-foreground w-5">#{index + 1}</span>
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={post.kol?.avatarUrl || undefined} />
                          <AvatarFallback className="text-xs">
                            {post.kol?.name?.charAt(0) || "K"}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="font-medium text-sm truncate">{post.kol?.name || "Unknown"}</span>
                          <span className="text-xs text-muted-foreground">@{post.kol?.twitterHandle || "unknown"}</span>
                        </div>
                        {post.content && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                            {post.content.slice(0, 120)}{post.content.length > 120 ? "..." : ""}
                          </p>
                        )}
                        <div className="flex items-center gap-3 text-xs">
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3 text-muted-foreground" />
                            {formatNumber(post.impressions)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Heart className="h-3 w-3 text-muted-foreground" />
                            {formatNumber(eng)}
                          </span>
                          <span className="text-muted-foreground">{rate}% rate</span>
                          <span className="text-muted-foreground">
                            {new Date(post.postedAt || post.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                          {post.tweetUrl && (
                            <a
                              href={post.tweetUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline flex items-center gap-0.5"
                            >
                              <ExternalLink className="h-3 w-3" />
                              View
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                No post data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* B. Deliverables Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Deliverables Progress
            </CardTitle>
            <CardDescription>Post delivery status across all KOLs</CardDescription>
          </CardHeader>
          <CardContent>
            {totalRequired > 0 ? (
              <div className="space-y-4">
                {/* Overall progress */}
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Overall Delivery</span>
                    <span className="text-sm font-bold">{totalDelivered} / {totalRequired} posts</span>
                  </div>
                  <Progress value={deliveryPercent} className="h-3" />
                  <p className="text-xs text-muted-foreground mt-1.5">{deliveryPercent}% complete</p>
                </div>

                {/* Per-KOL progress */}
                <div className="space-y-3 max-h-[240px] overflow-y-auto">
                  {deliverables
                    .filter(d => d.requiredPosts > 0)
                    .sort((a, b) => {
                      const pctA = a.requiredPosts > 0 ? a.deliveredPosts / a.requiredPosts : 0;
                      const pctB = b.requiredPosts > 0 ? b.deliveredPosts / b.requiredPosts : 0;
                      return pctB - pctA;
                    })
                    .map((d, i) => {
                      const pct = d.requiredPosts > 0 ? Math.min(100, Math.round((d.deliveredPosts / d.requiredPosts) * 100)) : 0;
                      return (
                        <div key={`${d.kol.id}-${d.campaignName}-${i}`} className="flex items-center gap-3">
                          <Avatar className="h-7 w-7 flex-shrink-0">
                            <AvatarImage src={d.kol.avatarUrl || undefined} />
                            <AvatarFallback className="text-xs">{d.kol.name?.charAt(0) || "K"}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium truncate">@{d.kol.twitterHandle}</span>
                              <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                                {d.deliveredPosts}/{d.requiredPosts}
                              </span>
                            </div>
                            <Progress value={pct} className="h-1.5" />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                No deliverable requirements set
              </div>
            )}
          </CardContent>
        </Card>

        {/* C. Per-Post Averages */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-500" />
              Per-Post Averages
            </CardTitle>
            <CardDescription>Average performance metrics per post</CardDescription>
          </CardHeader>
          <CardContent>
            {postCount > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900">
                  <div className="flex items-center gap-2 mb-1">
                    <Eye className="h-4 w-4 text-indigo-500" />
                    <span className="text-xs text-muted-foreground">Avg Impressions</span>
                  </div>
                  <p className="text-2xl font-bold">{formatNumber(avgImpressions)}</p>
                  <p className="text-xs text-muted-foreground mt-1">per post</p>
                </div>

                <div className="p-4 rounded-lg bg-violet-50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900">
                  <div className="flex items-center gap-2 mb-1">
                    <Heart className="h-4 w-4 text-violet-500" />
                    <span className="text-xs text-muted-foreground">Avg Engagement</span>
                  </div>
                  <p className="text-2xl font-bold">{formatNumber(avgEngagement)}</p>
                  <p className="text-xs text-muted-foreground mt-1">per post</p>
                </div>

                <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900">
                  <div className="flex items-center gap-2 mb-1">
                    <Heart className="h-4 w-4 text-rose-500" />
                    <span className="text-xs text-muted-foreground">Avg Likes</span>
                  </div>
                  <p className="text-2xl font-bold">{formatNumber(avgLikes)}</p>
                  <p className="text-xs text-muted-foreground mt-1">per post</p>
                </div>

                <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-amber-500" />
                    <span className="text-xs text-muted-foreground">Best Post</span>
                  </div>
                  <p className="text-2xl font-bold">{formatNumber(bestPostImpressions)}</p>
                  <p className="text-xs text-muted-foreground mt-1">impressions</p>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                No post data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* D. KOL Performance Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-violet-500" />
              KOL Performance
            </CardTitle>
            <CardDescription>Sorted by avg engagement per post (best ROI first)</CardDescription>
          </CardHeader>
          <CardContent>
            {kolPerformance.length > 0 ? (
              <div className="space-y-0">
                {/* Table header */}
                <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                  <div className="col-span-4">KOL</div>
                  <div className="col-span-2 text-right">Posts</div>
                  <div className="col-span-2 text-right">Avg Imp</div>
                  <div className="col-span-2 text-right">Avg Eng</div>
                  <div className="col-span-2 text-right">Rate</div>
                </div>

                <div className="max-h-[280px] overflow-y-auto">
                  {kolPerformance.map((kol) => {
                    const avgImp = kol.posts > 0 ? Math.round(kol.impressions / kol.posts) : 0;
                    const avgEng = kol.posts > 0 ? Math.round(kol.engagement / kol.posts) : 0;
                    const kolRate = kol.impressions > 0 ? ((kol.engagement / kol.impressions) * 100).toFixed(1) : "0";

                    return (
                      <div
                        key={kol.id}
                        className="grid grid-cols-12 gap-2 px-3 py-2.5 items-center hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0"
                      >
                        <div className="col-span-4 flex items-center gap-2 min-w-0">
                          <Avatar className="h-7 w-7 flex-shrink-0">
                            <AvatarImage src={kol.avatarUrl || undefined} />
                            <AvatarFallback className="text-xs">{kol.name?.charAt(0) || "K"}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{kol.name}</p>
                            <p className="text-xs text-muted-foreground truncate">@{kol.twitterHandle}</p>
                          </div>
                        </div>
                        <div className="col-span-2 text-right text-sm font-medium">{kol.posts}</div>
                        <div className="col-span-2 text-right text-sm">{formatNumber(avgImp)}</div>
                        <div className="col-span-2 text-right text-sm font-medium">{formatNumber(avgEng)}</div>
                        <div className="col-span-2 text-right text-sm text-muted-foreground">{kolRate}%</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                No KOL data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
