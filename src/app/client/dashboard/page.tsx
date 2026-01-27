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

    // Generate mock trend data (in real app, this would come from snapshots)
    const trendData = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return {
        date: date.toLocaleDateString("en-US", { weekday: "short" }),
        impressions: Math.floor(totalImpressions / 7 * (0.8 + Math.random() * 0.4)),
        engagement: Math.floor(totalEngagement / 7 * (0.8 + Math.random() * 0.4)),
      };
    });

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
    };
  }
}

export default async function ClientDashboard() {
  const session = await auth();
  if (!session?.user) return null;

  const stats = await getClientStats(session.user.organizationId);

  return (
    <div className="space-y-6">
      {/* Pending Approvals Alert */}
      {stats.pendingPosts > 0 && (
        <Card className="border-amber-200 dark:border-amber-800 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
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

      {/* Portfolio Health KPIs */}
      <ClientPortfolioHealth
        totalImpressions={stats.totalImpressions}
        totalEngagement={stats.totalEngagement}
        engagementRate={stats.engagementRate}
        publishedPosts={stats.postedPosts}
        totalPosts={stats.totalPosts}
      />

      {/* Campaign Summary Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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

              return (
                <Link
                  key={campaign.id}
                  href={`/client/campaigns/${campaign.id}`}
                  className="block group"
                >
                  <Card className="h-full hover:shadow-lg hover:border-primary/50 transition-all">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base group-hover:text-primary transition-colors line-clamp-1">
                          {campaign.name}
                        </CardTitle>
                        <Badge
                          variant={
                            campaign.status === "ACTIVE" ? "default" : "secondary"
                          }
                          className={
                            campaign.status === "ACTIVE" ? "bg-primary" : ""
                          }
                        >
                          {campaign.status}
                        </Badge>
                      </div>
                      {pendingCount > 0 && (
                        <Badge
                          variant="outline"
                          className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30 w-fit"
                        >
                          {pendingCount} pending review
                        </Badge>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground mb-3">
                        {campaign.campaignKols.length} KOLs &bull;{" "}
                        {campaign.posts.length} posts
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Impressions
                          </p>
                          <p className="font-semibold">
                            {formatNumber(campaignImpressions)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Engagement
                          </p>
                          <p className="font-semibold">
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
      </div>

      {/* Content Performance & KOL Leaderboard Row */}
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

      {/* Engagement Trends & Activity Feed Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ClientEngagementTrends data={stats.trendData} />
        <ClientActivityFeed activities={stats.recentActivities} />
      </div>
    </div>
  );
}
