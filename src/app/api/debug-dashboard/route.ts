import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCurrency, formatNumber, getTimeOfDayGreeting } from "@/lib/utils";

// This simulates exactly what the agency dashboard does
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

  const totalImpressions = posts.reduce((sum, p) => sum + p.impressions, 0);
  const totalLikes = posts.reduce((sum, p) => sum + p.likes, 0);
  const totalRetweets = posts.reduce((sum, p) => sum + p.retweets, 0);
  const totalReplies = posts.reduce((sum, p) => sum + p.replies, 0);

  const postsWithMetrics = posts.filter(p => p.impressions > 0);
  const avgEngagementRate = postsWithMetrics.length > 0
    ? postsWithMetrics.reduce((sum, p) => sum + p.engagementRate, 0) / postsWithMetrics.length
    : 0;

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
    pendingPosts,
  };
}

export async function GET() {
  const result: Record<string, unknown> = { timestamp: new Date().toISOString() };

  try {
    const session = await auth();
    result.sessionExists = !!session;
    result.sessionUser = session?.user ? {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      organizationId: session.user.organizationId,
      organizationType: session.user.organizationType,
    } : null;

    if (!session?.user) {
      result.error = "No session";
      return NextResponse.json(result);
    }

    // Test the greeting function
    try {
      result.greeting = getTimeOfDayGreeting();
    } catch (e) {
      result.greetingError = e instanceof Error ? e.message : String(e);
    }

    // Test formatNumber
    try {
      result.formatTest = formatNumber(1234567);
    } catch (e) {
      result.formatError = e instanceof Error ? e.message : String(e);
    }

    // Test dashboard stats
    try {
      const stats = await getDashboardStats(session.user.organizationId);
      result.stats = stats;
    } catch (e) {
      result.statsError = e instanceof Error ? `${e.message}\n${e.stack}` : String(e);
    }

  } catch (e) {
    result.topLevelError = e instanceof Error ? `${e.message}\n${e.stack}` : String(e);
  }

  return NextResponse.json(result);
}
