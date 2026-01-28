import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatNumber } from "@/lib/utils";
import {
  Megaphone,
  Clock,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ClientPortfolioHealth,
  ClientContentPerformance,
  ClientKOLLeaderboard,
  ClientActivityFeed,
  ClientEngagementTrends,
} from "@/components/client/dashboard";

interface KOLStats {
  id: string;
  name: string;
  twitterHandle: string;
  avatarUrl: string | null;
  totalImpressions: number;
  totalEngagement: number;
  totalPosts: number;
}

interface ActivityItem {
  id: string;
  type: "POST_CREATED" | "POST_APPROVED" | "POST_REJECTED" | "POST_PUBLISHED" | "POST_PENDING";
  kolName: string;
  kolAvatar: string | null;
  campaignName: string;
  postContent?: string;
  timestamp: Date;
}

async function getClientStats(organizationId: string) {
  try {
    const campaigns = await db.campaign.findMany({
      where: {
        // Support both legacy clientId and new campaignClients junction table
        OR: [
          { clientId: organizationId },
          { campaignClients: { some: { clientId: organizationId } } },
        ],
      },
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

    const pendingPosts = campaigns.reduce(
      (sum, c) => sum + c.posts.filter((p) => p.status === "PENDING_APPROVAL").length,
      0
    );

    const approvedPosts = campaigns.reduce(
      (sum, c) => sum + c.posts.filter((p) => p.status === "APPROVED").length,
      0
    );

    const rejectedPosts = campaigns.reduce(
      (sum, c) => sum + c.posts.filter((p) => p.status === "REJECTED").length,
      0
    );

    const draftPosts = campaigns.reduce(
      (sum, c) => sum + c.posts.filter((p) => p.status === "DRAFT").length,
      0
    );

    // Calculate engagement rate
    const engagementRate = totalImpressions > 0
      ? ((totalEngagement / totalImpressions) * 100).toFixed(2)
      : "0.00";

    // Aggregate KOL stats
    const kolStatsMap = new Map<string, KOLStats>();
    campaigns.forEach((campaign) => {
      campaign.campaignKols.forEach((ck) => {
        const existing = kolStatsMap.get(ck.kol.id);
        const kolPosts = campaign.posts.filter((p) => p.kolId === ck.kol.id);
        const impressions = kolPosts.reduce((s, p) => s + p.impressions, 0);
        const engagement = kolPosts.reduce(
          (s, p) => s + p.likes + p.retweets + p.replies,
          0
        );

        if (existing) {
          existing.totalImpressions += impressions;
          existing.totalEngagement += engagement;
          existing.totalPosts += kolPosts.length;
        } else {
          kolStatsMap.set(ck.kol.id, {
            id: ck.kol.id,
            name: ck.kol.name,
            twitterHandle: ck.kol.twitterHandle,
            avatarUrl: ck.kol.avatarUrl,
            totalImpressions: impressions,
            totalEngagement: engagement,
            totalPosts: kolPosts.length,
          });
        }
      });
    });

    const kolStats = Array.from(kolStatsMap.values());

    // Build activity feed from recent posts
    const activities: ActivityItem[] = [];
    campaigns.forEach((campaign) => {
      campaign.posts.slice(0, 10).forEach((post) => {
        const kol = campaign.campaignKols.find((ck) => ck.kolId === post.kolId)?.kol;
        if (kol) {
          let activityType: ActivityItem["type"] = "POST_CREATED";
          if (post.status === "POSTED" || post.status === "VERIFIED") {
            activityType = "POST_PUBLISHED";
          } else if (post.status === "APPROVED") {
            activityType = "POST_APPROVED";
          } else if (post.status === "REJECTED") {
            activityType = "POST_REJECTED";
          } else if (post.status === "PENDING_APPROVAL") {
            activityType = "POST_PENDING";
          }

          activities.push({
            id: post.id,
            type: activityType,
            kolName: kol.name,
            kolAvatar: kol.avatarUrl,
            campaignName: campaign.name,
            postContent: post.content?.slice(0, 100) || undefined,
            timestamp: post.updatedAt,
          });
        }
      });
    });

    // Sort activities by timestamp and take top 8
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const recentActivities = activities.slice(0, 8);

    // Generate REAL trend data from actual post metrics by date
    // Group posts by day and calculate cumulative metrics
    const allPosts = campaigns.flatMap((c) => c.posts);
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Create a map of date -> metrics
    const dailyMetrics = new Map<string, { impressions: number; engagement: number }>();

    // Initialize all 7 days with zeros
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      const dateKey = date.toISOString().split("T")[0];
      dailyMetrics.set(dateKey, { impressions: 0, engagement: 0 });
    }

    // Aggregate metrics by post creation date
    allPosts.forEach((post) => {
      if (post.postedAt || post.createdAt) {
        const postDate = new Date(post.postedAt || post.createdAt);
        if (postDate >= sevenDaysAgo) {
          const dateKey = postDate.toISOString().split("T")[0];
          const existing = dailyMetrics.get(dateKey) || { impressions: 0, engagement: 0 };
          existing.impressions += post.impressions;
          existing.engagement += post.likes + post.retweets + post.replies;
          dailyMetrics.set(dateKey, existing);
        }
      }
    });

    // Convert to cumulative trend data (shows real growth over time)
    const sortedDates = Array.from(dailyMetrics.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    let cumulativeImpressions = 0;
    let cumulativeEngagement = 0;

    const trendData = sortedDates.map(([dateStr, metrics]) => {
      const date = new Date(dateStr);

      // Always use real data - no fabricated curves
      // If no recent activity, show honest zeros
      cumulativeImpressions += metrics.impressions;
      cumulativeEngagement += metrics.engagement;

      return {
        date: date.toLocaleDateString("en-US", { weekday: "short" }),
        impressions: cumulativeImpressions,
        engagement: cumulativeEngagement,
      };
    });

    // Calculate period-over-period changes (last 7 days vs previous 7 days)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const currentPeriodPosts = allPosts.filter((p) => {
      const d = new Date(p.postedAt || p.createdAt);
      return d >= sevenDaysAgo;
    });
    const previousPeriodPosts = allPosts.filter((p) => {
      const d = new Date(p.postedAt || p.createdAt);
      return d >= fourteenDaysAgo && d < sevenDaysAgo;
    });

    const currentImpressions = currentPeriodPosts.reduce((s, p) => s + p.impressions, 0);
    const prevImpressions = previousPeriodPosts.reduce((s, p) => s + p.impressions, 0);
    const currentEng = currentPeriodPosts.reduce((s, p) => s + p.likes + p.retweets + p.replies, 0);
    const prevEng = previousPeriodPosts.reduce((s, p) => s + p.likes + p.retweets + p.replies, 0);
    const currentRate = currentImpressions > 0 ? (currentEng / currentImpressions) * 100 : 0;
    const prevRate = prevImpressions > 0 ? (prevEng / prevImpressions) * 100 : 0;

    const calcChange = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const periodChanges = {
      impressions: calcChange(currentImpressions, prevImpressions),
      engagement: calcChange(currentEng, prevEng),
      rate: Math.round((currentRate - prevRate) * 10) / 10,
      posts: calcChange(currentPeriodPosts.length, previousPeriodPosts.length),
    };

    return {
      totalCampaigns: campaigns.length,
      activeCampaigns: activeCampaigns.length,
      totalPosts,
      postedPosts,
      totalImpressions,
      totalEngagement,
      pendingPosts,
      approvedPosts,
      rejectedPosts,
      draftPosts,
      campaigns,
      engagementRate,
      kolStats,
      recentActivities,
      trendData,
      periodChanges,
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
      pendingPosts: 0,
      approvedPosts: 0,
      rejectedPosts: 0,
      draftPosts: 0,
      campaigns: [],
      engagementRate: "0.00",
      kolStats: [],
      recentActivities: [],
      trendData: [],
      periodChanges: { impressions: 0, engagement: 0, rate: 0, posts: 0 },
    };
  }
}

export default async function ClientDashboard() {
  const session = await auth();
  if (!session?.user) return null;

  const stats = await getClientStats(session.user.organizationId);

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Campaign Dashboard</h1>
        <p className="text-muted-foreground">
          Track your campaign performance and KOL activity
        </p>
      </div>

      {/* Pending Approvals Alert */}
      {stats.pendingPosts > 0 && (
        <Card className="border-amber-200 dark:border-amber-800 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center shrink-0">
                  <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-amber-900 dark:text-amber-100">
                    {stats.pendingPosts} Post{stats.pendingPosts !== 1 ? "s" : ""} Awaiting Your Review
                  </h3>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Review and approve content before it goes live
                  </p>
                </div>
              </div>
              <Button asChild className="bg-amber-600 hover:bg-amber-700 shadow-sm">
                <Link href="/client/review">
                  Review Now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Portfolio Health KPIs */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Performance Overview</h2>
        <ClientPortfolioHealth
        totalImpressions={stats.totalImpressions}
        totalEngagement={stats.totalEngagement}
        engagementRate={stats.engagementRate}
        publishedPosts={stats.postedPosts}
        totalPosts={stats.totalPosts}
        impressionsChange={stats.periodChanges.impressions}
        engagementChange={stats.periodChanges.engagement}
        rateChange={stats.periodChanges.rate}
        postsChange={stats.periodChanges.posts}
      />
      </section>

      {/* Campaign Summary Cards */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Your Campaigns</h2>
          <Button variant="outline" size="sm" asChild>
            <Link href="/client/campaigns">
              View All
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {stats.campaigns.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center">
                <Megaphone className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  No campaigns assigned to your organization yet.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {stats.campaigns.slice(0, 6).map((campaign) => {
              const campaignImpressions = campaign.posts.reduce(
                (s, p) => s + p.impressions,
                0
              );
              const campaignEngagement = campaign.posts.reduce(
                (s, p) => s + p.likes + p.retweets + p.replies,
                0
              );
              const pendingCount = campaign.posts.filter(
                (p) => p.status === "PENDING_APPROVAL"
              ).length;
              const postedCount = campaign.posts.filter(
                (p) => p.status === "POSTED" || p.status === "VERIFIED"
              ).length;

              return (
                <Link
                  key={campaign.id}
                  href={`/client/campaigns/${campaign.id}`}
                  className="block group"
                >
                  <Card className="h-full hover:shadow-lg hover:border-primary/50 transition-all duration-200 shadow-sm">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors line-clamp-1">
                          {campaign.name}
                        </CardTitle>
                        <Badge
                          variant={campaign.status === "ACTIVE" ? "default" : "secondary"}
                          className={campaign.status === "ACTIVE" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                        >
                          {campaign.status}
                        </Badge>
                      </div>
                      {pendingCount > 0 && (
                        <Badge
                          variant="outline"
                          className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30 w-fit mt-2"
                        >
                          {pendingCount} pending review
                        </Badge>
                      )}
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="text-sm text-muted-foreground mb-4">
                        <span className="inline-flex items-center gap-1">
                          {campaign.campaignKols.length} KOLs
                        </span>
                        <span className="mx-2">•</span>
                        <span className="inline-flex items-center gap-1">
                          {postedCount} published
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">
                            Impressions
                          </p>
                          <p className="text-lg font-bold mt-1">
                            {formatNumber(campaignImpressions)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">
                            Engagement
                          </p>
                          <p className="text-lg font-bold mt-1">
                            {formatNumber(campaignEngagement)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Content Performance & KOL Leaderboard Row */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Content & KOL Insights</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <ClientContentPerformance
            published={stats.postedPosts}
            approved={stats.approvedPosts}
            pending={stats.pendingPosts}
            rejected={stats.rejectedPosts}
            draft={stats.draftPosts}
          />
          <ClientKOLLeaderboard kols={stats.kolStats} />
        </div>
      </section>

      {/* Engagement Trends & Activity Feed Row */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Trends & Activity</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <ClientEngagementTrends data={stats.trendData} />
          <ClientActivityFeed activities={stats.recentActivities} />
        </div>
      </section>
    </div>
  );
}
