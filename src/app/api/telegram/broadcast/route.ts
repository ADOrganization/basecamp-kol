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

    // Get target chats based on filter
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

    // Create broadcast record
    const broadcast = await db.telegramBroadcast.create({
      data: {
        organizationId: session.user.organizationId,
        content: validatedData.content,
        filterType: validatedData.filterType,
        filterCampaignId: validatedData.filterCampaignId,
        targetCount: targetChats.length,
        status: "sending",
      },
    });

    // Send messages to all target chats
    const client = new TelegramClient(org.telegramBotToken);
    let sentCount = 0;
    let failedCount = 0;

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
  // Get all active chats
  const chats = await db.telegramChat.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
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
