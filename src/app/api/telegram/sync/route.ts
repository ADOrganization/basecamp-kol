import { NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { TelegramClient, mapTelegramChatType } from "@/lib/telegram/client";

// POST - Manual sync to fetch bot's current groups
export async function POST() {
  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permission - admins bypass membership check
    if (!authContext.isAdmin) {
      const membership = await db.organizationMember.findFirst({
        where: {
          userId: authContext.userId,
          organizationId: authContext.organizationId,
          role: { in: ["OWNER", "ADMIN"] },
        },
      });

      if (!membership) {
        return NextResponse.json(
          { error: "You don't have permission to sync chats" },
          { status: 403 }
        );
      }
    }

    // Get organization with bot token and webhook secret
    const org = await db.organization.findUnique({
      where: { id: authContext.organizationId },
      select: { telegramBotToken: true, telegramWebhookSecret: true },
    });

    if (!org?.telegramBotToken) {
      return NextResponse.json(
        { error: "Telegram bot not configured" },
        { status: 400 }
      );
    }

    const client = new TelegramClient(org.telegramBotToken);

    // Check if webhook is active
    const webhookInfo = await client.getWebhookInfo();
    const hasActiveWebhook = webhookInfo.ok && webhookInfo.result?.url;

    // If webhook is active, temporarily disable it to use getUpdates
    if (hasActiveWebhook) {
      await client.deleteWebhook(false); // Don't drop pending updates
    }

    // Get recent updates from Telegram
    const updatesResult = await client.getUpdates({
      limit: 100,
      allowed_updates: ["my_chat_member", "message"],
    });

    // Re-register webhook if it was active
    if (hasActiveWebhook && org.telegramWebhookSecret) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
      if (baseUrl) {
        const webhookUrl = `${baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`}/api/telegram/webhook`;
        await client.setWebhook(webhookUrl, {
          secret_token: org.telegramWebhookSecret,
          allowed_updates: ["message", "my_chat_member", "chat_member"],
        });
      }
    }

    if (!updatesResult.ok || !updatesResult.result) {
      // Try to verify existing chats instead
      return await verifyExistingChats(authContext.organizationId, client);
    }

    let newChats = 0;
    let updatedChats = 0;

    for (const update of updatesResult.result) {
      if (update.my_chat_member) {
        const { chat, new_chat_member } = update.my_chat_member;
        const isActive =
          new_chat_member.status === "member" ||
          new_chat_member.status === "administrator";

        if (isActive && chat.type !== "private") {
          const result = await db.telegramChat.upsert({
            where: {
              organizationId_telegramChatId: {
                organizationId: authContext.organizationId,
                telegramChatId: chat.id.toString(),
              },
            },
            create: {
              organizationId: authContext.organizationId,
              telegramChatId: chat.id.toString(),
              title: chat.title || null,
              type: mapTelegramChatType(chat.type),
              username: chat.username || null,
              status: "ACTIVE",
              botJoinedAt: new Date(update.my_chat_member.date * 1000),
            },
            update: {
              title: chat.title || null,
              type: mapTelegramChatType(chat.type),
              username: chat.username || null,
              status: "ACTIVE",
            },
          });

          if (result) {
            // Check if it was created or updated based on createdAt vs updatedAt
            if (
              result.createdAt.getTime() === result.updatedAt.getTime() ||
              Date.now() - result.createdAt.getTime() < 1000
            ) {
              newChats++;
            } else {
              updatedChats++;
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      newChats,
      updatedChats,
      message: `Synced ${newChats} new chats and updated ${updatedChats} existing chats`,
    });
  } catch (error) {
    console.error("Error syncing telegram chats:", error);
    return NextResponse.json(
      { error: "Failed to sync telegram chats" },
      { status: 500 }
    );
  }
}

async function verifyExistingChats(
  organizationId: string,
  client: TelegramClient
) {
  // Get all active chats from database
  const chats = await db.telegramChat.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
    },
  });

  let verified = 0;
  let inactive = 0;

  for (const chat of chats) {
    try {
      const result = await client.getChat(chat.telegramChatId);

      if (result.ok && result.result) {
        // Update chat info
        await db.telegramChat.update({
          where: { id: chat.id },
          data: {
            title: result.result.title || chat.title,
            username: result.result.username || chat.username,
          },
        });
        verified++;
      } else {
        // Chat not accessible - might have been removed
        await db.telegramChat.update({
          where: { id: chat.id },
          data: { status: "LEFT" },
        });
        inactive++;
      }
    } catch {
      // Error fetching chat - continue with others
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return NextResponse.json({
    success: true,
    verified,
    inactive,
    message: `Verified ${verified} chats, marked ${inactive} as inactive`,
  });
}
