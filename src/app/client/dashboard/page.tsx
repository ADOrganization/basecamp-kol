import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { MetricCard } from "@/components/shared/metric-card";
import { formatNumber } from "@/lib/utils";
import { Megaphone, Eye, ThumbsUp, MessageCircle } from "lucide-react";
import Link from "next/link";

async function getClientStats(organizationId: string) {
  const campaigns = await db.campaign.findMany({
    where: { clientId: organizationId },
    include: {
      posts: true,
      campaignKols: {
        include: {
          kol: true,
        },
      },
    },
  });

  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE");
  const totalPosts = campaigns.reduce((sum, c) => sum + c.posts.length, 0);
  const totalImpressions = campaigns.reduce(
    (sum, c) => sum + c.posts.reduce((s, p) => s + p.impressions, 0),
    0
  );
  const totalEngagement = campaigns.reduce(
    (sum, c) =>
      sum + c.posts.reduce((s, p) => s + p.likes + p.retweets + p.replies, 0),
    0
  );

  const pendingPosts = campaigns.reduce(
    (sum, c) => sum + c.posts.filter((p) => p.status === "PENDING_APPROVAL").length,
    0
  );

  return {
    totalCampaigns: campaigns.length,
    activeCampaigns: activeCampaigns.length,
    totalPosts,
    totalImpressions,
    totalEngagement,
    pendingPosts,
    campaigns,
  };
}

export default async function ClientDashboard() {
  const session = await auth();
  if (!session?.user) return null;

  const stats = await getClientStats(session.user.organizationId);

  // If client has exactly one campaign, redirect to that campaign's detail page
  if (stats.campaigns.length === 1) {
    redirect(`/client/campaigns/${stats.campaigns[0].id}`);
  }

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
          title="Active Campaigns"
          value={stats.activeCampaigns}
          icon={Megaphone}
        />
        <MetricCard
          title="Total Impressions"
          value={formatNumber(stats.totalImpressions)}
          icon={Eye}
        />
        <MetricCard
          title="Total Engagement"
          value={formatNumber(stats.totalEngagement)}
          icon={ThumbsUp}
        />
        <MetricCard
          title="Total Posts"
          value={stats.totalPosts}
          icon={MessageCircle}
        />
      </div>

      {/* Pending Approvals Alert */}
      {stats.pendingPosts > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-amber-800">
                Posts Pending Approval
              </h3>
              <p className="text-sm text-amber-700 mt-1">
                You have {stats.pendingPosts} post{stats.pendingPosts !== 1 && "s"} waiting for your review.
              </p>
            </div>
            <Link
              href="/client/review"
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
            >
              Review Now
            </Link>
          </div>
        </div>
      )}

      {/* Campaigns Overview */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Your Campaigns</h2>
          <Link
            href="/client/campaigns"
            className="text-sm text-primary hover:underline"
          >
            View all
          </Link>
        </div>
        {stats.campaigns.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No campaigns assigned to your organization yet.
          </p>
        ) : (
          <div className="space-y-3">
            {stats.campaigns.slice(0, 5).map((campaign) => (
              <Link
                key={campaign.id}
                href={`/client/campaigns/${campaign.id}`}
                className="block p-4 rounded-lg border hover:bg-muted transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{campaign.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {campaign.campaignKols.length} KOLs assigned
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-sm px-2 py-0.5 rounded ${
                        campaign.status === "ACTIVE"
                          ? "bg-teal-50 text-teal-700"
                          : campaign.status === "COMPLETED"
                          ? "bg-slate-100 text-slate-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {campaign.status}
                    </span>
                    <p className="text-sm text-muted-foreground mt-1">
                      {campaign.posts.length} posts
                    </p>
                  </div>
                </div>
                {/* Mini stats */}
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Impressions</p>
                    <p className="font-medium">
                      {formatNumber(
                        campaign.posts.reduce((s, p) => s + p.impressions, 0)
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Engagement</p>
                    <p className="font-medium">
                      {formatNumber(
                        campaign.posts.reduce(
                          (s, p) => s + p.likes + p.retweets + p.replies,
                          0
                        )
                      )}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
