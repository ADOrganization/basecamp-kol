import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { TelegramChatStatus, Prisma } from "@prisma/client";
import { getApiAuthContext } from "@/lib/api-auth";

// GET - List all telegram chats with filters
export async function GET(request: NextRequest) {
  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") as TelegramChatStatus | "all" | null;
    const hasKol = searchParams.get("hasKol");
    const campaignId = searchParams.get("campaignId");
    const kpiStatus = searchParams.get("kpiStatus");
    const search = searchParams.get("search");

    // Build where clause - exclude PRIVATE chats (those are for 1:1 conversations)
    const where: Prisma.TelegramChatWhereInput = {
      organizationId: authContext.organizationId,
      type: {
        not: "PRIVATE",
      },
    };

    // Filter by status
    if (status && status !== "all") {
      where.status = status;
    }

    // Filter by search
    if (search) {
      where.title = {
        contains: search,
        mode: "insensitive",
      };
    }

    // Filter by hasKol
    if (hasKol === "true") {
      where.kolLinks = {
        some: {},
      };
    } else if (hasKol === "false") {
      where.kolLinks = {
        none: {},
      };
    }

    // Get chats with related data
    const chats = await db.telegramChat.findMany({
      where,
      include: {
        kolLinks: {
          include: {
            kol: {
              include: {
                campaignKols: campaignId
                  ? {
                      where: { campaignId },
                      include: {
                        campaign: {
                          select: { id: true, name: true },
                        },
                      },
                    }
                  : {
                      include: {
                        campaign: {
                          select: { id: true, name: true },
                        },
                      },
                    },
              },
            },
          },
        },
        messages: {
          orderBy: { timestamp: "desc" },
          take: 1,
          select: {
            content: true,
            timestamp: true,
            senderName: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Calculate KPI progress for each chat if campaignId is provided
    let filteredChats = chats;

    if (campaignId && kpiStatus && kpiStatus !== "any") {
      filteredChats = chats.filter((chat) => {
        // Check if any linked KOL has the matching KPI status for this campaign
        return chat.kolLinks.some((link) => {
          const campaignKol = link.kol.campaignKols.find(
            (ck) => ck.campaignId === campaignId
          );
          if (!campaignKol) return false;

          const progress = calculateKPIProgress(campaignKol);
          const metKpi = progress.completed >= progress.total;

          if (kpiStatus === "met") return metKpi;
          if (kpiStatus === "not_met") return !metKpi;
          return true;
        });
      });
    }

    // Transform data for response
    const transformedChats = filteredChats.map((chat) => ({
      id: chat.id,
      telegramChatId: chat.telegramChatId,
      title: chat.title,
      type: chat.type,
      username: chat.username,
      status: chat.status,
      memberCount: chat.memberCount,
      botJoinedAt: chat.botJoinedAt,
      lastMessage: chat.messages[0] || null,
      kolLinks: chat.kolLinks.map((link) => ({
        id: link.id,
        kol: {
          id: link.kol.id,
          name: link.kol.name,
          twitterHandle: link.kol.twitterHandle,
          telegramUsername: link.kol.telegramUsername,
          avatarUrl: link.kol.avatarUrl,
        },
        campaignProgress: campaignId
          ? link.kol.campaignKols
              .filter((ck) => ck.campaignId === campaignId)
              .map((ck) => ({
                campaignId: ck.campaignId,
                campaignName: ck.campaign.name,
                ...calculateKPIProgress(ck),
              }))
          : link.kol.campaignKols.map((ck) => ({
              campaignId: ck.campaignId,
              campaignName: ck.campaign.name,
              ...calculateKPIProgress(ck),
            })),
      })),
    }));

    return NextResponse.json({
      chats: transformedChats,
      total: transformedChats.length,
    });
  } catch (error) {
    console.error("Error fetching telegram chats:", error);
    return NextResponse.json(
      { error: "Failed to fetch telegram chats" },
      { status: 500 }
    );
  }
}

interface CampaignKOLProgress {
  requiredPosts: number;
  requiredThreads: number;
  requiredRetweets: number;
  requiredSpaces: number;
}

function calculateKPIProgress(campaignKol: CampaignKOLProgress) {
  const total =
    campaignKol.requiredPosts +
    campaignKol.requiredThreads +
    campaignKol.requiredRetweets +
    campaignKol.requiredSpaces;

  // Note: Actual completion count would need to be calculated from posts
  // For now, returning the structure. Real implementation would count verified posts.
  return {
    total,
    completed: 0, // This would be calculated from actual posts
    percentage: total > 0 ? 0 : 100,
  };
}
