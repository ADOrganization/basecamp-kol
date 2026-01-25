import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatCurrency, formatNumber, getTimeOfDayGreeting } from "@/lib/utils";
import {
  Users,
  Megaphone,
  TrendingUp,
  Eye,
  Heart,
  MessageSquare,
  Repeat2,
  ArrowUpRight,
  Sparkles,
  Zap,
  Target,
  BarChart3,
  FileText
} from "lucide-react";
import Link from "next/link";
import { DashboardCharts } from "./dashboard-charts";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { TopPosts } from "@/components/dashboard/top-posts";
import { ActionItems } from "@/components/dashboard/action-items";
import { StatsCard } from "@/components/dashboard/stats-card";

async function getDashboardStats(organizationId: string) {
  const [kols, campaigns, posts, pendingPosts] = await Promise.all([
    db.kOL.findMany({
      where: { organizationId },
      orderBy: { followersCount: "desc" },
    }),
    db.campaign.findMany({
      where: { agencyId: organizationId },
      include: {
        campaignKols: true,
        posts: {
          orderBy: { impressions: "desc" },
          take: 10,
        },
      },
    }),
    db.post.findMany({
      where: {
        campaign: { agencyId: organizationId },
      },
      include: {
        kol: true,
        campaign: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    db.post.count({
      where: {
        campaign: { agencyId: organizationId },
        status: { in: ["PENDING_APPROVAL", "DRAFT"] },
      },
    }),
  ]);

  const activeCampaigns = campaigns.filter(c => c.status === "ACTIVE");
  const totalBudget = campaigns.reduce((sum, c) => sum + c.totalBudget, 0);
  const totalSpent = campaigns.reduce((sum, c) => sum + c.spentBudget, 0);

  // Calculate total engagement metrics
  const totalImpressions = posts.reduce((sum, p) => sum + p.impressions, 0);
  const totalLikes = posts.reduce((sum, p) => sum + p.likes, 0);
  const totalRetweets = posts.reduce((sum, p) => sum + p.retweets, 0);
  const totalReplies = posts.reduce((sum, p) => sum + p.replies, 0);

  // Calculate average engagement rate
  const postsWithMetrics = posts.filter(p => p.impressions > 0);
  const avgEngagementRate = postsWithMetrics.length > 0
    ? postsWithMetrics.reduce((sum, p) => sum + p.engagementRate, 0) / postsWithMetrics.length
    : 0;

  // KOL tier distribution
  const tierDistribution = {
    MEGA: kols.filter(k => k.tier === "MEGA").length,
    MACRO: kols.filter(k => k.tier === "MACRO").length,
    MID: kols.filter(k => k.tier === "MID").length,
    MICRO: kols.filter(k => k.tier === "MICRO").length,
    NANO: kols.filter(k => k.tier === "NANO").length,
  };

  // Generate trend data from actual posts
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const dayPosts = posts.filter(p => {
      const postDate = p.postedAt ? new Date(p.postedAt) : new Date(p.createdAt);
      return postDate >= dayStart && postDate <= dayEnd;
    });

    return {
      date: date.toLocaleDateString("en-US", { weekday: "short" }),
      impressions: dayPosts.reduce((sum, p) => sum + p.impressions, 0),
      engagement: dayPosts.reduce((sum, p) => sum + p.likes + p.retweets + p.replies, 0),
    };
  });

  // Campaign performance data
  const campaignPerformance = activeCampaigns.slice(0, 5).map(c => ({
    name: c.name.length > 15 ? c.name.substring(0, 15) + "..." : c.name,
    budget: c.totalBudget,
    spent: c.spentBudget,
    posts: c.posts.length,
  }));

  // Top performing posts
  const topPosts = posts
    .filter(p => p.status === "POSTED" || p.status === "VERIFIED")
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 5)
    .map(p => ({
      id: p.id,
      content: p.content,
      impressions: p.impressions,
      likes: p.likes,
      retweets: p.retweets,
      engagementRate: p.engagementRate,
      tweetUrl: p.tweetUrl,
      kol: {
        name: p.kol.name,
        twitterHandle: p.kol.twitterHandle,
      },
      campaign: {
        name: p.campaign.name,
      },
    }));

  // Recent activities
  const recentActivities = posts.slice(0, 8).map(p => ({
    id: p.id,
    type: p.status === "APPROVED" ? "post_approved" as const :
          p.status === "PENDING_APPROVAL" ? "post_pending" as const :
          p.status === "POSTED" ? "milestone" as const : "post_pending" as const,
    title: p.status === "APPROVED" ? "Post approved" :
           p.status === "POSTED" ? "Post went live" :
           "Post pending review",
    description: `${p.kol.name} - ${p.campaign.name}`,
    timestamp: p.updatedAt,
  }));

  // Action items
  const actionItems: Array<{
    type: "review_posts" | "campaign_ending" | "low_budget" | "milestone";
    title: string;
    count?: number;
    link: string;
    urgency: "high" | "medium" | "low";
  }> = [];

  if (pendingPosts > 0) {
    actionItems.push({
      type: "review_posts",
      title: "Posts awaiting review",
      count: pendingPosts,
      link: "/agency/content/review",
      urgency: pendingPosts > 5 ? "high" : "medium",
    });
  }

  // Check for campaigns ending soon
  const endingSoon = activeCampaigns.filter(c => {
    if (!c.endDate) return false;
    const daysLeft = Math.ceil((new Date(c.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysLeft <= 7 && daysLeft > 0;
  });

  if (endingSoon.length > 0) {
    actionItems.push({
      type: "campaign_ending",
      title: "Campaigns ending soon",
      count: endingSoon.length,
      link: "/agency/campaigns",
      urgency: "medium",
    });
  }

  // Check for low budget campaigns
  const lowBudget = activeCampaigns.filter(c => {
    if (c.totalBudget === 0) return false;
    return (c.spentBudget / c.totalBudget) > 0.9;
  });

  if (lowBudget.length > 0) {
    actionItems.push({
      type: "low_budget",
      title: "Campaigns near budget limit",
      count: lowBudget.length,
      link: "/agency/campaigns",
      urgency: "high",
    });
  }

  return {
    kolCount: kols.length,
    campaignCount: campaigns.length,
    activeCampaignCount: activeCampaigns.length,
    totalBudget,
    totalSpent,
    totalImpressions,
    totalLikes,
    totalRetweets,
    totalReplies,
    totalPosts: posts.length,
    avgEngagementRate,
    recentKols: kols.slice(0, 5),
    activeCampaigns: activeCampaigns.slice(0, 5),
    tierDistribution,
    trendData: last7Days,
    campaignPerformance,
    topPosts,
    recentActivities,
    actionItems,
    pendingPosts,
  };
}

export default async function AgencyDashboard() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const stats = await getDashboardStats(session.user.organizationId);
  const greeting = getTimeOfDayGreeting();

  const tierChartData = [
    { name: "Mega (1M+)", value: stats.tierDistribution.MEGA, color: "#6366f1" },
    { name: "Macro (500k-1M)", value: stats.tierDistribution.MACRO, color: "#8b5cf6" },
    { name: "Mid (100k-500k)", value: stats.tierDistribution.MID, color: "#14b8a6" },
    { name: "Micro (10k-100k)", value: stats.tierDistribution.MICRO, color: "#f59e0b" },
    { name: "Nano (<10k)", value: stats.tierDistribution.NANO, color: "#64748b" },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 p-8 text-white">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.5))]" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-indigo-200 mb-2">
              <Sparkles className="h-5 w-5" />
              <span className="text-sm font-medium">{greeting}</span>
            </div>
            <h1 className="text-3xl font-bold mb-2">
              {session.user.name || session.user.email?.split("@")[0] || "User"}
            </h1>
            <p className="text-indigo-200 max-w-xl">
              You have{" "}
              <span className="text-white font-semibold">{stats.activeCampaignCount} active campaigns</span> running with{" "}
              <span className="text-white font-semibold">{stats.kolCount} KOLs</span> in your network.
              {stats.pendingPosts > 0 && (
                <span className="block mt-1">
                  <Zap className="inline h-4 w-4 mr-1" />
                  {stats.pendingPosts} posts awaiting review
                </span>
              )}
            </p>
          </div>

          {/* Quick stats in header */}
          <div className="flex gap-4">
            <div className="text-center px-4 py-2 rounded-lg bg-white/10 backdrop-blur">
              <p className="text-2xl font-bold">{formatNumber(stats.totalImpressions)}</p>
              <p className="text-xs text-indigo-200">Impressions</p>
            </div>
            <div className="text-center px-4 py-2 rounded-lg bg-white/10 backdrop-blur">
              <p className="text-2xl font-bold">{stats.avgEngagementRate.toFixed(1)}%</p>
              <p className="text-xs text-indigo-200">Avg. ER</p>
            </div>
          </div>
        </div>
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -right-20 -bottom-20 h-60 w-60 rounded-full bg-purple-500/20 blur-3xl" />
      </div>

      {/* Action Items - Only show if there are items */}
      {stats.actionItems.length > 0 && (
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold">Action Required</h2>
          </div>
          <ActionItems items={stats.actionItems} />
        </div>
      )}

      {/* Hero Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Impressions"
          value={formatNumber(stats.totalImpressions)}
          icon={Eye}
          trend={{ value: 12.5, label: "vs last week" }}
          accentColor="indigo"
        />
        <StatsCard
          title="Total Engagement"
          value={formatNumber(stats.totalLikes + stats.totalRetweets)}
          icon={Heart}
          trend={{ value: 8.2, label: "vs last week" }}
          accentColor="teal"
        />
        <StatsCard
          title="Active Campaigns"
          value={stats.activeCampaignCount.toString()}
          subtitle={`${stats.campaignCount} total campaigns`}
          icon={Megaphone}
          accentColor="purple"
        />
        <StatsCard
          title="Total Budget"
          value={formatCurrency(stats.totalBudget)}
          subtitle={`${stats.totalBudget > 0 ? Math.round((stats.totalSpent / stats.totalBudget) * 100) : 0}% utilized`}
          icon={TrendingUp}
          accentColor="amber"
        />
      </div>

      {/* Engagement Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-card border hover:border-rose-500/30 transition-colors">
          <div className="p-2 rounded-lg bg-rose-500/10">
            <Heart className="h-5 w-5 text-rose-500" />
          </div>
          <div>
            <p className="text-xl font-bold">{formatNumber(stats.totalLikes)}</p>
            <p className="text-xs text-muted-foreground">Total Likes</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-card border hover:border-emerald-500/30 transition-colors">
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <Repeat2 className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-xl font-bold">{formatNumber(stats.totalRetweets)}</p>
            <p className="text-xs text-muted-foreground">Retweets</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-card border hover:border-blue-500/30 transition-colors">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <MessageSquare className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <p className="text-xl font-bold">{formatNumber(stats.totalReplies)}</p>
            <p className="text-xs text-muted-foreground">Replies</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-card border hover:border-indigo-500/30 transition-colors">
          <div className="p-2 rounded-lg bg-indigo-500/10">
            <Users className="h-5 w-5 text-indigo-500" />
          </div>
          <div>
            <p className="text-xl font-bold">{stats.kolCount}</p>
            <p className="text-xs text-muted-foreground">KOLs</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-card border hover:border-purple-500/30 transition-colors">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <FileText className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <p className="text-xl font-bold">{stats.totalPosts}</p>
            <p className="text-xs text-muted-foreground">Total Posts</p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <DashboardCharts
        trendData={stats.trendData}
        tierChartData={tierChartData}
        campaignPerformance={stats.campaignPerformance}
      />

      {/* Three Column Grid: Top Posts, Activity Feed, KOLs */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Top Performing Posts */}
        <div className="lg:col-span-2 rounded-xl border bg-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-500" />
              <div>
                <h2 className="text-lg font-semibold">Top Performing Posts</h2>
                <p className="text-sm text-muted-foreground">By impressions</p>
              </div>
            </div>
            <Link
              href="/agency/content/review"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              View all
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <TopPosts posts={stats.topPosts} />
        </div>

        {/* Activity Feed */}
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Recent Activity</h2>
              <p className="text-sm text-muted-foreground">Latest updates</p>
            </div>
          </div>
          <ActivityFeed activities={stats.recentActivities} />
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent KOLs */}
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold">Top KOLs</h2>
              <p className="text-sm text-muted-foreground">By follower count</p>
            </div>
            <Link
              href="/agency/kols"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              View all
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          {stats.recentKols.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No KOLs added yet</p>
              <Link
                href="/agency/kols?action=new"
                className="mt-3 text-sm text-primary hover:underline"
              >
                Add your first KOL
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.recentKols.map((kol, index) => (
                <Link
                  key={kol.id}
                  href={`/agency/kols/${kol.id}`}
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted transition-colors group"
                >
                  <span className={`
                    flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold
                    ${index === 0 ? "bg-amber-500/20 text-amber-500" : ""}
                    ${index === 1 ? "bg-slate-400/20 text-slate-400" : ""}
                    ${index === 2 ? "bg-orange-600/20 text-orange-600" : ""}
                    ${index > 2 ? "bg-muted text-muted-foreground" : ""}
                  `}>
                    {index + 1}
                  </span>
                  {kol.avatarUrl ? (
                    <img
                      src={kol.avatarUrl}
                      alt={kol.name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-medium">
                      {kol.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate group-hover:text-primary transition-colors">{kol.name}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      @{kol.twitterHandle}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatNumber(kol.followersCount)}</p>
                    <p className="text-xs text-muted-foreground">followers</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Active Campaigns */}
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold">Active Campaigns</h2>
              <p className="text-sm text-muted-foreground">Currently running</p>
            </div>
            <Link
              href="/agency/campaigns"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              View all
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          {stats.activeCampaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Megaphone className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No active campaigns</p>
              <Link
                href="/agency/campaigns?action=new"
                className="mt-3 text-sm text-primary hover:underline"
              >
                Create a campaign
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.activeCampaigns.map((campaign) => {
                const progress = campaign.totalBudget > 0
                  ? (campaign.spentBudget / campaign.totalBudget) * 100
                  : 0;
                return (
                  <Link
                    key={campaign.id}
                    href={`/agency/campaigns/${campaign.id}`}
                    className="block p-4 rounded-xl border hover:border-primary/50 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium group-hover:text-primary transition-colors">{campaign.name}</p>
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-teal-500/10 text-teal-500">
                        Active
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {campaign.campaignKols.length} KOLs
                      </span>
                      <span>{campaign.posts.length} posts</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Budget used</span>
                        <span className="font-medium">{Math.round(progress)}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/agency/kols?action=new"
            className="group flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-dashed hover:border-indigo-500 hover:bg-indigo-500/5 transition-all text-center"
          >
            <div className="p-3 rounded-xl bg-indigo-500/10 group-hover:bg-indigo-500/20 group-hover:scale-110 transition-all">
              <Users className="h-6 w-6 text-indigo-500" />
            </div>
            <span className="font-medium">Add KOL</span>
          </Link>
          <Link
            href="/agency/campaigns?action=new"
            className="group flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-dashed hover:border-purple-500 hover:bg-purple-500/5 transition-all text-center"
          >
            <div className="p-3 rounded-xl bg-purple-500/10 group-hover:bg-purple-500/20 group-hover:scale-110 transition-all">
              <Megaphone className="h-6 w-6 text-purple-500" />
            </div>
            <span className="font-medium">New Campaign</span>
          </Link>
          <Link
            href="/agency/content/review"
            className="group flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-dashed hover:border-teal-500 hover:bg-teal-500/5 transition-all text-center relative"
          >
            {stats.pendingPosts > 0 && (
              <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-rose-500 text-white text-xs flex items-center justify-center font-bold">
                {stats.pendingPosts > 9 ? "9+" : stats.pendingPosts}
              </span>
            )}
            <div className="p-3 rounded-xl bg-teal-500/10 group-hover:bg-teal-500/20 group-hover:scale-110 transition-all">
              <FileText className="h-6 w-6 text-teal-500" />
            </div>
            <span className="font-medium">Review Content</span>
          </Link>
          <Link
            href="/agency/telegram"
            className="group flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-dashed hover:border-amber-500 hover:bg-amber-500/5 transition-all text-center"
          >
            <div className="p-3 rounded-xl bg-amber-500/10 group-hover:bg-amber-500/20 group-hover:scale-110 transition-all">
              <MessageSquare className="h-6 w-6 text-amber-500" />
            </div>
            <span className="font-medium">Messages</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
