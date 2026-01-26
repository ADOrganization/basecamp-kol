import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Users, Megaphone, TrendingUp, Eye, Heart, MessageSquare, Repeat2, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { DashboardCharts } from "./dashboard-charts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

async function getDashboardStats(organizationId: string) {
  const [kols, campaigns, posts] = await Promise.all([
    db.kOL.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    }),
    db.campaign.findMany({
      where: { agencyId: organizationId },
      include: {
        campaignKols: true,
        posts: true,
      },
    }),
    db.post.findMany({
      where: {
        campaign: { agencyId: organizationId },
      },
      orderBy: { createdAt: "desc" },
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

  // KOL tier distribution (handles both old and new tier values)
  const tierDistribution = {
    MACRO: kols.filter(k => ["MACRO", "MEGA"].includes(k.tier)).length,
    LARGE: kols.filter(k => ["LARGE", "RISING"].includes(k.tier)).length,
    MID: kols.filter(k => ["MID", "MICRO"].includes(k.tier)).length,
    SMALL: kols.filter(k => ["SMALL", "NANO"].includes(k.tier)).length,
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
    recentKols: kols.slice(0, 5),
    activeCampaigns: activeCampaigns.slice(0, 5),
    tierDistribution,
    trendData: last7Days,
    campaignPerformance,
  };
}

export default async function AgencyDashboard() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const stats = await getDashboardStats(session.user.organizationId);

  const tierChartData = [
    { name: "Macro (75K+)", value: stats.tierDistribution.MACRO, color: "#f59e0b" },
    { name: "Large (20K-75K)", value: stats.tierDistribution.LARGE, color: "#8b5cf6" },
    { name: "Mid (10K-20K)", value: stats.tierDistribution.MID, color: "#3b82f6" },
    { name: "Small (1-10K)", value: stats.tierDistribution.SMALL, color: "#14b8a6" },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-8">
      {/* Hero Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Impressions */}
        <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-900 dark:to-slate-800 p-6 border border-border hover:border-indigo-500/50 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-lg bg-indigo-500/20">
                <Eye className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
              </div>
              <span className="flex items-center text-xs text-emerald-600 dark:text-emerald-400">
                <ArrowUpRight className="h-3 w-3 mr-0.5" />
                12.5%
              </span>
            </div>
            <p className="text-3xl font-bold text-foreground mb-1">
              {formatNumber(stats.totalImpressions)}
            </p>
            <p className="text-sm text-muted-foreground">Total Impressions</p>
          </div>
        </div>

        {/* Total Engagement */}
        <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-900 dark:to-slate-800 p-6 border border-border hover:border-teal-500/50 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-lg bg-teal-500/20">
                <Heart className="h-5 w-5 text-teal-500 dark:text-teal-400" />
              </div>
              <span className="flex items-center text-xs text-emerald-600 dark:text-emerald-400">
                <ArrowUpRight className="h-3 w-3 mr-0.5" />
                8.2%
              </span>
            </div>
            <p className="text-3xl font-bold text-foreground mb-1">
              {formatNumber(stats.totalLikes + stats.totalRetweets)}
            </p>
            <p className="text-sm text-muted-foreground">Total Engagement</p>
          </div>
        </div>

        {/* Active Campaigns */}
        <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-900 dark:to-slate-800 p-6 border border-border hover:border-purple-500/50 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Megaphone className="h-5 w-5 text-purple-500 dark:text-purple-400" />
              </div>
              <span className="flex items-center text-xs text-emerald-600 dark:text-emerald-400">
                <ArrowUpRight className="h-3 w-3 mr-0.5" />
                2 new
              </span>
            </div>
            <p className="text-3xl font-bold text-foreground mb-1">
              {stats.activeCampaignCount}
            </p>
            <p className="text-sm text-muted-foreground">Active Campaigns</p>
          </div>
        </div>

        {/* Budget Utilization */}
        <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-900 dark:to-slate-800 p-6 border border-border hover:border-amber-500/50 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <TrendingUp className="h-5 w-5 text-amber-500 dark:text-amber-400" />
              </div>
              <span className="text-xs text-muted-foreground">
                {stats.totalBudget > 0 ? Math.round((stats.totalSpent / stats.totalBudget) * 100) : 0}% used
              </span>
            </div>
            <p className="text-3xl font-bold text-foreground mb-1">
              {formatCurrency(stats.totalBudget)}
            </p>
            <p className="text-sm text-muted-foreground">Total Budget</p>
            {/* Progress bar */}
            <div className="mt-3 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
                style={{ width: `${stats.totalBudget > 0 ? (stats.totalSpent / stats.totalBudget) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Engagement Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-card border">
          <div className="p-2 rounded-lg bg-rose-500/10">
            <Heart className="h-5 w-5 text-rose-500" />
          </div>
          <div>
            <p className="text-xl font-bold">{formatNumber(stats.totalLikes)}</p>
            <p className="text-xs text-muted-foreground">Total Likes</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-card border">
          <div className="p-2 rounded-lg bg-green-500/10">
            <Repeat2 className="h-5 w-5 text-green-500" />
          </div>
          <div>
            <p className="text-xl font-bold">{formatNumber(stats.totalRetweets)}</p>
            <p className="text-xs text-muted-foreground">Retweets</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-card border">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <MessageSquare className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <p className="text-xl font-bold">{formatNumber(stats.totalReplies)}</p>
            <p className="text-xs text-muted-foreground">Replies</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-card border">
          <div className="p-2 rounded-lg bg-indigo-500/10">
            <Users className="h-5 w-5 text-indigo-500" />
          </div>
          <div>
            <p className="text-xl font-bold">{stats.kolCount}</p>
            <p className="text-xs text-muted-foreground">KOLs in Network</p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <DashboardCharts
        trendData={stats.trendData}
        tierChartData={tierChartData}
        campaignPerformance={stats.campaignPerformance}
      />

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
            <div className="space-y-4">
              {stats.recentKols.map((kol, index) => (
                <Link
                  key={kol.id}
                  href={`/agency/kols/${kol.id}`}
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <span className="text-sm font-medium text-muted-foreground w-5">
                    {index + 1}
                  </span>
                  <Avatar className="h-10 w-10 border-2 border-muted">
                    {kol.avatarUrl ? (
                      <AvatarImage src={kol.avatarUrl} alt={kol.name} />
                    ) : null}
                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white">
                      {kol.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{kol.name}</p>
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
            <div className="space-y-4">
              {stats.activeCampaigns.map((campaign) => {
                const progress = campaign.totalBudget > 0
                  ? (campaign.spentBudget / campaign.totalBudget) * 100
                  : 0;
                return (
                  <Link
                    key={campaign.id}
                    href={`/agency/campaigns/${campaign.id}`}
                    className="block p-4 rounded-lg border hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium">{campaign.name}</p>
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
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
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
            className="group flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-dashed hover:border-primary hover:bg-primary/5 transition-all text-center"
          >
            <div className="p-3 rounded-xl bg-indigo-500/10 group-hover:bg-indigo-500/20 transition-colors">
              <Users className="h-6 w-6 text-indigo-500" />
            </div>
            <span className="font-medium">Add KOL</span>
          </Link>
          <Link
            href="/agency/campaigns?action=new"
            className="group flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-dashed hover:border-primary hover:bg-primary/5 transition-all text-center"
          >
            <div className="p-3 rounded-xl bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
              <Megaphone className="h-6 w-6 text-purple-500" />
            </div>
            <span className="font-medium">New Campaign</span>
          </Link>
          <Link
            href="/agency/content/review"
            className="group flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-dashed hover:border-primary hover:bg-primary/5 transition-all text-center"
          >
            <div className="p-3 rounded-xl bg-teal-500/10 group-hover:bg-teal-500/20 transition-colors">
              <MessageSquare className="h-6 w-6 text-teal-500" />
            </div>
            <span className="font-medium">Review Content</span>
          </Link>
          <Link
            href="/agency/telegram"
            className="group flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-dashed hover:border-primary hover:bg-primary/5 transition-all text-center"
          >
            <div className="p-3 rounded-xl bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors">
              <TrendingUp className="h-6 w-6 text-amber-500" />
            </div>
            <span className="font-medium">Messages</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
