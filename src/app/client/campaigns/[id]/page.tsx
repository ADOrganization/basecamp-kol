"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  formatNumber,
  getStatusColor,
  getTierColor,
} from "@/lib/utils";
import {
  ArrowLeft,
  Users,
  FileText,
  BarChart3,
  Eye,
  ThumbsUp,
  MessageCircle,
  Repeat2,
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface CampaignDetails {
  id: string;
  name: string;
  description: string | null;
  status: string;
  totalBudget: number;
  spentBudget: number;
  startDate: string | null;
  endDate: string | null;
  kpis: {
    impressions?: number;
    engagement?: number;
    clicks?: number;
    followers?: number;
  } | null;
  campaignKols: {
    id: string;
    status: string;
    assignedBudget: number;
    kol: {
      id: string;
      name: string;
      twitterHandle: string;
      tier: string;
      followersCount: number;
      avgEngagementRate: number;
    };
  }[];
  posts: {
    id: string;
    type: string;
    status: string;
    content: string | null;
    tweetUrl: string | null;
    impressions: number;
    likes: number;
    retweets: number;
    replies: number;
    postedAt: string | null;
    kol: {
      id: string;
      name: string;
      twitterHandle: string;
    };
  }[];
}

const COLORS = ["#0d9488", "#6366f1", "#f59e0b", "#ef4444"];

export default function ClientCampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [campaign, setCampaign] = useState<CampaignDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCampaign();
  }, [id]);

  const fetchCampaign = async () => {
    try {
      const response = await fetch(`/api/campaigns/${id}`);
      if (response.ok) {
        const data = await response.json();
        setCampaign(data);
      } else if (response.status === 404) {
        router.push("/client/campaigns");
      }
    } catch (error) {
      console.error("Failed to fetch campaign:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (!campaign) return null;

  const totalImpressions = campaign.posts.reduce((sum, p) => sum + p.impressions, 0);
  const totalLikes = campaign.posts.reduce((sum, p) => sum + p.likes, 0);
  const totalRetweets = campaign.posts.reduce((sum, p) => sum + p.retweets, 0);
  const totalReplies = campaign.posts.reduce((sum, p) => sum + p.replies, 0);
  const totalEngagement = totalLikes + totalRetweets + totalReplies;
  const engagementRate = totalImpressions > 0 ? ((totalEngagement / totalImpressions) * 100).toFixed(2) : "0";

  const pendingPosts = campaign.posts.filter(p => p.status === "PENDING_APPROVAL").length;
  const approvedPosts = campaign.posts.filter(p => p.status === "APPROVED" || p.status === "POSTED").length;
  const rejectedPosts = campaign.posts.filter(p => p.status === "REJECTED").length;

  // KPI Progress
  const kpiProgress = campaign.kpis ? {
    impressions: campaign.kpis.impressions ? Math.min((totalImpressions / campaign.kpis.impressions) * 100, 100) : 0,
    engagement: campaign.kpis.engagement ? Math.min((parseFloat(engagementRate) / campaign.kpis.engagement) * 100, 100) : 0,
  } : null;

  // Post status data for pie chart
  const postStatusData = [
    { name: "Published", value: campaign.posts.filter(p => p.status === "POSTED").length, color: "#0d9488" },
    { name: "Approved", value: campaign.posts.filter(p => p.status === "APPROVED").length, color: "#6366f1" },
    { name: "Pending", value: pendingPosts, color: "#f59e0b" },
    { name: "Rejected", value: rejectedPosts, color: "#ef4444" },
  ].filter(d => d.value > 0);

  // Simulated engagement trend (last 7 days)
  const engagementTrend = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return {
      date: date.toLocaleDateString("en-US", { weekday: "short" }),
      impressions: Math.floor(totalImpressions / 7 * (0.8 + Math.random() * 0.4)),
      engagement: Math.floor(totalEngagement / 7 * (0.8 + Math.random() * 0.4)),
    };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{campaign.name}</h1>
              <Badge className={getStatusColor(campaign.status)} variant="secondary">
                {campaign.status.replace("_", " ")}
              </Badge>
            </div>
            {campaign.description && (
              <p className="text-muted-foreground mt-1">{campaign.description}</p>
            )}
          </div>
        </div>
        {pendingPosts > 0 && (
          <Button asChild className="bg-amber-600 hover:bg-amber-700">
            <Link href="/client/review">
              <Clock className="h-4 w-4 mr-2" />
              {pendingPosts} Posts Pending Review
            </Link>
          </Button>
        )}
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-teal-500 to-teal-600 text-white border-0">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-teal-100 text-sm">Total Impressions</p>
                <p className="text-3xl font-bold mt-1">{formatNumber(totalImpressions)}</p>
              </div>
              <Eye className="h-8 w-8 text-teal-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-0">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-indigo-100 text-sm">Total Engagement</p>
                <p className="text-3xl font-bold mt-1">{formatNumber(totalEngagement)}</p>
              </div>
              <ThumbsUp className="h-8 w-8 text-indigo-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-violet-500 to-violet-600 text-white border-0">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-violet-100 text-sm">Engagement Rate</p>
                <p className="text-3xl font-bold mt-1">{engagementRate}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-violet-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white border-0">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-sm">Active KOLs</p>
                <p className="text-3xl font-bold mt-1">{campaign.campaignKols.length}</p>
              </div>
              <Users className="h-8 w-8 text-amber-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Engagement Breakdown */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-rose-100 flex items-center justify-center">
                <ThumbsUp className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(totalLikes)}</p>
                <p className="text-sm text-muted-foreground">Likes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-teal-100 flex items-center justify-center">
                <Repeat2 className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(totalRetweets)}</p>
                <p className="text-sm text-muted-foreground">Retweets</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(totalReplies)}</p>
                <p className="text-sm text-muted-foreground">Replies</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                <FileText className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{campaign.posts.length}</p>
                <p className="text-sm text-muted-foreground">Total Posts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="kols" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            KOLs ({campaign.campaignKols.length})
          </TabsTrigger>
          <TabsTrigger value="posts" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Posts ({campaign.posts.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Engagement Trend Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Engagement Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={engagementTrend}>
                      <defs>
                        <linearGradient id="colorImp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorEng" x1="0" y1="0" x2="0" y2="1">
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
                      <Area type="monotone" dataKey="impressions" stroke="#0d9488" fill="url(#colorImp)" name="Impressions" />
                      <Area type="monotone" dataKey="engagement" stroke="#6366f1" fill="url(#colorEng)" name="Engagement" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Post Status Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Post Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  {postStatusData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={postStatusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={4}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {postStatusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No posts yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* KPI Progress */}
          {kpiProgress && (campaign.kpis?.impressions || campaign.kpis?.engagement) && (
            <Card>
              <CardHeader>
                <CardTitle>KPI Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {campaign.kpis?.impressions && (
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Impressions Target</span>
                      <span className="text-sm text-muted-foreground">
                        {formatNumber(totalImpressions)} / {formatNumber(campaign.kpis.impressions)}
                      </span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-500 rounded-full transition-all"
                        style={{ width: `${kpiProgress.impressions}%` }}
                      />
                    </div>
                  </div>
                )}
                {campaign.kpis?.engagement && (
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Engagement Rate Target</span>
                      <span className="text-sm text-muted-foreground">
                        {engagementRate}% / {campaign.kpis.engagement}%
                      </span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all"
                        style={{ width: `${kpiProgress.engagement}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

        </TabsContent>

        <TabsContent value="kols" className="mt-6">
          <Card>
            <CardContent className="p-0">
              {campaign.campaignKols.length === 0 ? (
                <p className="p-6 text-muted-foreground">No KOLs assigned to this campaign.</p>
              ) : (
                <div className="divide-y">
                  {campaign.campaignKols.map((ck) => {
                    const kolPosts = campaign.posts.filter(p => p.kol.id === ck.kol.id);
                    const kolImpressions = kolPosts.reduce((sum, p) => sum + p.impressions, 0);
                    const kolEngagement = kolPosts.reduce((sum, p) => sum + p.likes + p.retweets + p.replies, 0);

                    return (
                      <div key={ck.id} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-12 w-12">
                            <AvatarFallback className="bg-teal-100 text-teal-700">
                              {ck.kol.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold">{ck.kol.name}</p>
                            <p className="text-sm text-muted-foreground">@{ck.kol.twitterHandle}</p>
                          </div>
                          <Badge className={getTierColor(ck.kol.tier)} variant="secondary">
                            {ck.kol.tier}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-8 text-sm">
                          <div className="text-center">
                            <p className="font-semibold">{formatNumber(ck.kol.followersCount)}</p>
                            <p className="text-muted-foreground">Followers</p>
                          </div>
                          <div className="text-center">
                            <p className="font-semibold">{kolPosts.length}</p>
                            <p className="text-muted-foreground">Posts</p>
                          </div>
                          <div className="text-center">
                            <p className="font-semibold">{formatNumber(kolImpressions)}</p>
                            <p className="text-muted-foreground">Impressions</p>
                          </div>
                          <div className="text-center">
                            <p className="font-semibold">{formatNumber(kolEngagement)}</p>
                            <p className="text-muted-foreground">Engagement</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="posts" className="mt-6">
          <div className="space-y-4">
            {campaign.posts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No posts in this campaign yet.</p>
                </CardContent>
              </Card>
            ) : (
              campaign.posts.map((post) => (
                <Card key={post.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <Avatar>
                          <AvatarFallback className="bg-teal-100 text-teal-700">
                            {post.kol.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{post.kol.name}</span>
                            <span className="text-sm text-muted-foreground">@{post.kol.twitterHandle}</span>
                            <Badge variant="outline">{post.type}</Badge>
                            {post.status === "PENDING_APPROVAL" && (
                              <Badge className="bg-amber-100 text-amber-700">
                                <Clock className="h-3 w-3 mr-1" />
                                Pending Review
                              </Badge>
                            )}
                            {post.status === "APPROVED" && (
                              <Badge className="bg-teal-100 text-teal-700">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Approved
                              </Badge>
                            )}
                            {post.status === "POSTED" && (
                              <Badge className="bg-blue-100 text-blue-700">
                                <ExternalLink className="h-3 w-3 mr-1" />
                                Published
                              </Badge>
                            )}
                            {post.status === "REJECTED" && (
                              <Badge className="bg-rose-100 text-rose-700">
                                <XCircle className="h-3 w-3 mr-1" />
                                Rejected
                              </Badge>
                            )}
                          </div>
                          {post.content && (
                            <p className="text-sm text-muted-foreground line-clamp-2">{post.content}</p>
                          )}
                          {post.status === "POSTED" && (
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Eye className="h-4 w-4" />
                                {formatNumber(post.impressions)}
                              </span>
                              <span className="flex items-center gap-1">
                                <ThumbsUp className="h-4 w-4" />
                                {formatNumber(post.likes)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Repeat2 className="h-4 w-4" />
                                {formatNumber(post.retweets)}
                              </span>
                              <span className="flex items-center gap-1">
                                <MessageCircle className="h-4 w-4" />
                                {formatNumber(post.replies)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      {post.tweetUrl && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={post.tweetUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 mr-1" />
                            View
                          </a>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
