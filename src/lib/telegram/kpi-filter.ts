import { db } from "@/lib/db";

interface DeliverableItem {
  type: "POST" | "THREAD" | "RETWEET" | "SPACE";
  required: number;
  completed: number;
}

interface KOLProgress {
  kolId: string;
  kolName: string;
  totalRequired: number;
  totalCompleted: number;
  percentage: number;
  metKpi: boolean;
  deliverables: DeliverableItem[];
}

interface ChatWithKPIStatus {
  id: string;
  telegramChatId: string;
  title: string | null;
  type: string;
  status: string;
  kolProgress: KOLProgress[];
  overallMetKpi: boolean; // True if ANY linked KOL has met KPI
  overallNotMetKpi: boolean; // True if ANY linked KOL has NOT met KPI
}

/**
 * Calculate KPI progress for a single KOL in a campaign
 */
export async function calculateKOLProgress(
  kolId: string,
  campaignId: string
): Promise<KOLProgress | null> {
  const campaignKol = await db.campaignKOL.findUnique({
    where: {
      campaignId_kolId: {
        campaignId,
        kolId,
      },
    },
    include: {
      kol: {
        select: {
          name: true,
          posts: {
            where: {
              campaignId,
              status: { in: ["POSTED", "VERIFIED"] },
            },
          },
        },
      },
    },
  });

  if (!campaignKol) {
    return null;
  }

  const deliverables = calculateDeliverables(
    campaignKol.kol.posts.map((p) => ({ type: p.type, status: p.status })),
    {
      posts: campaignKol.requiredPosts,
      threads: campaignKol.requiredThreads,
      retweets: campaignKol.requiredRetweets,
      spaces: campaignKol.requiredSpaces,
    }
  );

  const activeDeliverables = deliverables.filter((d) => d.required > 0);
  const totalRequired = activeDeliverables.reduce((sum, d) => sum + d.required, 0);
  const totalCompleted = activeDeliverables.reduce(
    (sum, d) => sum + Math.min(d.completed, d.required),
    0
  );
  const percentage = totalRequired > 0 ? Math.round((totalCompleted / totalRequired) * 100) : 0;

  return {
    kolId,
    kolName: campaignKol.kol.name,
    totalRequired,
    totalCompleted,
    percentage,
    metKpi: totalRequired > 0 && percentage >= 100,
    deliverables: activeDeliverables,
  };
}

/**
 * Get all chats filtered by KPI status for a campaign
 */
export async function getChatsFilteredByKPI(
  organizationId: string,
  campaignId: string,
  filter: "all" | "met_kpi" | "not_met_kpi"
): Promise<ChatWithKPIStatus[]> {
  // Get all active chats with their KOL links
  const chats = await db.telegramChat.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
      // Only include chats that have KOLs linked
      kolLinks: {
        some: {},
      },
    },
    include: {
      kolLinks: {
        include: {
          kol: {
            include: {
              campaignKols: {
                where: { campaignId },
              },
              posts: {
                where: {
                  campaignId,
                  status: { in: ["POSTED", "VERIFIED"] },
                },
              },
            },
          },
        },
      },
    },
  });

  // Calculate KPI status for each chat
  const chatsWithKPI: ChatWithKPIStatus[] = chats.map((chat) => {
    const kolProgress: KOLProgress[] = [];
    let hasAnyKolInCampaign = false;
    let anyMetKpi = false;
    let anyNotMetKpi = false;

    for (const link of chat.kolLinks) {
      const campaignKol = link.kol.campaignKols[0];
      if (!campaignKol) continue;

      hasAnyKolInCampaign = true;

      const deliverables = calculateDeliverables(
        link.kol.posts.map((p) => ({ type: p.type, status: p.status })),
        {
          posts: campaignKol.requiredPosts,
          threads: campaignKol.requiredThreads,
          retweets: campaignKol.requiredRetweets,
          spaces: campaignKol.requiredSpaces,
        }
      );

      const activeDeliverables = deliverables.filter((d) => d.required > 0);
      const totalRequired = activeDeliverables.reduce((sum, d) => sum + d.required, 0);
      const totalCompleted = activeDeliverables.reduce(
        (sum, d) => sum + Math.min(d.completed, d.required),
        0
      );
      const percentage = totalRequired > 0 ? Math.round((totalCompleted / totalRequired) * 100) : 0;
      const metKpi = totalRequired > 0 && percentage >= 100;

      if (metKpi) anyMetKpi = true;
      else anyNotMetKpi = true;

      kolProgress.push({
        kolId: link.kol.id,
        kolName: link.kol.name,
        totalRequired,
        totalCompleted,
        percentage,
        metKpi,
        deliverables: activeDeliverables,
      });
    }

    return {
      id: chat.id,
      telegramChatId: chat.telegramChatId,
      title: chat.title,
      type: chat.type,
      status: chat.status,
      kolProgress,
      overallMetKpi: hasAnyKolInCampaign && anyMetKpi,
      overallNotMetKpi: hasAnyKolInCampaign && anyNotMetKpi,
    };
  });

  // Apply filter
  if (filter === "met_kpi") {
    return chatsWithKPI.filter((chat) => chat.overallMetKpi);
  }
  if (filter === "not_met_kpi") {
    return chatsWithKPI.filter((chat) => chat.overallNotMetKpi);
  }

  return chatsWithKPI;
}

/**
 * Get broadcast target preview - returns summary of chats matching filter
 */
export async function getBroadcastTargetPreview(
  organizationId: string,
  filterType: "all" | "met_kpi" | "not_met_kpi" | "campaign",
  campaignId?: string
): Promise<{
  totalChats: number;
  chats: Array<{
    id: string;
    title: string | null;
    linkedKols: number;
  }>;
}> {
  if (filterType === "all") {
    const chats = await db.telegramChat.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
      },
      include: {
        _count: {
          select: { kolLinks: true },
        },
      },
    });

    return {
      totalChats: chats.length,
      chats: chats.map((c) => ({
        id: c.id,
        title: c.title,
        linkedKols: c._count.kolLinks,
      })),
    };
  }

  if (!campaignId) {
    return { totalChats: 0, chats: [] };
  }

  const filteredChats = await getChatsFilteredByKPI(organizationId, campaignId, filterType as "all" | "met_kpi" | "not_met_kpi");

  return {
    totalChats: filteredChats.length,
    chats: filteredChats.map((c) => ({
      id: c.id,
      title: c.title,
      linkedKols: c.kolProgress.length,
    })),
  };
}

// Helper function - same logic as in deliverables-progress.tsx
function calculateDeliverables(
  posts: { type: string | null; status: string | null }[],
  required: { posts: number; threads: number; retweets: number; spaces: number }
): DeliverableItem[] {
  const countedStatuses = ["POSTED", "VERIFIED"];

  const counts = {
    POST: posts.filter((p) => p.type === "POST" && p.status && countedStatuses.includes(p.status))
      .length,
    THREAD: posts.filter(
      (p) => p.type === "THREAD" && p.status && countedStatuses.includes(p.status)
    ).length,
    RETWEET: posts.filter(
      (p) => p.type === "RETWEET" && p.status && countedStatuses.includes(p.status)
    ).length,
    SPACE: posts.filter((p) => p.type === "SPACE" && p.status && countedStatuses.includes(p.status))
      .length,
  };

  return [
    { type: "POST", required: required.posts, completed: counts.POST },
    { type: "THREAD", required: required.threads, completed: counts.THREAD },
    { type: "RETWEET", required: required.retweets, completed: counts.RETWEET },
    { type: "SPACE", required: required.spaces, completed: counts.SPACE },
  ];
}
