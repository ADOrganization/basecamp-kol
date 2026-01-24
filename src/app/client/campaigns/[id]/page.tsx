"use client";

import { useState, useEffect, use, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  formatNumber,
  formatDate,
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
  Hash,
  Target,
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
  projectTwitterHandle: string | null;
  keywords: string[];
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
    requiredPosts: number;
    requiredThreads: number;
    requiredRetweets: number;
    requiredSpaces: number;
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
    matchedKeywords: string[];
    hasKeywordMatch: boolean;
    impressions: number;
    likes: number;
    retweets: number;
    replies: number;
    postedAt: string | null;
    createdAt: string;
    kol: {
      id: string;
      name: string;
      twitterHandle: string;
    };
  }[];
}

export default function ClientCampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [campaign, setCampaign] = useState<CampaignDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
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

    fetchCampaign();
  }, [id, router]);

  // Calculate time-series data from actual posts
  const engagementTrend = useMemo(() => {
    if (!campaign || campaign.posts.length === 0) return [];

    // Get posts with dates, sorted by date
    const postsWithDates = campaign.posts
      .filter(p => p.postedAt || p.createdAt)
      .map(p => ({
        ...p,
        date: new Date(p.postedAt || p.createdAt),
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (postsWithDates.length === 0) return [];

    // Group by date and accumulate metrics
    const dateMap = new Map<string, { impressions: number; engagement: number; posts: number }>();

    postsWithDates.forEach(post => {
      const dateKey = post.date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const existing = dateMap.get(dateKey) || { impressions: 0, engagement: 0, posts: 0 };
      dateMap.set(dateKey, {
        impressions: existing.impressions + post.impressions,
        engagement: existing.engagement + post.likes + post.retweets + post.replies,
        posts: existing.posts + 1,
      });
    });

    // Convert to cumulative data
    let cumulativeImpressions = 0;
    let cumulativeEngagement = 0;

    return Array.from(dateMap.entries()).map(([date, data]) => {
      cumulativeImpressions += data.impressions;
      cumulativeEngagement += data.engagement;
      return {
        date,
        impressions: cumulativeImpressions,
        engagement: cumulativeEngagement,
        newPosts: data.posts,
      };
    });
  }, [campaign]);

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
  const postedCount = campaign.posts.filter(p => ["POSTED", "VERIFIED"].includes(p.status)).length;

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
    { name: "Rejected", value: campaign.posts.filter(p => p.status === "REJECTED").length, color: "#ef4444" },
  ].filter(d => d.value > 0);

  // Calculate deliverable progress for each KOL
  const getKolDeliverables = (kolId: string, ck: CampaignDetails["campaignKols"][0]) => {
    const kolPosts = campaign.posts.filter(p => p.kol?.id === kolId && ["POSTED", "VERIFIED"].includes(p.status));
    const counts = {
      POST: kolPosts.filter(p => p.type === "POST").length,
      THREAD: kolPosts.filter(p => p.type === "THREAD").length,
      RETWEET: kolPosts.filter(p => p.type === "RETWEET").length,
      SPACE: kolPosts.filter(p => p.type === "SPACE").length,
    };

    const required = ck.requiredPosts + ck.requiredThreads + ck.requiredRetweets + ck.requiredSpaces;
    const completed = Math.min(counts.POST, ck.requiredPosts) +
      Math.min(counts.THREAD, ck.requiredThreads) +
      Math.min(counts.RETWEET, ck.requiredRetweets) +
      Math.min(counts.SPACE, ck.requiredSpaces);

    return {
      counts,
      required: { posts: ck.requiredPosts, threads: ck.requiredThreads, retweets: ck.requiredRetweets, spaces: ck.requiredSpaces },
      totalRequired: required,
      totalCompleted: completed,
      progress: required > 0 ? Math.round((completed / required) * 100) : 0,
    };
  };

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
            {campaign.keywords.length > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <div className="flex flex-wrap gap-1">
                  {campaign.keywords.map((kw) => (
                    <Badge key={kw} variant="outline" className="text-xs">
                      {kw}
                    </Badge>
                  ))}
                </div>
              </div>
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
                <p className="text-amber-100 text-sm">Posts Published</p>
                <p className="text-3xl font-bold mt-1">{postedCount}</p>
              </div>
              <FileText className="h-8 w-8 text-amber-200" />
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
                <Users className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{campaign.campaignKols.length}</p>
                <p className="text-sm text-muted-foreground">Active KOLs</p>
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
                <CardTitle>Engagement Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  {engagementTrend.length > 0 ? (
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
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No post data yet
                    </div>
                  )}
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
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  KPI Progress
                </CardTitle>
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
                    <Progress value={kpiProgress.impressions} className="h-3" />
                    <p className="text-xs text-muted-foreground mt-1">
                      {kpiProgress.impressions.toFixed(0)}% of target
                    </p>
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
                    <Progress value={kpiProgress.engagement} className="h-3" />
                    <p className="text-xs text-muted-foreground mt-1">
                      {kpiProgress.engagement.toFixed(0)}% of target
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Keyword Summary */}
          {campaign.keywords.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Hash className="h-5 w-5" />
                  Keyword Tracking
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {campaign.keywords.map((kw) => {
                    const matchCount = campaign.posts.filter(p => p.matchedKeywords.includes(kw)).length;
                    return (
                      <div key={kw} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <Badge variant="outline">{kw}</Badge>
                        <span className="text-sm font-medium">{matchCount} posts</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="kols" className="mt-6">
          <div className="grid gap-4">
            {campaign.campaignKols.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No KOLs assigned to this campaign.</p>
                </CardContent>
              </Card>
            ) : (
              campaign.campaignKols.map((ck) => {
                const kolPosts = campaign.posts.filter(p => p.kol?.id === ck.kol.id);
                const kolImpressions = kolPosts.reduce((sum, p) => sum + p.impressions, 0);
                const kolEngagement = kolPosts.reduce((sum, p) => sum + p.likes + p.retweets + p.replies, 0);
                const kolKeywordMatches = kolPosts.filter(p => p.hasKeywordMatch).length;
                const deliverables = getKolDeliverables(ck.kol.id, ck);

                return (
                  <Card key={ck.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-14 w-14">
                            <AvatarFallback className="bg-teal-100 text-teal-700 text-lg">
                              {ck.kol.name?.charAt(0) || "K"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-lg">{ck.kol.name}</p>
                              <Badge className={getTierColor(ck.kol.tier)} variant="secondary">
                                {ck.kol.tier}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground">@{ck.kol.twitterHandle}</p>
                          </div>
                        </div>

                        {/* Deliverables Progress */}
                        {deliverables.totalRequired > 0 && (
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground mb-1">Deliverables</p>
                            <div className="flex items-center gap-2">
                              <Progress value={deliverables.progress} className="w-24 h-2" />
                              <span className={`text-sm font-medium ${deliverables.progress === 100 ? 'text-green-600' : ''}`}>
                                {deliverables.progress}%
                              </span>
                            </div>
                            <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                              {deliverables.required.posts > 0 && (
                                <span>{deliverables.counts.POST}/{deliverables.required.posts} posts</span>
                              )}
                              {deliverables.required.threads > 0 && (
                                <span>{deliverables.counts.THREAD}/{deliverables.required.threads} threads</span>
                              )}
                              {deliverables.required.retweets > 0 && (
                                <span>{deliverables.counts.RETWEET}/{deliverables.required.retweets} RTs</span>
                              )}
                              {deliverables.required.spaces > 0 && (
                                <span>{deliverables.counts.SPACE}/{deliverables.required.spaces} spaces</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-4 gap-4 mt-6 pt-4 border-t">
                        <div className="text-center">
                          <p className="text-2xl font-bold">{formatNumber(ck.kol.followersCount)}</p>
                          <p className="text-sm text-muted-foreground">Followers</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold">{kolPosts.length}</p>
                          <p className="text-sm text-muted-foreground">Posts</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold">{formatNumber(kolImpressions)}</p>
                          <p className="text-sm text-muted-foreground">Impressions</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold">{formatNumber(kolEngagement)}</p>
                          <p className="text-sm text-muted-foreground">Engagement</p>
                        </div>
                      </div>

                      {campaign.keywords.length > 0 && kolKeywordMatches > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <p className="text-sm text-muted-foreground">
                            <Hash className="h-4 w-4 inline-block mr-1" />
                            {kolKeywordMatches} posts with campaign keywords
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="posts" className="mt-6">
          <Card>
            <CardContent className="p-0">
              {campaign.posts.length === 0 ? (
                <div className="py-12 text-center">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No posts in this campaign yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="text-left p-4 font-medium text-muted-foreground">KOL</th>
                        <th className="text-left p-4 font-medium text-muted-foreground">Date</th>
                        <th className="text-left p-4 font-medium text-muted-foreground">Content</th>
                        <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                        <th className="text-right p-4 font-medium text-muted-foreground">Impressions</th>
                        <th className="text-right p-4 font-medium text-muted-foreground">Likes</th>
                        <th className="text-right p-4 font-medium text-muted-foreground">RTs</th>
                        <th className="text-right p-4 font-medium text-muted-foreground">Replies</th>
                        {campaign.keywords.length > 0 && (
                          <th className="text-left p-4 font-medium text-muted-foreground">Keywords</th>
                        )}
                        <th className="w-[50px]"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaign.posts.map((post) => (
                        <tr key={post.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-teal-100 text-teal-700 text-xs">
                                  {post.kol?.name?.charAt(0) || "K"}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-sm">{post.kol?.name || "Unknown"}</p>
                                <p className="text-xs text-muted-foreground">@{post.kol?.twitterHandle || "unknown"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-sm">
                            {post.postedAt ? formatDate(post.postedAt) : "-"}
                          </td>
                          <td className="p-4 max-w-[200px]">
                            <p className="text-sm line-clamp-2">{post.content || "-"}</p>
                          </td>
                          <td className="p-4">
                            {post.status === "PENDING_APPROVAL" && (
                              <Badge className="bg-amber-100 text-amber-700">
                                <Clock className="h-3 w-3 mr-1" />
                                Pending
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
                                Published
                              </Badge>
                            )}
                            {post.status === "REJECTED" && (
                              <Badge className="bg-rose-100 text-rose-700">
                                <XCircle className="h-3 w-3 mr-1" />
                                Rejected
                              </Badge>
                            )}
                            {post.status === "DRAFT" && (
                              <Badge variant="outline">Draft</Badge>
                            )}
                          </td>
                          <td className="p-4 text-right font-medium">{formatNumber(post.impressions)}</td>
                          <td className="p-4 text-right">{formatNumber(post.likes)}</td>
                          <td className="p-4 text-right">{formatNumber(post.retweets)}</td>
                          <td className="p-4 text-right">{formatNumber(post.replies)}</td>
                          {campaign.keywords && campaign.keywords.length > 0 && (
                            <td className="p-4">
                              {post.matchedKeywords && post.matchedKeywords.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {post.matchedKeywords.slice(0, 2).map((kw) => (
                                    <Badge key={kw} variant="secondary" className="text-xs bg-green-100 text-green-700">
                                      {kw}
                                    </Badge>
                                  ))}
                                  {post.matchedKeywords.length > 2 && (
                                    <Badge variant="secondary" className="text-xs">
                                      +{post.matchedKeywords.length - 2}
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </td>
                          )}
                          <td className="p-4">
                            {post.tweetUrl && (
                              <a
                                href={post.tweetUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
