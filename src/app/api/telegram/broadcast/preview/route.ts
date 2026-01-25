import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

// GET - Preview broadcast targets
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const targetType = searchParams.get("targetType") || "groups";
    const filterType = searchParams.get("filterType") || "all";
    const campaignId = searchParams.get("campaignId");

    if (targetType === "dms") {
      // Get KOLs for DM broadcast
      const kols = await getFilteredKolsForDm(
        session.user.organizationId,
        filterType,
        campaignId || undefined
      );

      return NextResponse.json({
        total: kols.length,
        kols: kols.map((k) => ({
          id: k.id,
          name: k.name,
          telegramUsername: k.telegramUsername,
        })),
      });
    } else {
      // Get groups for group broadcast
      const chats = await getFilteredChats(
        session.user.organizationId,
        filterType,
        campaignId || undefined
      );

      return NextResponse.json({
        total: chats.length,
        chats: chats.map((c) => ({
          id: c.id,
          title: c.title,
          linkedKols: c.kolLinks?.length || 0,
        })),
      });
    }
  } catch (error) {
    console.error("Error fetching broadcast preview:", error);
    return NextResponse.json(
      { error: "Failed to fetch preview" },
      { status: 500 }
    );
  }
}

async function getFilteredChats(
  organizationId: string,
  filterType: string,
  campaignId?: string
) {
  // Build where clause - exclude PRIVATE chats
  const where: Prisma.TelegramChatWhereInput = {
    organizationId,
    status: "ACTIVE",
    type: { not: "PRIVATE" },
  };

  const chats = await db.telegramChat.findMany({
    where,
    include: {
      kolLinks: {
        include: {
          kol: {
            include: {
              campaignKols: campaignId ? { where: { campaignId } } : true,
              posts: campaignId
                ? { where: { campaignId, status: "VERIFIED" } }
                : { where: { status: "VERIFIED" } },
            },
          },
        },
      },
    },
  });

  if (filterType === "all") {
    return chats;
  }

  if (filterType === "campaign" && campaignId) {
    return chats.filter((chat) =>
      chat.kolLinks.some((link) =>
        link.kol.campaignKols.some((ck) => ck.campaignId === campaignId)
      )
    );
  }

  if (filterType === "met_kpi" && campaignId) {
    return chats.filter((chat) =>
      chat.kolLinks.some((link) => {
        const campaignKol = link.kol.campaignKols.find(
          (ck) => ck.campaignId === campaignId
        );
        if (!campaignKol) return false;

        const requiredTotal =
          campaignKol.requiredPosts +
          campaignKol.requiredThreads +
          campaignKol.requiredRetweets +
          campaignKol.requiredSpaces;

        const completedPosts = link.kol.posts.filter(
          (p) => p.campaignId === campaignId
        ).length;

        return completedPosts >= requiredTotal;
      })
    );
  }

  if (filterType === "not_met_kpi" && campaignId) {
    return chats.filter((chat) =>
      chat.kolLinks.some((link) => {
        const campaignKol = link.kol.campaignKols.find(
          (ck) => ck.campaignId === campaignId
        );
        if (!campaignKol) return false;

        const requiredTotal =
          campaignKol.requiredPosts +
          campaignKol.requiredThreads +
          campaignKol.requiredRetweets +
          campaignKol.requiredSpaces;

        const completedPosts = link.kol.posts.filter(
          (p) => p.campaignId === campaignId
        ).length;

        return completedPosts < requiredTotal;
      })
    );
  }

  return chats;
}

async function getFilteredKolsForDm(
  organizationId: string,
  filterType: string,
  campaignId?: string
) {
  // Get all KOLs that have a private chat link (meaning they can receive DMs)
  const kols = await db.kOL.findMany({
    where: {
      organizationId,
      telegramChatLinks: {
        some: {
          telegramUserId: { not: null },
          chat: {
            type: "PRIVATE",
            status: "ACTIVE",
          },
        },
      },
    },
    include: {
      telegramChatLinks: {
        include: {
          chat: true,
        },
      },
      campaignKols: campaignId ? { where: { campaignId } } : true,
      posts: campaignId
        ? { where: { campaignId, status: "VERIFIED" } }
        : { where: { status: "VERIFIED" } },
    },
  });

  if (filterType === "all") {
    return kols;
  }

  if (filterType === "campaign" && campaignId) {
    return kols.filter((kol) =>
      kol.campaignKols.some((ck) => ck.campaignId === campaignId)
    );
  }

  if (filterType === "met_kpi" && campaignId) {
    return kols.filter((kol) => {
      const campaignKol = kol.campaignKols.find(
        (ck) => ck.campaignId === campaignId
      );
      if (!campaignKol) return false;

      const requiredTotal =
        campaignKol.requiredPosts +
        campaignKol.requiredThreads +
        campaignKol.requiredRetweets +
        campaignKol.requiredSpaces;

      const completedPosts = kol.posts.filter(
        (p) => p.campaignId === campaignId
      ).length;

      return completedPosts >= requiredTotal;
    });
  }

  if (filterType === "not_met_kpi" && campaignId) {
    return kols.filter((kol) => {
      const campaignKol = kol.campaignKols.find(
        (ck) => ck.campaignId === campaignId
      );
      if (!campaignKol) return false;

      const requiredTotal =
        campaignKol.requiredPosts +
        campaignKol.requiredThreads +
        campaignKol.requiredRetweets +
        campaignKol.requiredSpaces;

      const completedPosts = kol.posts.filter(
        (p) => p.campaignId === campaignId
      ).length;

      return completedPosts < requiredTotal;
    });
  }

  return kols;
}
