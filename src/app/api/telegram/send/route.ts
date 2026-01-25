import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { TelegramClient } from "@/lib/telegram/client";
import { telegramSendMessageSchema, telegramSendToKolSchema } from "@/lib/validations";

// POST - Send message to a chat or KOL
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    // Determine if sending to chat or KOL
    if (body.chatId) {
      return await sendToChat(session.user.organizationId, org.telegramBotToken, body);
    } else if (body.kolId) {
      return await sendToKol(session.user.organizationId, org.telegramBotToken, body);
    } else {
      return NextResponse.json(
        { error: "Either chatId or kolId is required" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error sending telegram message:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}

async function sendToChat(
  organizationId: string,
  botToken: string,
  body: unknown
) {
  const validatedData = telegramSendMessageSchema.parse(body);

  // Verify chat belongs to organization
  const chat = await db.telegramChat.findFirst({
    where: {
      id: validatedData.chatId,
      organizationId,
      status: "ACTIVE",
    },
  });

  if (!chat) {
    return NextResponse.json(
      { error: "Chat not found or not active" },
      { status: 404 }
    );
  }

  // Send message via Telegram API
  const client = new TelegramClient(botToken);
  const result = await client.sendMessage(chat.telegramChatId, validatedData.content);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.description || "Failed to send message" },
      { status: 400 }
    );
  }

  // Store outbound message in database
  const message = await db.telegramGroupMessage.create({
    data: {
      chatId: chat.id,
      telegramMessageId: result.result?.message_id?.toString(),
      content: validatedData.content,
      direction: "OUTBOUND",
      senderName: "Bot",
      timestamp: new Date(),
    },
  });

  return NextResponse.json({
    success: true,
    message: {
      id: message.id,
      content: message.content,
      timestamp: message.timestamp,
    },
  });
}

async function sendToKol(
  organizationId: string,
  botToken: string,
  body: unknown
) {
  const validatedData = telegramSendToKolSchema.parse(body);

  // Find KOL and their telegram username
  const kol = await db.kOL.findFirst({
    where: {
      id: validatedData.kolId,
      organizationId,
    },
    select: {
      id: true,
      name: true,
      telegramUsername: true,
    },
  });

  if (!kol) {
    return NextResponse.json({ error: "KOL not found" }, { status: 404 });
  }

  if (!kol.telegramUsername) {
    return NextResponse.json(
      { error: "KOL does not have a Telegram username set in their profile" },
      { status: 400 }
    );
  }

  console.log(`[Telegram Send] Looking for KOL link: kolId=${kol.id}, username=${kol.telegramUsername}`);

  // First, check if we have any telegram user ID for this KOL (from groups or DMs)
  // Prioritize private chats over group chats
  let anyKolLink = await db.telegramChatKOL.findFirst({
    where: {
      kolId: kol.id,
      telegramUserId: { not: null },
      chat: {
        organizationId,
        type: "PRIVATE",
      },
    },
    include: {
      chat: true,
    },
  });

  // If no private chat link, try any chat type
  if (!anyKolLink) {
    anyKolLink = await db.telegramChatKOL.findFirst({
      where: {
        kolId: kol.id,
        telegramUserId: { not: null },
        chat: {
          organizationId,
        },
      },
      include: {
        chat: true,
      },
    });
  }

  console.log(`[Telegram Send] Found KOL link:`, anyKolLink ? `chatType=${anyKolLink.chat.type}, telegramUserId=${anyKolLink.telegramUserId}` : 'null');

  const client = new TelegramClient(botToken);

  // Try to send DM if we have their user ID
  if (anyKolLink?.telegramUserId) {
    const result = await client.sendMessage(
      parseInt(anyKolLink.telegramUserId),
      validatedData.content
    );

    if (result.ok) {
      // Store in TelegramMessage (for 1:1 KOL messages)
      const message = await db.telegramMessage.create({
        data: {
          kolId: kol.id,
          telegramChatId: anyKolLink.telegramUserId,
          telegramMessageId: result.result?.message_id?.toString(),
          content: validatedData.content,
          direction: "OUTBOUND",
          senderName: "Bot",
          timestamp: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: {
          id: message.id,
          content: message.content,
          timestamp: message.timestamp,
        },
        sentVia: "dm",
      });
    }

    console.log(`[Telegram Send] DM failed: ${result.description}, trying group fallback`);
  }

  // DM failed or no user ID - try to send to a group they're in
  const groupLink = await db.telegramChatKOL.findFirst({
    where: {
      kolId: kol.id,
      chat: {
        organizationId,
        type: { in: ["GROUP", "SUPERGROUP"] },
        status: "ACTIVE",
      },
    },
    include: {
      chat: true,
    },
  });

  if (groupLink) {
    const result = await client.sendMessage(
      groupLink.chat.telegramChatId,
      `@${kol.telegramUsername} ${validatedData.content}`
    );

    if (result.ok) {
      // Store in TelegramGroupMessage
      const message = await db.telegramGroupMessage.create({
        data: {
          chatId: groupLink.chat.id,
          telegramMessageId: result.result?.message_id?.toString(),
          content: validatedData.content,
          direction: "OUTBOUND",
          senderName: "Bot",
          timestamp: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: {
          id: message.id,
          content: message.content,
          timestamp: message.timestamp,
        },
        sentVia: "group",
        note: "Message sent to group (DM not available - user needs to /start the bot for direct messages)",
      });
    }
  }

  // No way to reach this KOL
  return NextResponse.json(
    {
      error:
        "Cannot reach this KOL. They need to either send /start to the bot or be in a group with the bot.",
    },
    { status: 400 }
  );
}
