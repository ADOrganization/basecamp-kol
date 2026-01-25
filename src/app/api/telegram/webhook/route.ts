import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { TelegramClient, mapTelegramChatType } from "@/lib/telegram/client";
import type { TelegramUpdate, TelegramChatMemberUpdated, TelegramMessage } from "@/lib/telegram/types";

// Webhook handler - no auth required (verified by secret header)
export async function POST(request: NextRequest) {
  try {
    // Get the secret token from header
    const secretToken = request.headers.get("x-telegram-bot-api-secret-token");

    console.log("[Telegram Webhook] Received request, secret present:", !!secretToken);

    if (!secretToken) {
      console.log("[Telegram Webhook] Missing secret token");
      return NextResponse.json({ error: "Missing secret token" }, { status: 401 });
    }

    // Find organization by webhook secret
    const org = await db.organization.findFirst({
      where: { telegramWebhookSecret: secretToken },
      select: { id: true, telegramBotToken: true },
    });

    if (!org) {
      console.log("[Telegram Webhook] No org found for secret");
      return NextResponse.json({ error: "Invalid secret token" }, { status: 401 });
    }

    console.log("[Telegram Webhook] Found org:", org.id);

    const update: TelegramUpdate = await request.json();

    // Handle my_chat_member updates (bot added/removed from groups)
    if (update.my_chat_member) {
      await handleMyChatMemberUpdate(org.id, update.my_chat_member);
    }

    // Handle new messages in groups
    if (update.message) {
      await handleMessage(org.id, org.telegramBotToken, update.message);
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    // Still return 200 to prevent Telegram from retrying
    return NextResponse.json({ ok: true });
  }
}

async function handleMyChatMemberUpdate(
  organizationId: string,
  update: TelegramChatMemberUpdated
) {
  const { chat, new_chat_member } = update;
  const telegramChatId = chat.id.toString();

  // Check if bot was added or removed
  const botStatus = new_chat_member.status;
  const isActive = botStatus === "member" || botStatus === "administrator";
  const isRemoved = botStatus === "left" || botStatus === "kicked";

  if (isActive) {
    // Bot was added to a group - create or update chat record
    await db.telegramChat.upsert({
      where: {
        organizationId_telegramChatId: {
          organizationId,
          telegramChatId,
        },
      },
      create: {
        organizationId,
        telegramChatId,
        title: chat.title || null,
        type: mapTelegramChatType(chat.type),
        username: chat.username || null,
        status: "ACTIVE",
        botJoinedAt: new Date(),
      },
      update: {
        title: chat.title || null,
        type: mapTelegramChatType(chat.type),
        username: chat.username || null,
        status: "ACTIVE",
        botJoinedAt: new Date(),
        botLeftAt: null,
      },
    });
  } else if (isRemoved) {
    // Bot was removed - update status
    await db.telegramChat.updateMany({
      where: {
        organizationId,
        telegramChatId,
      },
      data: {
        status: botStatus === "kicked" ? "KICKED" : "LEFT",
        botLeftAt: new Date(),
      },
    });
  }
}

async function handleMessage(organizationId: string, botToken: string | null, message: TelegramMessage) {
  const chat = message.chat;

  // Handle private messages (DMs to the bot)
  if (chat.type === "private") {
    await handlePrivateMessage(organizationId, botToken, message);
    return;
  }

  // Only handle group/supergroup messages from here
  if (chat.type !== "group" && chat.type !== "supergroup") {
    return;
  }

  const telegramChatId = chat.id.toString();

  // Find or create the chat record
  let telegramChat = await db.telegramChat.findUnique({
    where: {
      organizationId_telegramChatId: {
        organizationId,
        telegramChatId,
      },
    },
  });

  if (!telegramChat) {
    // Create chat if it doesn't exist (bot might have been added before webhook was set up)
    telegramChat = await db.telegramChat.create({
      data: {
        organizationId,
        telegramChatId,
        title: chat.title || null,
        type: mapTelegramChatType(chat.type),
        username: chat.username || null,
        status: "ACTIVE",
      },
    });
  }

  // Skip if no text content
  const textContent = message.text || message.caption;
  if (!textContent) {
    return;
  }

  const senderUsername = message.from?.username;
  const senderTelegramId = message.from?.id?.toString();
  const senderName = message.from
    ? [message.from.first_name, message.from.last_name].filter(Boolean).join(" ")
    : null;

  // Check for /review command
  if (textContent.startsWith("/review")) {
    await handleReviewCommand(
      organizationId,
      botToken,
      telegramChat.id,
      chat.id,
      textContent,
      senderUsername,
      senderName
    );
    return;
  }

  // Store the message
  await db.telegramGroupMessage.create({
    data: {
      chatId: telegramChat.id,
      telegramMessageId: message.message_id.toString(),
      content: textContent,
      direction: "INBOUND",
      senderTelegramId,
      senderUsername: senderUsername || null,
      senderName,
      replyToMessageId: message.reply_to_message?.message_id?.toString() || null,
      timestamp: new Date(message.date * 1000),
    },
  });

  // Try to match sender to KOL if they have a username
  if (senderUsername) {
    await matchKolToChat(organizationId, telegramChat.id, senderUsername, senderTelegramId);
  }
}

async function handleReviewCommand(
  organizationId: string,
  botToken: string | null,
  chatId: string,
  telegramChatId: number,
  text: string,
  senderUsername: string | undefined,
  senderName: string | null
) {
  // Extract draft content (everything after /review)
  const draftContent = text.replace(/^\/review\s*/i, "").trim();

  // Helper to send response
  const sendResponse = async (message: string) => {
    if (!botToken) return;
    const client = new TelegramClient(botToken);
    await client.sendMessage(telegramChatId, message);
  };

  if (!draftContent) {
    await sendResponse(
      "Please include your draft content after the /review command.\n\n" +
      "Example:\n/review Check out this amazing project @ProjectHandle! The team is building something revolutionary in DeFi. #crypto"
    );
    return;
  }

  if (!senderUsername) {
    await sendResponse(
      "Unable to identify you. Please make sure your Telegram username is set and matches your KOL profile."
    );
    return;
  }

  // Find KOL by telegram username
  const kol = await db.kOL.findFirst({
    where: {
      organizationId,
      telegramUsername: {
        equals: senderUsername,
        mode: "insensitive",
      },
    },
  });

  // Get active campaign assignments for this KOL
  const campaignKols = kol ? await db.campaignKOL.findMany({
    where: {
      kolId: kol.id,
      status: { in: ["PENDING", "CONFIRMED"] },
      campaign: {
        status: { in: ["ACTIVE", "PENDING_APPROVAL"] },
      },
    },
    include: {
      campaign: true,
    },
    take: 1,
  }) : [];

  if (!kol) {
    await sendResponse(
      `No KOL profile found for @${senderUsername}. Please ask your agency contact to add your Telegram username to your profile.`
    );
    return;
  }

  // Find an active campaign for this KOL
  const campaignKol = campaignKols[0];
  if (!campaignKol) {
    await sendResponse(
      "No active campaign found for your profile. Please contact your agency to be assigned to a campaign."
    );
    return;
  }

  // Create draft post
  const post = await db.post.create({
    data: {
      campaignId: campaignKol.campaignId,
      kolId: kol.id,
      type: "POST",
      content: draftContent,
      status: "DRAFT",
    },
  });

  // Store the message in the chat
  await db.telegramGroupMessage.create({
    data: {
      chatId,
      content: text,
      direction: "INBOUND",
      senderUsername,
      senderName,
      timestamp: new Date(),
    },
  });

  await sendResponse(
    `Draft submitted for review.\n\n` +
    `Campaign: ${campaignKol.campaign.name}\n` +
    `KOL: ${kol.name}\n` +
    `Status: Pending Review\n\n` +
    `Your agency will review and approve this content shortly.`
  );

  console.log(`[Review] Draft submitted: post ${post.id} for KOL ${kol.name} in campaign ${campaignKol.campaign.name}`);
}

async function handlePrivateMessage(
  organizationId: string,
  botToken: string | null,
  message: TelegramMessage
) {
  const senderUsername = message.from?.username;
  const senderTelegramId = message.from?.id?.toString();
  const senderName = message.from
    ? [message.from.first_name, message.from.last_name].filter(Boolean).join(" ")
    : null;
  const textContent = message.text || message.caption;

  console.log(`[Telegram Webhook] Private message from @${senderUsername} (ID: ${senderTelegramId}): ${textContent?.slice(0, 50)}...`);

  if (!senderUsername || !senderTelegramId) {
    console.log("[Telegram Webhook] No sender info in private message");
    return;
  }

  // Find KOL by telegram username
  const kol = await db.kOL.findFirst({
    where: {
      organizationId,
      telegramUsername: {
        equals: senderUsername,
        mode: "insensitive",
      },
    },
  });

  if (!kol) {
    console.log(`[Telegram Webhook] No KOL found for @${senderUsername}`);
    // Still store the message if we have a chat record
    return;
  }

  console.log(`[Telegram Webhook] Matched KOL: ${kol.name} (${kol.id})`);

  // Create or update a private chat record for this KOL
  const telegramChatId = message.chat.id.toString();

  const privateChat = await db.telegramChat.upsert({
    where: {
      organizationId_telegramChatId: {
        organizationId,
        telegramChatId,
      },
    },
    create: {
      organizationId,
      telegramChatId,
      title: senderName || senderUsername,
      type: "PRIVATE",
      username: senderUsername,
      status: "ACTIVE",
    },
    update: {
      title: senderName || senderUsername,
      username: senderUsername,
      status: "ACTIVE",
    },
  });

  // Link KOL to this private chat (so we can find it later for sending)
  await db.telegramChatKOL.upsert({
    where: {
      chatId_kolId: {
        chatId: privateChat.id,
        kolId: kol.id,
      },
    },
    create: {
      chatId: privateChat.id,
      kolId: kol.id,
      telegramUserId: senderTelegramId,
      matchedBy: "username",
    },
    update: {
      telegramUserId: senderTelegramId,
    },
  });

  // Store the message in TelegramMessage (for 1:1 KOL messages)
  if (textContent) {
    await db.telegramMessage.create({
      data: {
        kolId: kol.id,
        telegramChatId,
        telegramMessageId: message.message_id.toString(),
        content: textContent,
        direction: "INBOUND",
        senderName,
        timestamp: new Date(message.date * 1000),
      },
    });
  }

  // Send a confirmation if this is their first message
  if (botToken && textContent?.toLowerCase().includes("/start")) {
    const client = new TelegramClient(botToken);
    await client.sendMessage(
      message.chat.id,
      `Hi ${senderName || senderUsername}! You're now connected. Your agency can send you messages through this chat.`
    );
  }

  console.log(`[Telegram Webhook] Stored private message and linked KOL ${kol.name}`);
}

async function matchKolToChat(
  organizationId: string,
  chatId: string,
  telegramUsername: string,
  telegramUserId?: string
) {
  // Find KOL with matching telegram username
  const kol = await db.kOL.findFirst({
    where: {
      organizationId,
      telegramUsername: {
        equals: telegramUsername,
        mode: "insensitive",
      },
    },
  });

  if (!kol) {
    return;
  }

  // Check if link already exists
  const existingLink = await db.telegramChatKOL.findUnique({
    where: {
      chatId_kolId: {
        chatId,
        kolId: kol.id,
      },
    },
  });

  if (!existingLink) {
    // Create new link
    await db.telegramChatKOL.create({
      data: {
        chatId,
        kolId: kol.id,
        telegramUserId: telegramUserId || null,
        matchedBy: "username",
      },
    });
  } else if (telegramUserId && !existingLink.telegramUserId) {
    // Update with telegram user ID if we have it now
    await db.telegramChatKOL.update({
      where: { id: existingLink.id },
      data: { telegramUserId },
    });
  }
}
