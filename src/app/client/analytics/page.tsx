"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  ThumbsUp,
  MessageCircle,
  Repeat2,
  TrendingUp,
  Users,
  FileText,
  BarChart3
} from "lucide-react";
import { formatNumber, formatCurrency } from "@/lib/utils";
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
    kol: { id: string; name: string; twitterHandle: string };
  }[];
  posts: {
    id: string;
    status: string;
    impressions: number;
    likes: number;
    retweets: number;
    replies: number;
    postedAt: string | null;
  }[];
}

const COLORS = ["#0d9488", "#6366f1", "#f59e0b", "#ef4444", "#8b5cf6"];

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
    { name: "Published", value: filteredCampaigns.flatMap(c => c.posts).filter(p => p.status === "PUBLISHED").length, color: "#0d9488" },
    { name: "Approved", value: filteredCampaigns.flatMap(c => c.posts).filter(p => p.status === "APPROVED").length, color: "#6366f1" },
    { name: "Pending", value: filteredCampaigns.flatMap(c => c.posts).filter(p => p.status === "PENDING_APPROVAL").length, color: "#f59e0b" },
    { name: "Rejected", value: filteredCampaigns.flatMap(c => c.posts).filter(p => p.status === "REJECTED").length, color: "#ef4444" },
  ].filter(item => item.value > 0);

  // Top performing KOLs
  const kolPerformance = filteredCampaigns.flatMap(c =>
    (c.campaignKols || []).filter(ck => ck.kol).map(ck => {
      const kolPosts = (c.posts || []).filter(p =>
        (c.campaignKols || []).some(k => k.kol?.id === ck.kol.id)
      );
      return {
        ...ck.kol,
        impressions: kolPosts.reduce((sum, p) => sum + (p.impressions || 0), 0),
        engagement: kolPosts.reduce((sum, p) => sum + (p.likes || 0) + (p.retweets || 0) + (p.replies || 0), 0),
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Track performance across your campaigns
          </p>
        </div>
        <select
          value={selectedCampaign}
          onChange={(e) => setSelectedCampaign(e.target.value)}
          className="px-4 py-2 border rounded-lg bg-white"
        >
          <option value="all">All Campaigns</option>
          {campaigns.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-teal-500 to-teal-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-teal-100 text-sm">Total Impressions</p>
                <p className="text-3xl font-bold mt-1">{formatNumber(totals.impressions)}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Eye className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-indigo-100 text-sm">Total Engagement</p>
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

        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-sm">Engagement Rate</p>
                <p className="text-3xl font-bold mt-1">{engagementRate}%</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <TrendingUp className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-violet-500 to-violet-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-violet-100 text-sm">Total Posts</p>
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
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-rose-100 flex items-center justify-center">
                <ThumbsUp className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(totals.likes)}</p>
                <p className="text-sm text-muted-foreground">Likes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-teal-100 flex items-center justify-center">
                <Repeat2 className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(totals.retweets)}</p>
                <p className="text-sm text-muted-foreground">Retweets</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(totals.replies)}</p>
                <p className="text-sm text-muted-foreground">Replies</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-indigo-600" />
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
            <CardTitle>Top Performing KOLs</CardTitle>
            <CardDescription>KOLs with highest engagement</CardDescription>
          </CardHeader>
          <CardContent>
            {kolPerformance.length > 0 ? (
              <div className="space-y-4">
                {kolPerformance.map((kol, index) => (
                  <div key={kol.id} className="flex items-center gap-4">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                      index === 0 ? "bg-amber-500" :
                      index === 1 ? "bg-slate-400" :
                      index === 2 ? "bg-amber-700" : "bg-slate-300"
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{kol.name}</p>
                      <p className="text-sm text-muted-foreground">@{kol.twitterHandle}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatNumber(kol.engagement)}</p>
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
