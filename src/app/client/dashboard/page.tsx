import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatNumber } from "@/lib/utils";
import {
  Megaphone,
  Eye,
  Heart,
  MessageCircle,
  TrendingUp,
  Clock,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Users,
  BarChart3,
  Zap
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

async function getClientStats(organizationId: string) {
  try {
    const campaigns = await db.campaign.findMany({
      where: { clientId: organizationId },
      include: {
        posts: {
          orderBy: { createdAt: "desc" },
        },
        campaignKols: {
          include: {
            kol: true,
          },
        },
      },
    });

    const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE");
    const totalPosts = campaigns.reduce((sum, c) => sum + c.posts.length, 0);
    const postedPosts = campaigns.reduce(
      (sum, c) => sum + c.posts.filter((p) => p.status === "POSTED" || p.status === "VERIFIED").length,
      0
    );
    const totalImpressions = campaigns.reduce(
      (sum, c) => sum + c.posts.reduce((s, p) => s + p.impressions, 0),
      0
    );
    const totalEngagement = campaigns.reduce(
      (sum, c) =>
        sum + c.posts.reduce((s, p) => s + p.likes + p.retweets + p.replies, 0),
      0
    );
    const totalLikes = campaigns.reduce(
      (sum, c) => sum + c.posts.reduce((s, p) => s + p.likes, 0),
      0
    );

    const pendingPosts = campaigns.reduce(
      (sum, c) => sum + c.posts.filter((p) => p.status === "PENDING_APPROVAL").length,
      0
    );

    const approvedPosts = campaigns.reduce(
      (sum, c) => sum + c.posts.filter((p) => p.status === "APPROVED").length,
      0
    );

    const totalKols = new Set(
      campaigns.flatMap((c) => c.campaignKols.map((ck) => ck.kolId))
    ).size;

    // Get recent posts for activity feed
    const recentPosts = campaigns
      .flatMap((c) =>
        c.posts.map((p) => ({
          ...p,
          campaignName: c.name,
          kolName: c.campaignKols.find((ck) => ck.kolId === p.kolId)?.kol.name || "Unknown KOL",
        }))
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    // Calculate engagement rate
    const engagementRate = totalImpressions > 0
      ? ((totalEngagement / totalImpressions) * 100).toFixed(2)
      : "0.00";

    return {
      totalCampaigns: campaigns.length,
      activeCampaigns: activeCampaigns.length,
      totalPosts,
      postedPosts,
      totalImpressions,
      totalEngagement,
      totalLikes,
      pendingPosts,
      approvedPosts,
      totalKols,
      campaigns,
      recentPosts,
      engagementRate,
    };
  } catch (error) {
    console.error("Error fetching client stats:", error);
    return {
      totalCampaigns: 0,
      activeCampaigns: 0,
      totalPosts: 0,
      postedPosts: 0,
      totalImpressions: 0,
      totalEngagement: 0,
      totalLikes: 0,
      pendingPosts: 0,
      approvedPosts: 0,
      totalKols: 0,
      campaigns: [],
      recentPosts: [],
      engagementRate: "0.00",
    };
  }
}

export default async function ClientDashboard() {
  const session = await auth();
  if (!session?.user) return null;

  const stats = await getClientStats(session.user.organizationId);

  // If client has exactly one campaign, redirect to that campaign's detail page
  if (stats.campaigns.length === 1) {
    redirect(`/client/campaigns/${stats.campaigns[0].id}`);
  }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800 p-8 text-white">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.5))]" />
        <div className="relative">
          <div className="flex items-center gap-2 text-teal-200 mb-2">
            <Sparkles className="h-5 w-5" />
            <span className="text-sm font-medium">{getGreeting()}</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">
            {session.user.name || "Welcome back"}
          </h1>
          <p className="text-teal-100 max-w-xl">
            You have <span className="text-white font-semibold">{stats.activeCampaigns} active campaign{stats.activeCampaigns !== 1 ? "s" : ""}</span> with{" "}
            <span className="text-white font-semibold">{stats.totalKols} KOLs</span> creating content for you.
          </p>
        </div>
      </div>

      {/* Pending Approvals Alert */}
      {stats.pendingPosts > 0 && (
        <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-amber-900">
                    {stats.pendingPosts} Post{stats.pendingPosts !== 1 ? "s" : ""} Awaiting Your Review
                  </h3>
                  <p className="text-sm text-amber-700">
                    Review and approve content before it goes live
                  </p>
                </div>
              </div>
              <Button asChild className="bg-amber-600 hover:bg-amber-700">
                <Link href="/client/review">
                  Review Now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-teal-500/10 rounded-full -mr-10 -mt-10" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Impressions</CardTitle>
            <Eye className="h-4 w-4 text-teal-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.totalImpressions)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all campaigns
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-rose-500/10 rounded-full -mr-10 -mt-10" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Engagement</CardTitle>
            <Heart className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.totalEngagement)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Likes, retweets & replies
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/10 rounded-full -mr-10 -mt-10" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Engagement Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.engagementRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Average across posts
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 rounded-full -mr-10 -mt-10" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Published Posts</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.postedPosts}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Out of {stats.totalPosts} total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Campaigns List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Your Campaigns</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Monitor your active marketing campaigns
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/client/campaigns">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {stats.campaigns.length === 0 ? (
                <div className="text-center py-8">
                  <Megaphone className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">
                    No campaigns assigned to your organization yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {stats.campaigns.slice(0, 4).map((campaign) => {
                    const campaignImpressions = campaign.posts.reduce((s, p) => s + p.impressions, 0);
                    const campaignEngagement = campaign.posts.reduce(
                      (s, p) => s + p.likes + p.retweets + p.replies, 0
                    );
                    const pendingCount = campaign.posts.filter(p => p.status === "PENDING_APPROVAL").length;

                    return (
                      <Link
                        key={campaign.id}
                        href={`/client/campaigns/${campaign.id}`}
                        className="block group"
                      >
                        <div className="p-4 rounded-xl border bg-card hover:bg-muted/50 hover:border-teal-500/50 transition-all">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold group-hover:text-teal-600 transition-colors">
                                  {campaign.name}
                                </h3>
                                {pendingCount > 0 && (
                                  <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                                    {pendingCount} pending
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {campaign.campaignKols.length} KOLs • {campaign.posts.length} posts
                              </p>
                            </div>
                            <Badge
                              variant={campaign.status === "ACTIVE" ? "default" : "secondary"}
                              className={campaign.status === "ACTIVE" ? "bg-teal-500" : ""}
                            >
                              {campaign.status}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-3 gap-4 pt-3 border-t">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Impressions</p>
                              <p className="font-semibold text-sm">{formatNumber(campaignImpressions)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Engagement</p>
                              <p className="font-semibold text-sm">{formatNumber(campaignEngagement)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">KOLs Active</p>
                              <p className="font-semibold text-sm">{campaign.campaignKols.length}</p>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions & Stats */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link
                href="/client/review"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors group"
              >
                <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium group-hover:text-teal-600 transition-colors">Review Posts</p>
                  <p className="text-xs text-muted-foreground">{stats.pendingPosts} pending approval</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-teal-600 transition-colors" />
              </Link>

              <Link
                href="/client/analytics"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors group"
              >
                <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium group-hover:text-teal-600 transition-colors">View Analytics</p>
                  <p className="text-xs text-muted-foreground">Detailed performance data</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-teal-600 transition-colors" />
              </Link>

              <Link
                href="/client/campaigns"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors group"
              >
                <div className="h-10 w-10 rounded-lg bg-teal-100 flex items-center justify-center">
                  <Megaphone className="h-5 w-5 text-teal-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium group-hover:text-teal-600 transition-colors">All Campaigns</p>
                  <p className="text-xs text-muted-foreground">{stats.totalCampaigns} total campaigns</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-teal-600 transition-colors" />
              </Link>
            </CardContent>
          </Card>

          {/* Content Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Content Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Published</span>
                  <span className="font-medium">{stats.postedPosts} posts</span>
                </div>
                <Progress
                  value={stats.totalPosts > 0 ? (stats.postedPosts / stats.totalPosts) * 100 : 0}
                  className="h-2"
                />
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Approved</span>
                  <span className="font-medium">{stats.approvedPosts} posts</span>
                </div>
                <Progress
                  value={stats.totalPosts > 0 ? (stats.approvedPosts / stats.totalPosts) * 100 : 0}
                  className="h-2 [&>div]:bg-teal-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Pending Review</span>
                  <span className="font-medium">{stats.pendingPosts} posts</span>
                </div>
                <Progress
                  value={stats.totalPosts > 0 ? (stats.pendingPosts / stats.totalPosts) * 100 : 0}
                  className="h-2 [&>div]:bg-amber-500"
                />
              </div>
            </CardContent>
          </Card>

          {/* KOL Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Your KOL Network
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-4">
                <div className="text-4xl font-bold text-teal-600">{stats.totalKols}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  Active influencers
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="text-center">
                  <p className="text-lg font-semibold">{stats.totalPosts}</p>
                  <p className="text-xs text-muted-foreground">Total Posts</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold">{formatNumber(stats.totalLikes)}</p>
                  <p className="text-xs text-muted-foreground">Total Likes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
