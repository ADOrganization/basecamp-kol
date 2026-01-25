import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { TelegramClient } from "@/lib/telegram/client";
import { telegramBroadcastSchema } from "@/lib/validations";

// GET - List past broadcasts
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const broadcasts = await db.telegramBroadcast.findMany({
      where: { organizationId: session.user.organizationId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ broadcasts });
  } catch (error) {
    console.error("Error fetching broadcasts:", error);
    return NextResponse.json(
      { error: "Failed to fetch broadcasts" },
      { status: 500 }
    );
  }
}

// POST - Create and send broadcast
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permission
    const membership = await db.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId: session.user.organizationId,
        role: { in: ["OWNER", "ADMIN"] },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "You don't have permission to send broadcasts" },
        { status: 403 }
      );
    }

    // Get organization with bot token
    const org = await db.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { telegramBotToken: true },
    });

    if (!org?.telegramBotToken) {
      return NextResponse.json(
        { error: "Telegram bot not configured" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = telegramBroadcastSchema.parse(body);

    const targetType = validatedData.targetType || "groups";
    let targetCount = 0;
    let sentCount = 0;
    let failedCount = 0;

    const client = new TelegramClient(org.telegramBotToken);

    if (targetType === "dms") {
      // Get KOLs with private chats for DM broadcast
      const targetKols = await getFilteredKolsForDm(
        session.user.organizationId,
        validatedData.filterType,
        validatedData.filterCampaignId
      );

      if (targetKols.length === 0) {
        return NextResponse.json(
          { error: "No KOLs match the selected filter or have DM access" },
          { status: 400 }
        );
      }

      targetCount = targetKols.length;

      // Create broadcast record
      const broadcast = await db.telegramBroadcast.create({
        data: {
          organizationId: session.user.organizationId,
          content: validatedData.content,
          targetType: "dms",
          filterType: validatedData.filterType,
          filterCampaignId: validatedData.filterCampaignId,
          targetCount,
          status: "sending",
        },
      });

      // Send DMs to all target KOLs
      for (const kol of targetKols) {
        try {
          // Find the private chat for this KOL
          const privateChat = kol.telegramChatLinks.find(
            (link) => link.chat.type === "PRIVATE" && link.telegramUserId
          );

          if (!privateChat) {
            failedCount++;
            continue;
          }

          const result = await client.sendMessage(
            privateChat.chat.telegramChatId,
            validatedData.content
          );

          if (result.ok) {
            sentCount++;

            // Store outbound message
            await db.telegramMessage.create({
              data: {
                kolId: kol.id,
                telegramChatId: privateChat.chat.telegramChatId,
                telegramMessageId: result.result?.message_id?.toString(),
                content: validatedData.content,
                direction: "OUTBOUND",
                timestamp: new Date(),
              },
            });
          } else {
            failedCount++;
          }
        } catch {
          failedCount++;
        }

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Update broadcast with results
      const updatedBroadcast = await db.telegramBroadcast.update({
        where: { id: broadcast.id },
        data: {
          sentCount,
          failedCount,
          status: "completed",
          completedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        broadcast: updatedBroadcast,
      });
    }

    // Group broadcast (original logic)
    const targetChats = await getFilteredChats(
      session.user.organizationId,
      validatedData.filterType,
      validatedData.filterCampaignId
    );

    if (targetChats.length === 0) {
      return NextResponse.json(
        { error: "No chats match the selected filter" },
        { status: 400 }
      );
    }

    targetCount = targetChats.length;

    // Create broadcast record
    const broadcast = await db.telegramBroadcast.create({
      data: {
        organizationId: session.user.organizationId,
        content: validatedData.content,
        targetType: "groups",
        filterType: validatedData.filterType,
        filterCampaignId: validatedData.filterCampaignId,
        targetCount,
        status: "sending",
      },
    });

    // Send messages to all target chats
    for (const chat of targetChats) {
      try {
        const result = await client.sendMessage(chat.telegramChatId, validatedData.content);

        if (result.ok) {
          sentCount++;

          // Store outbound message
          await db.telegramGroupMessage.create({
            data: {
              chatId: chat.id,
              telegramMessageId: result.result?.message_id?.toString(),
              content: validatedData.content,
              direction: "OUTBOUND",
              senderName: "Broadcast",
              timestamp: new Date(),
            },
          });
        } else {
          failedCount++;
        }
      } catch {
        failedCount++;
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Update broadcast with results
    const updatedBroadcast = await db.telegramBroadcast.update({
      where: { id: broadcast.id },
      data: {
        sentCount,
        failedCount,
        status: "completed",
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      broadcast: updatedBroadcast,
    });
  } catch (error) {
    console.error("Error sending broadcast:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to send broadcast" },
      { status: 500 }
    );
  }
}

async function getFilteredChats(
  organizationId: string,
  filterType: string,
  campaignId?: string
) {
  // Get all active group chats (exclude PRIVATE for DMs)
  const chats = await db.telegramChat.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
      type: { not: "PRIVATE" },
    },
    include: {
      kolLinks: {
        include: {
          kol: {
            include: {
              campaignKols: campaignId
                ? { where: { campaignId } }
                : true,
              posts: campaignId
                ? {
                    where: {
                      campaignId,
                      status: "VERIFIED",
                    },
                  }
                : {
                    where: { status: "VERIFIED" },
                  },
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
    // Filter to chats with KOLs in this campaign
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
