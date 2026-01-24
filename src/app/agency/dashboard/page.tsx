import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { MetricCard } from "@/components/shared/metric-card";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Users, Megaphone, DollarSign, TrendingUp } from "lucide-react";
import Link from "next/link";

async function getDashboardStats(organizationId: string) {
  const [kolCount, campaignCount, activeCampaigns, recentKols] = await Promise.all([
    db.kOL.count({ where: { organizationId } }),
    db.campaign.count({ where: { agencyId: organizationId } }),
    db.campaign.findMany({
      where: { agencyId: organizationId, status: "ACTIVE" },
      include: {
        campaignKols: true,
        posts: true,
      },
    }),
    db.kOL.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const totalBudget = activeCampaigns.reduce((sum, c) => sum + c.totalBudget, 0);
  const totalPosts = activeCampaigns.reduce((sum, c) => sum + c.posts.length, 0);

  return {
    kolCount,
    campaignCount,
    activeCampaignCount: activeCampaigns.length,
    totalBudget,
    totalPosts,
    recentKols,
    activeCampaigns,
  };
}

export default async function AgencyDashboard() {
  const session = await auth();
  if (!session?.user) return null;

  const stats = await getDashboardStats(session.user.organizationId);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back, {session.user.name || "there"}!
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total KOLs"
          value={stats.kolCount}
          icon={Users}
        />
        <MetricCard
          title="Active Campaigns"
          value={stats.activeCampaignCount}
          icon={Megaphone}
        />
        <MetricCard
          title="Total Budget"
          value={formatCurrency(stats.totalBudget)}
          icon={DollarSign}
        />
        <MetricCard
          title="Posts This Month"
          value={stats.totalPosts}
          icon={TrendingUp}
        />
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent KOLs */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent KOLs</h2>
            <Link
              href="/agency/kols"
              className="text-sm text-primary hover:underline"
            >
              View all
            </Link>
          </div>
          {stats.recentKols.length === 0 ? (
            <p className="text-muted-foreground text-sm">No KOLs added yet.</p>
          ) : (
            <div className="space-y-3">
              {stats.recentKols.map((kol) => (
                <Link
                  key={kol.id}
                  href={`/agency/kols/${kol.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-medium">
                    {kol.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{kol.name}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      @{kol.twitterHandle}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {formatNumber(kol.followersCount)}
                    </p>
                    <p className="text-xs text-muted-foreground">followers</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Active Campaigns */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Active Campaigns</h2>
            <Link
              href="/agency/campaigns"
              className="text-sm text-primary hover:underline"
            >
              View all
            </Link>
          </div>
          {stats.activeCampaigns.length === 0 ? (
            <p className="text-muted-foreground text-sm">No active campaigns.</p>
          ) : (
            <div className="space-y-3">
              {stats.activeCampaigns.slice(0, 5).map((campaign) => (
                <Link
                  key={campaign.id}
                  href={`/agency/campaigns/${campaign.id}`}
                  className="block p-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{campaign.name}</p>
                    <span className="text-sm text-teal-600 bg-teal-50 px-2 py-0.5 rounded">
                      Active
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span>{campaign.campaignKols.length} KOLs</span>
                    <span>{campaign.posts.length} posts</span>
                    <span>{formatCurrency(campaign.totalBudget)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/agency/kols?action=new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Users className="h-4 w-4" />
            Add KOL
          </Link>
          <Link
            href="/agency/campaigns?action=new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Megaphone className="h-4 w-4" />
            New Campaign
          </Link>
          <Link
            href="/agency/content/review"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-muted"
          >
            Review Content
          </Link>
        </div>
      </div>
    </div>
  );
}
