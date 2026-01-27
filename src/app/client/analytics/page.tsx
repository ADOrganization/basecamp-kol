"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Trophy,
  Quote,
  Bookmark,
  Download,
  Calendar,
  Minus,
} from "lucide-react";
import { formatNumber, cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface Campaign {
  id: string;
  name: string;
  status: string;
  totalBudget: number;
  campaignKols: {
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
  const [kolLeaderboardTab, setKolLeaderboardTab] = useState("impressions");

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

  // Calculate week-over-week changes (mock data for now - in real app would compare periods)
  const wowChanges = {
    impressions: Math.floor(Math.random() * 30) - 10,
    engagement: Math.floor(Math.random() * 25) - 8,
    rate: Math.floor(Math.random() * 15) - 5,
    posts: Math.floor(Math.random() * 20) - 5,
  };

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-3 w-3" />;
    if (change < 0) return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  const getTrendColor = (change: number) => {
    if (change > 0) return "text-emerald-500";
    if (change < 0) return "text-rose-500";
    return "text-muted-foreground";
  };

  // Generate engagement trend data
  const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : dateRange === "90d" ? 90 : 30;
  const trendData = Array.from({ length: Math.min(days, 14) }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (Math.min(days, 14) - 1 - i));
    const dayPosts = filteredCampaigns.flatMap(c =>
      c.posts.filter(p => {
        if (!p.postedAt) return false;
        const postDate = new Date(p.postedAt);
        return postDate.toDateString() === date.toDateString();
      })
    );
    return {
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      impressions: dayPosts.reduce((sum, p) => sum + p.impressions, 0),
      engagement: dayPosts.reduce((sum, p) => sum + p.likes + p.retweets + p.replies, 0),
    };
  });

  // Campaign performance data
  const campaignPerformance = campaigns.map(campaign => ({
    name: campaign.name.length > 15 ? campaign.name.substring(0, 15) + "..." : campaign.name,
    impressions: campaign.posts.reduce((sum, p) => sum + p.impressions, 0),
    engagement: campaign.posts.reduce((sum, p) => sum + p.likes + p.retweets + p.replies, 0),
  }));

  // Post status distribution
  const statusData = [
    { name: "Posted", value: filteredCampaigns.flatMap(c => c.posts).filter(p => p.status === "POSTED" || p.status === "VERIFIED").length, color: "#10b981" },
    { name: "Approved", value: filteredCampaigns.flatMap(c => c.posts).filter(p => p.status === "APPROVED").length, color: "#6366f1" },
    { name: "Pending", value: filteredCampaigns.flatMap(c => c.posts).filter(p => p.status === "PENDING_APPROVAL").length, color: "#f59e0b" },
    { name: "Rejected", value: filteredCampaigns.flatMap(c => c.posts).filter(p => p.status === "REJECTED").length, color: "#ef4444" },
  ].filter(item => item.value > 0);

  // KOL performance aggregated
  const kolMap = new Map<string, {
    id: string;
    name: string;
    twitterHandle: string;
    avatarUrl: string | null;
    impressions: number;
    likes: number;
    engagement: number;
    posts: number;
  }>();

  filteredCampaigns.forEach(c => {
    (c.campaignKols || []).filter(ck => ck.kol).forEach(ck => {
      const kolPosts = (c.posts || []).filter(post => post.kolId === ck.kol.id);
      const existing = kolMap.get(ck.kol.id);
      const newImpressions = kolPosts.reduce((sum, post) => sum + (post.impressions || 0), 0);
      const newLikes = kolPosts.reduce((sum, post) => sum + (post.likes || 0), 0);
      const newEngagement = kolPosts.reduce(
        (sum, post) => sum + (post.likes || 0) + (post.retweets || 0) + (post.replies || 0),
        0
      );

      if (existing) {
        existing.impressions += newImpressions;
        existing.likes += newLikes;
        existing.engagement += newEngagement;
        existing.posts += kolPosts.length;
      } else {
        kolMap.set(ck.kol.id, {
          ...ck.kol,
          impressions: newImpressions,
          likes: newLikes,
          engagement: newEngagement,
          posts: kolPosts.length,
        });
      }
    });
  });

  const kolPerformance = Array.from(kolMap.values());
  const sortedKols = [...kolPerformance].sort((a, b) => {
    switch (kolLeaderboardTab) {
      case "impressions":
        return b.impressions - a.impressions;
      case "engagement":
        return b.engagement - a.engagement;
      case "posts":
        return b.posts - a.posts;
      default:
        return b.impressions - a.impressions;
    }
  }).slice(0, 10);

  const handleExport = () => {
    const csvContent = [
      ["Metric", "Value"],
      ["Total Impressions", totals.impressions],
      ["Total Engagement", totalEngagement],
      ["Likes", totals.likes],
      ["Retweets", totals.retweets],
      ["Replies", totals.replies],
      ["Quotes", totals.quotes],
      ["Bookmarks", totals.bookmarks],
      ["Engagement Rate", `${engagementRate}%`],
      ["Total Posts", totals.posts],
      ["Total KOLs", totals.kols],
    ]
      .map(row => row.join(","))
      .join("\n");

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
        {/* Filters Skeleton */}
        <div className="flex gap-4">
          <div className="h-10 w-48 bg-muted rounded animate-pulse" />
          <div className="h-10 w-64 bg-muted rounded animate-pulse" />
        </div>

        {/* Cards Skeleton */}
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

        {/* Engagement Cards Skeleton */}
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

        {/* Charts Skeleton */}
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
          {/* Date Range Picker */}
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

          {/* Campaign Filter */}
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

        {/* Export Button */}
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

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Engagement Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Engagement Trend</CardTitle>
            <CardDescription>
              Impressions and engagement over the{" "}
              {dateRange === "all" ? "last 14 days" : `last ${dateRange.replace("d", " days")}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorImp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorEng" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Area type="monotone" dataKey="impressions" stroke="#0ea5e9" strokeWidth={2} fill="url(#colorImp)" name="Impressions" />
                  <Area type="monotone" dataKey="engagement" stroke="#f43f5e" strokeWidth={2} fill="url(#colorEng)" name="Engagement" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Post Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Post Status Distribution</CardTitle>
            <CardDescription>Breakdown of post statuses across campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No post data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Campaign Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Campaign Performance</CardTitle>
            <CardDescription>Compare engagement across campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {campaignPerformance.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={campaignPerformance} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="engagement" fill="#6366f1" name="Engagement" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No campaign data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Enhanced KOL Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              KOL Leaderboard
            </CardTitle>
            <CardDescription>Top 10 performing KOLs</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={kolLeaderboardTab} onValueChange={setKolLeaderboardTab}>
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="impressions" className="text-xs">
                  <Eye className="h-3 w-3 mr-1" />
                  Reach
                </TabsTrigger>
                <TabsTrigger value="engagement" className="text-xs">
                  <Heart className="h-3 w-3 mr-1" />
                  Engagement
                </TabsTrigger>
                <TabsTrigger value="posts" className="text-xs">
                  <FileText className="h-3 w-3 mr-1" />
                  Posts
                </TabsTrigger>
              </TabsList>

              <div className="space-y-2 max-h-[280px] overflow-y-auto">
                {sortedKols.length > 0 ? (
                  sortedKols.map((kol, index) => (
                    <div
                      key={kol.id}
                      className={cn(
                        "flex items-center gap-3 p-2.5 rounded-lg transition-colors",
                        index === 0 ? "bg-amber-50 dark:bg-amber-950/20" :
                        index === 1 ? "bg-gray-50 dark:bg-gray-800/20" :
                        index === 2 ? "bg-orange-50 dark:bg-orange-950/20" :
                        "hover:bg-muted/50"
                      )}
                    >
                      <Badge
                        className={cn(
                          "h-6 w-6 flex items-center justify-center p-0 text-xs",
                          index === 0 ? "bg-amber-500" :
                          index === 1 ? "bg-gray-400" :
                          index === 2 ? "bg-orange-600" : "bg-muted text-muted-foreground"
                        )}
                      >
                        {index + 1}
                      </Badge>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={kol.avatarUrl || undefined} />
                        <AvatarFallback className="text-xs">
                          {kol.name?.charAt(0) || "K"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{kol.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          @{kol.twitterHandle}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">
                          {kolLeaderboardTab === "impressions" && formatNumber(kol.impressions)}
                          {kolLeaderboardTab === "engagement" && formatNumber(kol.engagement)}
                          {kolLeaderboardTab === "posts" && kol.posts}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {kolLeaderboardTab === "impressions" && "reach"}
                          {kolLeaderboardTab === "engagement" && "engagement"}
                          {kolLeaderboardTab === "posts" && "posts"}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    No KOL data available
                  </div>
                )}
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
