"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Eye,
  ThumbsUp,
  MessageCircle,
  Repeat2,
  TrendingUp,
  Users,
  FileText,
  BarChart3,
  Filter,
  Trophy,
} from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
    postedAt: string | null;
  }[];
}

export default function ClientAnalyticsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");

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

  const filteredCampaigns = selectedCampaign === "all"
    ? campaigns
    : campaigns.filter(c => c.id === selectedCampaign);

  // Calculate totals
  const totals = filteredCampaigns.reduce(
    (acc, campaign) => {
      const campaignStats = campaign.posts.reduce(
        (postAcc, post) => ({
          impressions: postAcc.impressions + post.impressions,
          likes: postAcc.likes + post.likes,
          retweets: postAcc.retweets + post.retweets,
          replies: postAcc.replies + post.replies,
        }),
        { impressions: 0, likes: 0, retweets: 0, replies: 0 }
      );
      return {
        impressions: acc.impressions + campaignStats.impressions,
        likes: acc.likes + campaignStats.likes,
        retweets: acc.retweets + campaignStats.retweets,
        replies: acc.replies + campaignStats.replies,
        posts: acc.posts + campaign.posts.length,
        kols: acc.kols + campaign.campaignKols.length,
        budget: acc.budget + campaign.totalBudget,
      };
    },
    { impressions: 0, likes: 0, retweets: 0, replies: 0, posts: 0, kols: 0, budget: 0 }
  );

  const engagementRate = totals.impressions > 0
    ? ((totals.likes + totals.retweets + totals.replies) / totals.impressions * 100).toFixed(2)
    : "0";

  // Generate engagement trend data (last 7 days from actual posts)
  const trendData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dayPosts = filteredCampaigns.flatMap(c =>
      c.posts.filter(p => {
        if (!p.postedAt) return false;
        const postDate = new Date(p.postedAt);
        return postDate.toDateString() === date.toDateString();
      })
    );
    return {
      date: date.toLocaleDateString("en-US", { weekday: "short" }),
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
    { name: "Posted", value: filteredCampaigns.flatMap(c => c.posts).filter(p => p.status === "POSTED").length, color: "#0d9488" },
    { name: "Approved", value: filteredCampaigns.flatMap(c => c.posts).filter(p => p.status === "APPROVED").length, color: "#6366f1" },
    { name: "Pending", value: filteredCampaigns.flatMap(c => c.posts).filter(p => p.status === "PENDING_APPROVAL").length, color: "#f59e0b" },
    { name: "Rejected", value: filteredCampaigns.flatMap(c => c.posts).filter(p => p.status === "REJECTED").length, color: "#ef4444" },
  ].filter(item => item.value > 0);

  // Top performing KOLs
  const kolPerformance = filteredCampaigns.flatMap(c =>
    (c.campaignKols || []).filter(ck => ck.kol).map(ck => {
      const kolPosts = (c.posts || []).filter(post => post.kolId === ck.kol.id);
      return {
        ...ck.kol,
        impressions: kolPosts.reduce((sum, post) => sum + (post.impressions || 0), 0),
        engagement: kolPosts.reduce((sum, post) => sum + (post.likes || 0) + (post.retweets || 0) + (post.replies || 0), 0),
      };
    })
  ).sort((a, b) => b.engagement - a.engagement).slice(0, 5);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-8 text-white">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.5))]" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -mr-32 -mt-32" />
        <div className="relative flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-indigo-200 mb-2">
              <BarChart3 className="h-5 w-5" />
              <span className="text-sm font-medium">Performance Analytics</span>
            </div>
            <h1 className="text-3xl font-bold mb-2">Analytics Dashboard</h1>
            <p className="text-indigo-100 max-w-xl">
              Track performance metrics and insights across all your influencer campaigns.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <div className="text-center px-6 py-3 bg-white/10 rounded-xl backdrop-blur-sm">
              <p className="text-3xl font-bold">{formatNumber(totals.impressions)}</p>
              <p className="text-sm text-indigo-200">Total Reach</p>
            </div>
          </div>
        </div>
      </div>

      {/* Campaign Filter */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Filter by campaign:</span>
        <select
          value={selectedCampaign}
          onChange={(e) => setSelectedCampaign(e.target.value)}
          className="px-4 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          <option value="all">All Campaigns</option>
          {campaigns.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-0">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10" />
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-indigo-100 text-sm">Total Impressions</p>
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
                <p className="text-violet-100 text-sm">Total Engagement</p>
                <p className="text-3xl font-bold mt-1">
                  {formatNumber(totals.likes + totals.retweets + totals.replies)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <ThumbsUp className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-teal-500 to-teal-600 text-white border-0">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10" />
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-teal-100 text-sm">Engagement Rate</p>
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
                <p className="text-amber-100 text-sm">Total Posts</p>
                <p className="text-3xl font-bold mt-1">{totals.posts}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <FileText className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Engagement Breakdown */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-14 h-14 bg-rose-500/10 rounded-full -mr-7 -mt-7" />
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-rose-100 flex items-center justify-center">
                <ThumbsUp className="h-6 w-6 text-rose-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(totals.likes)}</p>
                <p className="text-sm text-muted-foreground">Likes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-14 h-14 bg-teal-500/10 rounded-full -mr-7 -mt-7" />
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-teal-100 flex items-center justify-center">
                <Repeat2 className="h-6 w-6 text-teal-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(totals.retweets)}</p>
                <p className="text-sm text-muted-foreground">Retweets</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-14 h-14 bg-blue-500/10 rounded-full -mr-7 -mt-7" />
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <MessageCircle className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(totals.replies)}</p>
                <p className="text-sm text-muted-foreground">Replies</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-14 h-14 bg-indigo-500/10 rounded-full -mr-7 -mt-7" />
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                <Users className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totals.kols}</p>
                <p className="text-sm text-muted-foreground">KOLs Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Engagement Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Engagement Trend</CardTitle>
            <CardDescription>Impressions and engagement over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorImpressions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorEngagement" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "none",
                      borderRadius: "8px",
                      color: "#fff"
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="impressions"
                    stroke="#0d9488"
                    fillOpacity={1}
                    fill="url(#colorImpressions)"
                    name="Impressions"
                  />
                  <Area
                    type="monotone"
                    dataKey="engagement"
                    stroke="#6366f1"
                    fillOpacity={1}
                    fill="url(#colorEngagement)"
                    name="Engagement"
                  />
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
                        backgroundColor: "#1e293b",
                        border: "none",
                        borderRadius: "8px",
                        color: "#fff"
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" stroke="#94a3b8" fontSize={12} />
                    <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={12} width={100} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1e293b",
                        border: "none",
                        borderRadius: "8px",
                        color: "#fff"
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

        {/* Top KOLs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Top Performing KOLs
            </CardTitle>
            <CardDescription>KOLs with highest engagement</CardDescription>
          </CardHeader>
          <CardContent>
            {kolPerformance.length > 0 ? (
              <div className="space-y-4">
                {kolPerformance.map((kol, index) => (
                  <div key={kol.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    {/* Rank Badge */}
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                      index === 0 ? "bg-amber-500" :
                      index === 1 ? "bg-slate-400" :
                      index === 2 ? "bg-amber-700" : "bg-slate-300"
                    }`}>
                      {index + 1}
                    </div>

                    {/* Profile Picture */}
                    <Avatar className="h-10 w-10 border-2 border-muted">
                      {kol.avatarUrl ? (
                        <AvatarImage src={kol.avatarUrl} alt={kol.name} />
                      ) : null}
                      <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
                        {kol.name?.charAt(0) || "K"}
                      </AvatarFallback>
                    </Avatar>

                    {/* Name and Handle */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{kol.name}</p>
                      <p className="text-sm text-muted-foreground truncate">@{kol.twitterHandle}</p>
                    </div>

                    {/* Engagement Stats */}
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-indigo-600">{formatNumber(kol.engagement)}</p>
                      <p className="text-xs text-muted-foreground">engagement</p>
                    </div>
                  </div>
                ))}
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
