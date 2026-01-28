"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  formatNumber,
  formatDate,
  getStatusColor,
  cn,
} from "@/lib/utils";
import {
  ArrowLeft,
  Users,
  FileText,
  BarChart3,
  Eye,
  Heart,
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
  Package,
  Trophy,
} from "lucide-react";

interface CampaignDetails {
  id: string;
  name: string;
  description: string | null;
  projectTwitterHandle: string | null;
  keywords: string[];
  status: string;
  totalBudget: number;
  spentBudget: number;
  totalAllocatedBudget?: number; // For clients - sum of all KOL budgets
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
    requiredPosts: number;
    requiredThreads: number;
    requiredRetweets: number;
    requiredSpaces: number;
    kol: {
      id: string;
      name: string;
      twitterHandle: string;
      avatarUrl: string | null;
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
    quotes: number;
    bookmarks: number;
    postedAt: string | null;
    createdAt: string;
    kol: {
      id: string;
      name: string;
      twitterHandle: string;
      avatarUrl: string | null;
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
  const totalQuotes = campaign.posts.reduce((sum, p) => sum + p.quotes, 0);
  const totalBookmarks = campaign.posts.reduce((sum, p) => sum + p.bookmarks, 0);
  const totalEngagement = totalLikes + totalRetweets + totalReplies + totalQuotes + totalBookmarks;
  const engagementRate = totalImpressions > 0 ? ((totalEngagement / totalImpressions) * 100).toFixed(2) : "0";

  const pendingPosts = campaign.posts.filter(p => p.status === "PENDING_APPROVAL").length;
  const postedCount = campaign.posts.filter(p => ["POSTED", "VERIFIED"].includes(p.status)).length;

  // KPI Progress
  const kpiProgress = campaign.kpis ? {
    impressions: campaign.kpis.impressions ? Math.min((totalImpressions / campaign.kpis.impressions) * 100, 100) : 0,
    engagement: campaign.kpis.engagement ? Math.min((parseFloat(engagementRate) / campaign.kpis.engagement) * 100, 100) : 0,
  } : null;

  // Top performing posts (sorted by total engagement)
  const publishedPosts = campaign.posts.filter(p => ["POSTED", "VERIFIED"].includes(p.status));
  const topPosts = [...publishedPosts]
    .sort((a, b) => (b.likes + b.retweets + b.replies) - (a.likes + a.retweets + a.replies))
    .slice(0, 5);

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
                <p className="text-teal-100 text-sm">Total Likes</p>
                <p className="text-3xl font-bold mt-1">{formatNumber(totalLikes)}</p>
              </div>
              <Heart className="h-8 w-8 text-teal-200" />
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
            {/* Top Performing Posts */}
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  Top Performing Posts
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                {topPosts.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="text-sm">No published posts yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {topPosts.map((post, i) => {
                      const eng = post.likes + post.retweets + post.replies;
                      return (
                        <div key={post.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                          <span className={cn(
                            "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                            i === 0 ? "bg-amber-500/20 text-amber-600" :
                            i === 1 ? "bg-gray-300/30 text-gray-500" :
                            i === 2 ? "bg-orange-500/20 text-orange-600" :
                            "bg-muted text-muted-foreground"
                          )}>
                            {i + 1}
                          </span>
                          <Avatar className="h-7 w-7 flex-shrink-0">
                            <AvatarImage src={post.kol?.avatarUrl || undefined} />
                            <AvatarFallback className="text-xs">{post.kol?.name?.charAt(0) || "K"}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-medium">@{post.kol?.twitterHandle}</span>
                              {post.tweetUrl && (
                                <a href={post.tweetUrl} target="_blank" rel="noopener noreferrer" className="text-primary">
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                            {post.content && (
                              <p className="text-xs text-muted-foreground line-clamp-1 mb-1.5">{post.content.slice(0, 80)}</p>
                            )}
                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                              <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{formatNumber(post.impressions)}</span>
                              <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{formatNumber(post.likes)}</span>
                              <span className="flex items-center gap-1"><Repeat2 className="h-3 w-3" />{formatNumber(post.retweets)}</span>
                              <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{formatNumber(post.replies)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Deliverables Progress */}
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-emerald-500" />
                  Deliverables Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                {campaign.campaignKols.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="text-sm">No KOLs assigned</p>
                  </div>
                ) : (() => {
                  const totalRequired = campaign.campaignKols.reduce((s, ck) =>
                    s + ck.requiredPosts + ck.requiredThreads + ck.requiredRetweets + ck.requiredSpaces, 0);
                  const totalDelivered = campaign.campaignKols.reduce((s, ck) => {
                    const d = getKolDeliverables(ck.kol.id, ck);
                    return s + d.totalCompleted;
                  }, 0);
                  const overallPct = totalRequired > 0 ? Math.min(100, Math.round((totalDelivered / totalRequired) * 100)) : 0;

                  return (
                    <div className="space-y-4">
                      {/* Overall */}
                      <div className="p-4 rounded-lg bg-muted/50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle className={cn("h-4 w-4", overallPct >= 100 ? "text-emerald-500" : "text-muted-foreground")} />
                            <span className="text-sm font-medium">Overall Delivery</span>
                          </div>
                          <span className="text-sm font-bold">{totalDelivered} / {totalRequired}</span>
                        </div>
                        <Progress value={overallPct} className="h-3" />
                        <p className="text-xs text-muted-foreground mt-1.5">{overallPct}% complete</p>
                      </div>

                      {/* Per-KOL */}
                      <div className="space-y-3">
                        {campaign.campaignKols
                          .filter(ck => ck.requiredPosts + ck.requiredThreads + ck.requiredRetweets + ck.requiredSpaces > 0)
                          .map(ck => {
                            const d = getKolDeliverables(ck.kol.id, ck);
                            return (
                              <div key={ck.id} className="flex items-center gap-3">
                                <Avatar className="h-7 w-7 flex-shrink-0">
                                  <AvatarImage src={ck.kol.avatarUrl || undefined} />
                                  <AvatarFallback className="text-xs">{ck.kol.name?.charAt(0) || "K"}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-medium truncate">@{ck.kol.twitterHandle}</span>
                                    <span className={cn(
                                      "text-xs flex-shrink-0 ml-2",
                                      d.progress >= 100 ? "text-emerald-600 font-medium" : "text-muted-foreground"
                                    )}>
                                      {d.totalCompleted}/{d.totalRequired}
                                    </span>
                                  </div>
                                  <Progress value={d.progress} className="h-1.5" />
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  );
                })()}
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
                const kolPosts = campaign.posts.filter(p => p.kol?.id === ck.kol.id && ["POSTED", "VERIFIED"].includes(p.status));
                const kolAllPosts = campaign.posts.filter(p => p.kol?.id === ck.kol.id);
                const kolImpressions = kolPosts.reduce((sum, p) => sum + p.impressions, 0);
                const kolLikes = kolPosts.reduce((sum, p) => sum + p.likes, 0);
                const kolRetweets = kolPosts.reduce((sum, p) => sum + p.retweets, 0);
                const kolReplies = kolPosts.reduce((sum, p) => sum + p.replies, 0);
                const kolEngagement = kolPosts.reduce((sum, p) => sum + p.likes + p.retweets + p.replies + p.quotes + p.bookmarks, 0);
                const kolKeywordMatches = kolPosts.filter(p => p.hasKeywordMatch).length;
                const deliverables = getKolDeliverables(ck.kol.id, ck);
                const avgImpressions = kolPosts.length > 0 ? Math.round(kolImpressions / kolPosts.length) : 0;
                const avgEngagement = kolPosts.length > 0 ? Math.round(kolEngagement / kolPosts.length) : 0;
                const kolEngRate = kolImpressions > 0 ? ((kolEngagement / kolImpressions) * 100).toFixed(2) : "0";
                const pendingCount = kolAllPosts.filter(p => p.status === "PENDING_APPROVAL").length;

                return (
                  <Card key={ck.id || ck.kol.twitterHandle}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-14 w-14">
                            {ck.kol.avatarUrl && <AvatarImage src={ck.kol.avatarUrl} alt={ck.kol.name} />}
                            <AvatarFallback className="bg-teal-100 text-teal-700 text-lg">
                              {ck.kol.name?.charAt(0) || "K"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-lg">{ck.kol.name}</p>
                              {pendingCount > 0 && (
                                <Badge className="bg-amber-100 text-amber-700 text-xs">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {pendingCount} pending
                                </Badge>
                              )}
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
                              <span className={cn("text-sm font-medium", deliverables.progress >= 100 ? "text-emerald-600" : "")}>
                                {deliverables.totalCompleted}/{deliverables.totalRequired}
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

                      <div className="grid grid-cols-3 lg:grid-cols-6 gap-4 mt-6 pt-4 border-t">
                        <div className="text-center">
                          <p className="text-2xl font-bold">{kolPosts.length}</p>
                          <p className="text-xs text-muted-foreground">Published</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold">{formatNumber(kolImpressions)}</p>
                          <p className="text-xs text-muted-foreground">Impressions</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold">{formatNumber(kolLikes)}</p>
                          <p className="text-xs text-muted-foreground">Likes</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold">{formatNumber(kolRetweets)}</p>
                          <p className="text-xs text-muted-foreground">Retweets</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold">{formatNumber(kolReplies)}</p>
                          <p className="text-xs text-muted-foreground">Replies</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold">{kolEngRate}%</p>
                          <p className="text-xs text-muted-foreground">Eng. Rate</p>
                        </div>
                      </div>

                      {/* Per-post averages */}
                      {kolPosts.length > 0 && (
                        <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-dashed">
                          <div className="flex items-center gap-2">
                            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Avg/Post:</span>
                            <span className="text-sm font-medium">{formatNumber(avgImpressions)} impressions</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Heart className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Avg/Post:</span>
                            <span className="text-sm font-medium">{formatNumber(avgEngagement)} engagement</span>
                          </div>
                        </div>
                      )}

                      {campaign.keywords.length > 0 && kolKeywordMatches > 0 && (
                        <div className="mt-3 pt-3 border-t border-dashed">
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
                        <th className="text-right p-4 font-medium text-muted-foreground">Likes</th>
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
                                <AvatarImage src={post.kol?.avatarUrl || undefined} alt={post.kol?.name || "KOL"} />
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
                          <td className="p-4 text-right font-medium">{post.likes > 0 ? formatNumber(post.likes) : "-"}</td>
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
