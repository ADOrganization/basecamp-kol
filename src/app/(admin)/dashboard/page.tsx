import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAgencyContext } from "@/lib/get-agency-context";
import {
  PortfolioHealth,
  CampaignCommandCenter,
  ContentPerformance,
  KOLLeaderboard,
  FinancialSummary,
  ActivityFeed,
} from "@/components/dashboard";

// Helper to count posts by type
function countByType(posts: { type: string | null }[]) {
  return {
    posts: posts.filter(p => !p.type || p.type === 'POST').length,
    threads: posts.filter(p => p.type === 'THREAD').length,
    retweets: posts.filter(p => p.type === 'RETWEET').length,
    spaces: posts.filter(p => p.type === 'SPACE').length,
  };
}

// Calculate campaign health based on time vs deliverable progress
function getCampaignHealth(
  startDate: Date | null,
  endDate: Date | null,
  deliverableProgress: number
): 'healthy' | 'warning' | 'critical' {
  if (!startDate || !endDate) return 'healthy';

  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (now < start) return 'healthy';
  if (now > end) return deliverableProgress >= 100 ? 'healthy' : 'critical';

  const totalDays = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const daysPassed = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  const timeProgress = (daysPassed / totalDays) * 100;

  const gap = timeProgress - deliverableProgress;

  if (gap > 25) return 'critical';
  if (gap > 15) return 'warning';
  return 'healthy';
}

async function getDashboardStats(organizationId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Fetch all data in parallel
  const [
    allKols,
    activeKols,
    activeCampaigns,
    allPosts,
    postsThisMonth,
    postsLastMonth,
    pendingReviewPosts,
    payments,
    recentPosts,
    recentPayments,
    followerSnapshots,
  ] = await Promise.all([
    // All KOLs
    db.kOL.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        twitterHandle: true,
        avatarUrl: true,
        followersCount: true,
        avgEngagementRate: true,
        tier: true,
        status: true,
      },
    }),
    // Active KOLs
    db.kOL.count({
      where: { organizationId, status: 'ACTIVE' },
    }),
    // Active campaigns with KOLs and posts
    db.campaign.findMany({
      where: { agencyId: organizationId, status: 'ACTIVE' },
      include: {
        campaignKols: {
          include: {
            kol: {
              select: {
                id: true,
                name: true,
                twitterHandle: true,
                avatarUrl: true,
                ratePerPost: true,
                ratePerThread: true,
                ratePerRetweet: true,
                ratePerSpace: true,
              },
            },
          },
        },
        posts: {
          where: { status: { in: ['POSTED', 'VERIFIED'] } },
          select: { type: true, kolId: true },
        },
      },
      orderBy: { endDate: 'asc' },
    }),
    // All completed posts for metrics
    db.post.findMany({
      where: {
        campaign: { agencyId: organizationId },
        status: { in: ['POSTED', 'VERIFIED'] },
      },
      select: {
        id: true,
        type: true,
        impressions: true,
        likes: true,
        retweets: true,
        replies: true,
        quotes: true,
        bookmarks: true,
        engagementRate: true,
        content: true,
        tweetUrl: true,
        hasKeywordMatch: true,
        kolId: true,
        kol: {
          select: { name: true, twitterHandle: true, avatarUrl: true },
        },
        campaign: {
          select: { name: true },
        },
      },
      orderBy: { engagementRate: 'desc' },
    }),
    // Posts this month
    db.post.count({
      where: {
        campaign: { agencyId: organizationId },
        status: { in: ['POSTED', 'VERIFIED'] },
        postedAt: { gte: startOfMonth },
      },
    }),
    // Posts last month
    db.post.count({
      where: {
        campaign: { agencyId: organizationId },
        status: { in: ['POSTED', 'VERIFIED'] },
        postedAt: { gte: startOfLastMonth, lt: startOfMonth },
      },
    }),
    // Pending review posts
    db.post.count({
      where: {
        campaign: { agencyId: organizationId },
        status: { in: ['PENDING_APPROVAL', 'DRAFT'] },
        hiddenFromReview: false,
      },
    }),
    // All payments
    db.payment.findMany({
      where: { kol: { organizationId } },
      select: {
        id: true,
        amount: true,
        status: true,
        paidAt: true,
        createdAt: true,
        kol: {
          select: { name: true, avatarUrl: true },
        },
      },
    }),
    // Recent posts (activity feed)
    db.post.findMany({
      where: {
        campaign: { agencyId: organizationId },
        createdAt: { gte: twentyFourHoursAgo },
      },
      include: {
        kol: { select: { name: true, avatarUrl: true } },
        campaign: { select: { name: true, id: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    // Recent payments (activity feed)
    db.payment.findMany({
      where: {
        kol: { organizationId },
        status: 'COMPLETED',
        paidAt: { gte: twentyFourHoursAgo },
      },
      include: {
        kol: { select: { name: true, avatarUrl: true } },
      },
      orderBy: { paidAt: 'desc' },
      take: 10,
    }),
    // Follower snapshots for growth calculation
    db.kOLFollowerSnapshot.findMany({
      where: {
        kol: { organizationId },
        capturedAt: { gte: thirtyDaysAgo },
      },
      select: {
        kolId: true,
        followersChange: true,
        followersCount: true,
        capturedAt: true,
      },
      orderBy: { capturedAt: 'desc' },
    }),
  ]);

  // === PORTFOLIO HEALTH ===
  const networkReach = allKols.reduce((sum, k) => sum + k.followersCount, 0);
  const activeKolsWithEngagement = allKols.filter(k => k.status === 'ACTIVE' && k.avgEngagementRate > 0);
  const weightedEngagement = activeKolsWithEngagement.length > 0
    ? activeKolsWithEngagement.reduce((acc, kol) =>
        acc + (kol.avgEngagementRate * kol.followersCount), 0
      ) / activeKolsWithEngagement.reduce((acc, kol) => acc + kol.followersCount, 0)
    : 0;

  // === CAMPAIGN COMMAND CENTER ===
  const campaignData = activeCampaigns.map(campaign => {
    // Calculate total required and completed deliverables
    const totalRequired = { posts: 0, threads: 0, retweets: 0, spaces: 0 };
    const totalCompleted = { posts: 0, threads: 0, retweets: 0, spaces: 0 };

    campaign.campaignKols.forEach(ck => {
      totalRequired.posts += ck.requiredPosts;
      totalRequired.threads += ck.requiredThreads;
      totalRequired.retweets += ck.requiredRetweets;
      totalRequired.spaces += ck.requiredSpaces;

      const kolPosts = campaign.posts.filter(p => p.kolId === ck.kolId);
      const completed = countByType(kolPosts);
      totalCompleted.posts += Math.min(completed.posts, ck.requiredPosts);
      totalCompleted.threads += Math.min(completed.threads, ck.requiredThreads);
      totalCompleted.retweets += Math.min(completed.retweets, ck.requiredRetweets);
      totalCompleted.spaces += Math.min(completed.spaces, ck.requiredSpaces);
    });

    const totalReq = totalRequired.posts + totalRequired.threads + totalRequired.retweets + totalRequired.spaces;
    const totalComp = totalCompleted.posts + totalCompleted.threads + totalCompleted.retweets + totalCompleted.spaces;
    const progress = totalReq > 0 ? (totalComp / totalReq) * 100 : 0;

    const allocatedBudget = campaign.campaignKols.reduce((sum, ck) => sum + ck.assignedBudget, 0);

    return {
      id: campaign.id,
      name: campaign.name,
      totalBudget: campaign.totalBudget,
      allocatedBudget,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      health: getCampaignHealth(campaign.startDate, campaign.endDate, progress),
      deliverables: {
        required: totalRequired,
        completed: totalCompleted,
      },
      kolCount: campaign.campaignKols.length,
    };
  });

  const totalBudget = activeCampaigns.reduce((sum, c) => sum + c.totalBudget, 0);
  const allocatedBudget = campaignData.reduce((sum, c) => sum + c.allocatedBudget, 0);
  const paidOut = payments.filter(p => p.status === 'COMPLETED').reduce((sum, p) => sum + p.amount, 0);

  // === CONTENT PERFORMANCE ===
  // Top posts by engagement rate (minimum 100 impressions for meaningful rate)
  const topPosts = allPosts
    .filter(p => p.impressions >= 100)
    .slice(0, 5)
    .map(p => ({
      id: p.id,
      content: p.content,
      tweetUrl: p.tweetUrl,
      engagementRate: p.engagementRate,
      impressions: p.impressions,
      likes: p.likes,
      retweets: p.retweets,
      kol: p.kol,
      campaign: p.campaign,
    }));

  // Content type breakdown
  const contentTypeCounts = {
    POST: allPosts.filter(p => !p.type || p.type === 'POST').length,
    THREAD: allPosts.filter(p => p.type === 'THREAD').length,
    RETWEET: allPosts.filter(p => p.type === 'RETWEET').length,
    SPACE: allPosts.filter(p => p.type === 'SPACE').length,
  };

  const contentTypeData = [
    { name: 'Posts', value: contentTypeCounts.POST, color: '#3b82f6' },
    { name: 'Threads', value: contentTypeCounts.THREAD, color: '#8b5cf6' },
    { name: 'Retweets', value: contentTypeCounts.RETWEET, color: '#14b8a6' },
    { name: 'Spaces', value: contentTypeCounts.SPACE, color: '#f59e0b' },
  ].filter(d => d.value > 0);

  // Keyword match rate
  const keywordMatchCount = allPosts.filter(p => p.hasKeywordMatch).length;
  const keywordMatchRate = allPosts.length > 0 ? (keywordMatchCount / allPosts.length) * 100 : 0;

  // Aggregate performance metrics (diversified beyond just engagement rate)
  const totalImpressions = allPosts.reduce((sum, p) => sum + p.impressions, 0);
  const totalLikes = allPosts.reduce((sum, p) => sum + p.likes, 0);
  const totalRetweets = allPosts.reduce((sum, p) => sum + p.retweets, 0);
  const totalReplies = allPosts.reduce((sum, p) => sum + p.replies, 0);
  const totalQuotes = allPosts.reduce((sum, p) => sum + (p.quotes || 0), 0);
  const totalBookmarks = allPosts.reduce((sum, p) => sum + (p.bookmarks || 0), 0);
  const totalEngagements = totalLikes + totalRetweets + totalReplies + totalQuotes + totalBookmarks;
  const avgEngagementRate = allPosts.length > 0
    ? allPosts.reduce((sum, p) => sum + p.engagementRate, 0) / allPosts.length
    : 0;

  // === KOL LEADERBOARD ===
  // Top performers by engagement rate
  const topPerformers = allKols
    .filter(k => k.status === 'ACTIVE' && k.avgEngagementRate > 0)
    .sort((a, b) => b.avgEngagementRate - a.avgEngagementRate)
    .slice(0, 5);

  // Pending deliverables
  const pendingDeliverables: {
    kolId: string;
    kolName: string;
    kolHandle: string;
    kolAvatar: string | null;
    campaignName: string;
    campaignId: string;
    pending: { posts: number; threads: number; retweets: number; spaces: number };
  }[] = [];

  activeCampaigns.forEach(campaign => {
    campaign.campaignKols.forEach(ck => {
      const kolPosts = campaign.posts.filter(p => p.kolId === ck.kolId);
      const completed = countByType(kolPosts);

      const pending = {
        posts: Math.max(0, ck.requiredPosts - completed.posts),
        threads: Math.max(0, ck.requiredThreads - completed.threads),
        retweets: Math.max(0, ck.requiredRetweets - completed.retweets),
        spaces: Math.max(0, ck.requiredSpaces - completed.spaces),
      };

      const hasPending = pending.posts + pending.threads + pending.retweets + pending.spaces > 0;

      if (hasPending) {
        pendingDeliverables.push({
          kolId: ck.kol.id,
          kolName: ck.kol.name,
          kolHandle: ck.kol.twitterHandle,
          kolAvatar: ck.kol.avatarUrl,
          campaignName: campaign.name,
          campaignId: campaign.id,
          pending,
        });
      }
    });
  });

  // Inactive KOLs (no posts in 14 days)
  const kolsWithRecentPosts = new Set(
    allPosts.filter(p => p.kolId).map(p => p.kolId)
  );
  const inactiveKols = allKols
    .filter(k => k.status === 'ACTIVE' && !kolsWithRecentPosts.has(k.id))
    .slice(0, 5);

  // Follower growth leaders
  const followerGrowthByKol = new Map<string, number>();
  followerSnapshots.forEach(snap => {
    const current = followerGrowthByKol.get(snap.kolId) || 0;
    followerGrowthByKol.set(snap.kolId, current + snap.followersChange);
  });

  const followerGrowthLeaders = Array.from(followerGrowthByKol.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([kolId, growth]) => {
      const kol = allKols.find(k => k.id === kolId);
      return kol ? {
        id: kol.id,
        name: kol.name,
        twitterHandle: kol.twitterHandle,
        avatarUrl: kol.avatarUrl,
        followersGrowth: growth,
        currentFollowers: kol.followersCount,
      } : null;
    })
    .filter(Boolean) as {
      id: string;
      name: string;
      twitterHandle: string;
      avatarUrl: string | null;
      followersGrowth: number;
      currentFollowers: number;
    }[];

  // === FINANCIAL SUMMARY ===
  const paymentsByStatus = Object.entries(
    payments.reduce((acc, p) => {
      if (!acc[p.status]) acc[p.status] = { count: 0, amount: 0 };
      acc[p.status].count++;
      acc[p.status].amount += p.amount;
      return acc;
    }, {} as Record<string, { count: number; amount: number }>)
  ).map(([status, data]) => ({ status, ...data }));

  const pendingPayments = paymentsByStatus.find(p => p.status === 'PENDING') || { count: 0, amount: 0 };

  // CPM and CPE use totalImpressions and totalEngagements calculated in content performance section
  const cpm = totalImpressions > 0 ? (paidOut / 100) / (totalImpressions / 1000) : 0;
  const cpe = totalEngagements > 0 ? (paidOut / 100) / totalEngagements : 0;

  // Monthly spend (last 6 months)
  const monthlySpend = Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - i));
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const amount = payments
      .filter(p => p.status === 'COMPLETED' && p.paidAt &&
        new Date(p.paidAt) >= monthStart && new Date(p.paidAt) <= monthEnd)
      .reduce((sum, p) => sum + p.amount, 0);

    return {
      month: date.toLocaleDateString('en-US', { month: 'short' }),
      amount,
    };
  });

  // === ACTIVITY FEED ===
  const activities = [
    ...recentPosts.map(p => ({
      type: 'post' as const,
      id: p.id,
      content: p.content,
      tweetUrl: p.tweetUrl,
      createdAt: p.createdAt,
      status: p.status,
      kol: p.kol,
      campaign: p.campaign,
    })),
    ...recentPayments.map(p => ({
      type: 'payment' as const,
      id: p.id,
      amount: p.amount,
      paidAt: p.paidAt,
      kol: p.kol,
    })),
  ].sort((a, b) => {
    const aTime = a.type === 'post' ? new Date(a.createdAt).getTime() : (a.paidAt ? new Date(a.paidAt).getTime() : 0);
    const bTime = b.type === 'post' ? new Date(b.createdAt).getTime() : (b.paidAt ? new Date(b.paidAt).getTime() : 0);
    return bTime - aTime;
  });

  return {
    portfolioHealth: {
      networkReach,
      avgEngagementRate: weightedEngagement,
      activeKols,
      totalKols: allKols.length,
      pendingReviewCount: pendingReviewPosts,
    },
    campaignCommandCenter: {
      campaigns: campaignData,
      totalBudget,
      allocatedBudget,
      paidOut,
    },
    contentPerformance: {
      postsThisMonth,
      postsLastMonth,
      topPosts,
      contentTypeData,
      keywordMatchRate,
      totalPosts: allPosts.length,
      // Diversified metrics
      metrics: {
        totalImpressions,
        totalLikes,
        totalRetweets,
        totalReplies,
        totalQuotes,
        totalBookmarks,
        totalEngagements,
        avgEngagementRate,
      },
    },
    kolLeaderboard: {
      topPerformers,
      pendingDeliverables: pendingDeliverables.slice(0, 5),
      inactiveKols,
      followerGrowthLeaders,
    },
    financialSummary: {
      totalAllocated: allocatedBudget,
      totalPaid: paidOut,
      pendingPayments,
      cpm,
      cpe,
      paymentsByStatus,
      recentMonthlySpend: monthlySpend,
    },
    activities,
  };
}

export default async function AgencyDashboard() {
  const context = await getAgencyContext();
  if (!context) {
    redirect("/admin/login");
  }

  const stats = await getDashboardStats(context.organizationId);

  return (
    <div className="space-y-8">
      {/* Section 1: Portfolio Health */}
      <PortfolioHealth {...stats.portfolioHealth} />

      {/* Section 2: Campaign Command Center */}
      <CampaignCommandCenter {...stats.campaignCommandCenter} />

      {/* Section 3 & 4: Content Performance and KOL Leaderboard */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ContentPerformance {...stats.contentPerformance} />
        <KOLLeaderboard {...stats.kolLeaderboard} />
      </div>

      {/* Section 5 & 6: Financial Summary and Activity Feed */}
      <div className="grid gap-6 lg:grid-cols-2">
        <FinancialSummary {...stats.financialSummary} />
        <ActivityFeed activities={stats.activities} />
      </div>
    </div>
  );
}
