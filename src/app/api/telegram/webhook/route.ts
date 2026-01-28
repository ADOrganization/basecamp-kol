import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { TelegramClient, mapTelegramChatType } from "@/lib/telegram/client";
import type { TelegramUpdate, TelegramChatMemberUpdated, TelegramMessage } from "@/lib/telegram/types";
import { scrapeSingleTweet } from "@/lib/scraper/x-scraper";

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
    console.log("[Telegram Webhook] Bot token present:", !!org.telegramBotToken);

    const update: TelegramUpdate = await request.json();
    console.log("[Telegram Webhook] Update type:", update.message ? "message" : update.my_chat_member ? "my_chat_member" : "other");

    // Handle my_chat_member updates (bot added/removed from groups)
    if (update.my_chat_member) {
      console.log("[Telegram Webhook] Processing my_chat_member update");
      await handleMyChatMemberUpdate(org.id, update.my_chat_member);
    }

    // Handle new messages in groups
    if (update.message) {
      console.log("[Telegram Webhook] Processing message from chat:", update.message.chat.id, "type:", update.message.chat.type);
      console.log("[Telegram Webhook] Message text:", update.message.text?.slice(0, 100) || "(no text)");
      await handleMessage(org.id, org.telegramBotToken, update.message);
      console.log("[Telegram Webhook] handleMessage completed");
    }

    // Always return 200 to acknowledge receipt
    console.log("[Telegram Webhook] Returning 200 OK");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Telegram Webhook] CRITICAL ERROR:", error);
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
  const textContent = message.text || message.caption;

  console.log(`[Telegram Webhook] handleMessage called - chatType: ${chat.type}, chatId: ${chat.id}, text: "${textContent?.slice(0, 50) || 'none'}"`);

  // Handle private messages (DMs to the bot)
  if (chat.type === "private") {
    await handlePrivateMessage(organizationId, botToken, message);
    return;
  }

  // Only handle group/supergroup messages from here
  if (chat.type !== "group" && chat.type !== "supergroup") {
    console.log(`[Telegram Webhook] Ignoring non-group chat type: ${chat.type}`);
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

  // Skip if no text content (already extracted above)
  if (!textContent) {
    console.log(`[Telegram Webhook] No text content in message, skipping`);
    return;
  }

  console.log(`[Telegram Webhook] Processing group message - checking for commands. Text starts with: "${textContent.slice(0, 20)}"`);

  // Check if text is a command (starts with /)
  if (textContent.startsWith("/")) {
    console.log(`[Telegram Webhook] Command detected: ${textContent.split(" ")[0]}`);
  }

  const senderUsername = message.from?.username;
  const senderTelegramId = message.from?.id?.toString();
  const senderName = message.from
    ? [message.from.first_name, message.from.last_name].filter(Boolean).join(" ")
    : null;

  // Check for /help command
  if (textContent.startsWith("/help")) {
    await handleHelpCommand(botToken, chat.id, organizationId, telegramChatId, senderUsername);
    return;
  }

  // Check for /schedule command
  if (textContent.startsWith("/schedule")) {
    await handleScheduleCommand(botToken, chat.id);
    return;
  }

  // Check for /budget command
  if (textContent.startsWith("/budget")) {
    console.log(`[Telegram Webhook] /budget command detected! Calling handleBudgetCommand...`);
    console.log(`[Telegram Webhook] Parameters: orgId=${organizationId}, chatId=${chat.id}, sender=@${senderUsername}, title="${chat.title}", telegramChatId=${telegramChatId}`);
    try {
      await handleBudgetCommand(organizationId, botToken, chat.id, senderUsername, chat.title || null, telegramChatId);
      console.log(`[Telegram Webhook] handleBudgetCommand completed successfully`);
    } catch (err) {
      console.error(`[Telegram Webhook] handleBudgetCommand threw an error:`, err);
      // Try to send an error message to the chat
      if (botToken) {
        try {
          const client = new TelegramClient(botToken);
          await client.sendMessage(chat.id, `An error occurred processing /budget. Please try again later.`);
        } catch (sendErr) {
          console.error(`[Telegram Webhook] Failed to send error message:`, sendErr);
        }
      }
    }
    return;
  }

  // Check for /review command
  if (textContent.startsWith("/review")) {
    await handleReviewCommand(
      organizationId,
      botToken,
      telegramChat.id,
      chat.id,
      textContent,
      senderUsername,
      senderName,
      senderTelegramId
    );
    return;
  }

  // Check for /submit command in group chat
  if (textContent.startsWith("/submit")) {
    await handleSubmitCommandFromGroup(
      organizationId,
      botToken,
      chat.id,
      textContent,
      senderUsername,
      senderTelegramId
    );
    return;
  }

  // Check for /payment command (payment receipt submission)
  if (textContent.startsWith("/payment")) {
    await handlePaymentCommand(
      organizationId,
      botToken,
      chat.id,
      textContent,
      senderUsername,
      senderTelegramId,
      chat.title || null
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
  senderName: string | null,
  senderTelegramId: string | undefined
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

  // Link KOL to this chat (upsert to avoid duplicates)
  await db.telegramChatKOL.upsert({
    where: {
      chatId_kolId: {
        chatId: chatId,
        kolId: kol.id,
      },
    },
    update: {
      telegramUserId: senderTelegramId || null,
    },
    create: {
      chatId: chatId,
      kolId: kol.id,
      telegramUserId: senderTelegramId || null,
      matchedBy: "review_command",
    },
  });

  // Update KOL's telegramGroupId to this group so notifications go to the right place
  await db.kOL.update({
    where: { id: kol.id },
    data: { telegramGroupId: telegramChatId.toString() },
  });

  console.log(`[Review] Linked KOL ${kol.name} to chat ${chatId}, updated telegramGroupId to ${telegramChatId}`);

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
    `Our agency will review and approve this content shortly.`
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

  // Check for /help command
  if (textContent?.startsWith("/help")) {
    // In private messages, pass organizationId and username but no chat ID (not a group)
    await handleHelpCommand(botToken, message.chat.id, organizationId, undefined, senderUsername);
    return;
  }

  // Check for /schedule command
  if (textContent?.startsWith("/schedule")) {
    await handleScheduleCommand(botToken, message.chat.id);
    return;
  }

  // Check for /budget command
  if (textContent?.startsWith("/budget")) {
    // In private messages, no chat context - only admins can use this
    await handleBudgetCommand(organizationId, botToken, message.chat.id, senderUsername, null, undefined);
    return;
  }

  // Check for /submit command
  if (textContent?.startsWith("/submit")) {
    await handleSubmitCommand(organizationId, botToken, message, senderUsername, senderTelegramId);
    return;
  }

  // Check for /payment command
  if (textContent?.startsWith("/payment")) {
    await handlePaymentCommand(
      organizationId,
      botToken,
      message.chat.id,
      textContent,
      senderUsername,
      senderTelegramId,
      null
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

async function handleHelpCommand(
  botToken: string | null,
  chatId: number,
  organizationId?: string,
  telegramChatId?: string,
  senderUsername?: string
) {
  if (!botToken) return;

  const client = new TelegramClient(botToken);

  // SECURITY: Determine if this is a client group (can see budget) or KOL group (cannot see budget)
  let showBudgetCommand = false;

  // Check if sender is an admin
  const allowedUsersEnv = process.env.TELEGRAM_BUDGET_ADMINS || "";
  const allowedAdmins = allowedUsersEnv
    .split(",")
    .map((u) => u.trim().toLowerCase().replace("@", ""))
    .filter(Boolean);
  const normalizedUsername = senderUsername?.toLowerCase().replace("@", "");

  if (normalizedUsername && allowedAdmins.includes(normalizedUsername)) {
    showBudgetCommand = true;
  }

  // Check if this is a client group chat
  if (!showBudgetCommand && organizationId && telegramChatId) {
    const isClientGroup = await db.campaign.findFirst({
      where: {
        agencyId: organizationId,
        clientTelegramChatId: telegramChatId,
      },
      select: { id: true },
    });

    if (isClientGroup) {
      showBudgetCommand = true;
    }
  }

  // Build help message - only show budget command if allowed
  let helpMessage = `📚 *Available Commands*

*Content Submission:*
• \`/submit <post_url>\` - Submit a posted X post
• \`/submit <campaign> <post_url>\` - Submit to a specific campaign (if you have multiple)

*Content Review:*
• \`/review <draft_content>\` - Submit content for agency review before posting

*Payments:*
• \`/payment <amount> <proof_url>\` - Submit payment receipt with amount (USD)
• \`/payment <campaign> <amount> <proof_url>\` - Submit for a specific campaign

*Other:*`;

  if (showBudgetCommand) {
    helpMessage += `
• \`/budget\` - View campaign budget breakdown`;
  }

  helpMessage += `
• \`/schedule\` - Book a call with our team
• \`/start\` - Initialize bot connection
• \`/help\` - Show this help message

*Examples:*
\`/submit https://x.com/user/status/123456789\`
\`/payment 500 https://etherscan.io/tx/0x123...\`
\`/review Check out @ProjectHandle - amazing DeFi protocol! #crypto\`

Need assistance? Contact @altcoinclimber or @viperrcrypto`;

  await client.sendMessage(chatId, helpMessage, { parse_mode: "Markdown" });
}

async function handleScheduleCommand(
  botToken: string | null,
  chatId: number
) {
  if (!botToken) return;

  const client = new TelegramClient(botToken);
  await client.sendMessage(
    chatId,
    `📅 *Book a Call*\n\nSchedule a meeting with our team:\nhttps://kalsync.xyz/basecamp`,
    { parse_mode: "Markdown" }
  );
}

async function handleBudgetCommand(
  organizationId: string,
  botToken: string | null,
  chatId: number,
  senderUsername: string | undefined,
  groupTitle: string | null,
  telegramChatId?: string
) {
  console.log(`[Budget] === BUDGET COMMAND START ===`);
  console.log(`[Budget] orgId: ${organizationId}`);
  console.log(`[Budget] chatId (number): ${chatId}`);
  console.log(`[Budget] telegramChatId (string): ${telegramChatId}`);
  console.log(`[Budget] sender: @${senderUsername}`);
  console.log(`[Budget] groupTitle: "${groupTitle}"`);
  console.log(`[Budget] botToken present: ${!!botToken}`);

  if (!botToken) {
    console.error("[Budget] CRITICAL: No bot token - cannot send any messages!");
    return;
  }

  const client = new TelegramClient(botToken);

  // DEBUG: Send immediate acknowledgment to confirm webhook is working
  console.log(`[Budget] Attempting to send debug message to chatId: ${chatId}`);
  try {
    const debugResult = await client.sendMessage(chatId, `Processing /budget command from @${senderUsername || 'unknown'}...`);
    console.log(`[Budget] Debug message result:`, JSON.stringify(debugResult));
    if (!debugResult.ok) {
      console.error(`[Budget] Failed to send debug message - Telegram API error: ${debugResult.description}`);
      // If we can't even send a debug message, something is fundamentally wrong
      // This could be: wrong chat_id, bot not in group, bot lacks permissions
      return;
    }
  } catch (err) {
    console.error("[Budget] EXCEPTION sending debug message:", err);
    // Don't return here - try to continue and see if other operations work
  }

  // Helper to send response with error handling
  const sendResponse = async (message: string) => {
    try {
      const result = await client.sendMessage(chatId, message, { parse_mode: "Markdown" });
      if (!result.ok) {
        console.error(`[Budget] sendResponse failed: ${result.description}`);
      }
      return result;
    } catch (err) {
      console.error(`[Budget] sendResponse exception:`, err);
      throw err;
    }
  };

  const normalizedUsername = senderUsername?.toLowerCase().replace("@", "");

  // SECURITY: Check if user is an admin (from environment variable)
  const allowedUsersEnv = process.env.TELEGRAM_BUDGET_ADMINS || "";
  const allowedAdmins = allowedUsersEnv
    .split(",")
    .map((u) => u.trim().toLowerCase().replace("@", ""))
    .filter(Boolean);

  const isAdmin = normalizedUsername && allowedAdmins.includes(normalizedUsername);
  console.log(`[Budget] isAdmin: ${isAdmin}, normalizedUsername: ${normalizedUsername}, allowedAdmins: [${allowedAdmins.join(", ")}]`);

  // SECURITY: Check if this is a client group chat (clients can only see their assigned campaign budget)
  let clientCampaign: { id: string; name: string; totalBudget: number; createdAt: Date } | null = null;

  if (telegramChatId) {
    // Check if this chat is a client's campaign group
    const campaignForChat = await db.campaign.findFirst({
      where: {
        agencyId: organizationId,
        clientTelegramChatId: telegramChatId,
      },
      select: {
        id: true,
        name: true,
        totalBudget: true,
        createdAt: true,
      },
    });

    console.log(`[Budget] Campaign lookup for telegramChatId "${telegramChatId}": ${campaignForChat ? `found "${campaignForChat.name}"` : "NOT FOUND"}`);

    // Debug: If not found, list all campaigns with their clientTelegramChatId to identify mismatch
    if (!campaignForChat) {
      const allCampaigns = await db.campaign.findMany({
        where: { agencyId: organizationId },
        select: { id: true, name: true, clientTelegramChatId: true, status: true },
      });
      console.log(`[Budget] DEBUG - All campaigns for org ${organizationId}:`, allCampaigns.map(c => ({
        name: c.name,
        clientTelegramChatId: c.clientTelegramChatId,
        status: c.status
      })));
    }

    if (campaignForChat) {
      clientCampaign = campaignForChat;
    }
  } else {
    console.log("[Budget] No telegramChatId provided - skipping client group check");
  }

  // SECURITY: Check if user is a KOL - KOLs should NEVER see budgets
  if (normalizedUsername) {
    console.log(`[Budget] Checking if @${normalizedUsername} is a KOL...`);
    const isKol = await db.kOL.findFirst({
      where: {
        organizationId,
        telegramUsername: {
          equals: normalizedUsername,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    if (isKol) {
      // SECURITY: KOLs are not allowed to see budget information
      console.warn(`[Budget] KOL @${normalizedUsername} attempted /budget - blocked`);
      // Send a user-friendly response instead of silently ignoring
      await sendResponse("This command is not available for KOL accounts. Please contact your agency for budget information.");
      return;
    }
    console.log(`[Budget] @${normalizedUsername} is not a KOL`);
  }

  // DECISION: Who gets access?
  // 1. Admins - can see any campaign budget (from group context)
  // 2. Clients in their assigned campaign group - can ONLY see their campaign's budget
  // 3. Everyone else - denied

  console.log(`[Budget] Access check - isAdmin: ${isAdmin}, clientCampaign: ${clientCampaign?.name || 'null'}`);

  if (!isAdmin && !clientCampaign) {
    // Not an admin and not in a client campaign group
    console.warn(`[Budget] Access denied for @${normalizedUsername || 'unknown'} - not admin, not in client group`);
    // Send a helpful response - user is in a group but not authorized
    await sendResponse("You don't have permission to view budget information in this group. This command is available to clients in their campaign groups.");
    return;
  }

  // CLIENT ACCESS: If in a client campaign group, only show that specific campaign's budget
  if (clientCampaign) {
    console.log(`[Budget] Client access: showing budget for campaign "${clientCampaign.name}" in chat ${telegramChatId}`);
    await showCampaignBudget(sendResponse, clientCampaign);
    return;
  }

  // ADMIN ACCESS: Show budget based on group context
  if (isAdmin) {
    // In private messages without group context, show a message
    if (!groupTitle) {
      await sendResponse("Please use /budget in a campaign group chat to see budget details.");
      return;
    }

    // Extract campaign name from group title
    const cleanedTitle = groupTitle
      .replace(/^basecamp\s*[-|:]\s*/i, "")
      .replace(/^basecamp\s+/i, "")
      .trim();

    console.log(`[Budget] Admin access - Group title: "${groupTitle}", cleaned: "${cleanedTitle}"`);

    // Find campaign that matches the group name
    let campaign = await db.campaign.findFirst({
      where: {
        agencyId: organizationId,
        status: "ACTIVE",
        name: {
          contains: cleanedTitle,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        name: true,
        totalBudget: true,
        createdAt: true,
      },
    });

    if (!campaign) {
      // Try reverse match - campaign name contains in group title
      const allCampaigns = await db.campaign.findMany({
        where: {
          agencyId: organizationId,
          status: "ACTIVE",
        },
        select: {
          id: true,
          name: true,
          totalBudget: true,
          createdAt: true,
        },
      });

      const matchedCampaign = allCampaigns.find(c =>
        groupTitle.toLowerCase().includes(c.name.toLowerCase())
      );

      if (!matchedCampaign) {
        // Show available campaigns for admins
        if (allCampaigns.length > 0) {
          const campaignList = allCampaigns.slice(0, 5).map(c => `• ${c.name}`).join("\n");
          await sendResponse(
            `Could not find a campaign matching this group: "${groupTitle}"\n\n` +
            `Available active campaigns:\n${campaignList}\n\n` +
            `Tip: The group name should contain the campaign name.`
          );
        } else {
          await sendResponse(`Could not find a campaign matching this group: "${groupTitle}"\n\nNo active campaigns found in your organization.`);
        }
        return;
      }

      campaign = matchedCampaign;
    }

    await showCampaignBudget(sendResponse, campaign);
  }
}

async function showCampaignBudget(
  sendResponse: (message: string) => Promise<unknown>,
  campaign: { id: string; name: string; totalBudget: number; createdAt: Date }
) {
  // Get all KOL allocations for this campaign
  const allCampaignKols = await db.campaignKOL.findMany({
    where: { campaignId: campaign.id },
    select: { assignedBudget: true },
  });

  const allocatedBudget = allCampaignKols.reduce((sum, k) => sum + (k.assignedBudget || 0), 0);
  const remainingBudget = campaign.totalBudget - allocatedBudget;

  // Calculate days active
  const startDate = new Date(campaign.createdAt);
  const now = new Date();
  const daysActive = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  const message = `💰 *${campaign.name} Budget*\n\n` +
    `• Total Budget: $${(campaign.totalBudget / 100).toLocaleString()}\n` +
    `• Allocated: $${(allocatedBudget / 100).toLocaleString()}\n` +
    `• Remaining: $${(remainingBudget / 100).toLocaleString()}\n` +
    `• Days Active: ${daysActive}`;

  await sendResponse(message);
}

async function handleSubmitCommand(
  organizationId: string,
  botToken: string | null,
  message: TelegramMessage,
  senderUsername: string,
  senderTelegramId: string
) {
  const textContent = message.text || message.caption || "";
  const chatId = message.chat.id;

  // Helper to send response
  const sendResponse = async (text: string) => {
    if (!botToken) return;
    const client = new TelegramClient(botToken);
    await client.sendMessage(chatId, text);
  };

  // Parse command: /submit [campaign_name] <tweet_url>
  const commandContent = textContent.replace(/^\/submit\s*/i, "").trim();
  const parts = commandContent.split(/\s+/);

  let campaignNameFilter: string | null = null;
  let tweetUrl: string | null = null;

  // Find the tweet URL (contains "status/")
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].includes("status/")) {
      tweetUrl = parts[i];
      if (i > 0) {
        campaignNameFilter = parts.slice(0, i).join(" ");
      }
      break;
    }
  }

  if (!tweetUrl) {
    await sendResponse(
      "Please provide a valid X post URL.\n\n" +
      "Usage:\n" +
      "/submit <post_url> - Submit to your only active campaign\n" +
      "/submit <campaign_name> <post_url> - Submit to a specific campaign\n\n" +
      "Example:\n/submit https://x.com/handle/status/123456789"
    );
    return;
  }

  // Parse tweet URL - extract tweet ID
  const tweetIdMatch = tweetUrl.match(/status\/(\d+)/);
  if (!tweetIdMatch) {
    await sendResponse(
      "Could not parse post ID from URL. Please provide a valid X post URL."
    );
    return;
  }

  const tweetId = tweetIdMatch[1];

  // Find KOL by telegram username (via TelegramChatKOL or direct KOL lookup)
  let kol = await db.kOL.findFirst({
    where: {
      organizationId,
      telegramUsername: {
        equals: senderUsername,
        mode: "insensitive",
      },
    },
  });

  // Also check TelegramChatKOL for match
  if (!kol) {
    const chatKol = await db.telegramChatKOL.findFirst({
      where: {
        telegramUserId: senderTelegramId,
        kol: {
          organizationId,
        },
      },
      include: { kol: true },
    });

    if (chatKol) {
      kol = chatKol.kol;
    }
  }

  if (!kol) {
    await sendResponse(
      "You're not registered as a KOL. Please contact your agency to add your Telegram username to your profile."
    );
    return;
  }

  console.log(`[Submit] KOL identified: ${kol.name} (@${kol.twitterHandle})`);

  // Find ALL active campaigns KOL is assigned to
  const allCampaignKols = await db.campaignKOL.findMany({
    where: {
      kolId: kol.id,
      status: { in: ["PENDING", "CONFIRMED"] },
      campaign: {
        status: "ACTIVE",
        agencyId: organizationId,
      },
    },
    include: {
      campaign: true,
    },
  });

  if (allCampaignKols.length === 0) {
    await sendResponse(
      "You're not assigned to any active campaign. Please contact your agency."
    );
    return;
  }

  // Determine which campaign to use
  let campaignKol: typeof allCampaignKols[0] | null = null;

  if (allCampaignKols.length === 1) {
    campaignKol = allCampaignKols[0];
  } else if (campaignNameFilter) {
    const filterLower = campaignNameFilter.toLowerCase();
    campaignKol = allCampaignKols.find(ck =>
      ck.campaign.name.toLowerCase().includes(filterLower)
    ) || null;

    if (!campaignKol) {
      const campaignList = allCampaignKols.map(ck => `• ${ck.campaign.name}`).join("\n");
      await sendResponse(
        `No campaign found matching "${campaignNameFilter}".\n\n` +
        `Your active campaigns:\n${campaignList}\n\n` +
        `Usage: /submit <campaign_name> <post_url>`
      );
      return;
    }
  } else {
    const campaignList = allCampaignKols.map(ck => `• ${ck.campaign.name}`).join("\n");
    await sendResponse(
      `You're assigned to multiple active campaigns. Please specify which one:\n\n` +
      `${campaignList}\n\n` +
      `Usage: /submit <campaign_name> <post_url>\n\n` +
      `Example:\n/submit ${allCampaignKols[0].campaign.name} ${tweetUrl}`
    );
    return;
  }

  console.log(`[Submit] Campaign selected: ${campaignKol.campaign.name}`);

  // Check for duplicate submission
  const existing = await db.post.findFirst({
    where: { tweetId },
  });

  if (existing) {
    await sendResponse(
      "This post was already submitted."
    );
    return;
  }

  // Scrape tweet
  let tweet;
  try {
    tweet = await scrapeSingleTweet(tweetUrl);
  } catch (error) {
    console.error(`[Submit] Failed to scrape tweet:`, error);
    tweet = null;
  }

  if (!tweet) {
    await sendResponse(
      "Couldn't fetch post details. Please check the URL and try again."
    );
    return;
  }

  console.log(`[Submit] Tweet scraped: ${tweet.content.slice(0, 50)}...`);

  // Create Post record
  const post = await db.post.create({
    data: {
      campaignId: campaignKol.campaignId,
      kolId: kol.id,
      type: "POST",  // Explicitly set type for deliverables tracking
      tweetId: tweet.id,
      tweetUrl: tweet.url,
      content: tweet.content,
      status: "POSTED",
      postedAt: tweet.postedAt,
      impressions: tweet.metrics.views,
      likes: tweet.metrics.likes,
      retweets: tweet.metrics.retweets,
      replies: tweet.metrics.replies,
      quotes: tweet.metrics.quotes,
      bookmarks: tweet.metrics.bookmarks,
    },
  });

  console.log(`[Submit] Post created: ${post.id}, type: POST, status: POSTED`);

  // Notify client group if configured
  console.log(`[Submit] Campaign clientTelegramChatId: ${campaignKol.campaign.clientTelegramChatId || 'NOT SET'}`);
  if (campaignKol.campaign.clientTelegramChatId && botToken) {
    try {
      const client = new TelegramClient(botToken);
      const clientNotifResult = await client.sendMessage(
        campaignKol.campaign.clientTelegramChatId,
        `*New Post Submitted!*\n\n` +
        `*Campaign:* ${campaignKol.campaign.name}\n` +
        `*KOL:* @${kol.twitterHandle}\n` +
        `*Post:* ${tweet.url}`,
        { parse_mode: "Markdown" }
      );
      if (clientNotifResult.ok) {
        console.log(`[Submit] Notification sent to client group ${campaignKol.campaign.clientTelegramChatId}`);
      } else {
        console.error(`[Submit] Telegram API error for client group: ${clientNotifResult.description}`);
      }
    } catch (error) {
      console.error(`[Submit] Failed to notify client group:`, error);
    }
  } else {
    console.log(`[Submit] No client telegram group configured or no bot token`);
  }

  // Reply success to KOL
  await sendResponse(
    `Post submitted successfully!\n\n` +
    `Campaign: ${campaignKol.campaign.name}\n` +
    `Post: ${tweet.url}`
  );

  console.log(`[Submit] Completed for KOL ${kol.name}, post ${post.id}`);
}

async function handleSubmitCommandFromGroup(
  organizationId: string,
  botToken: string | null,
  telegramChatId: number,
  text: string,
  senderUsername: string | undefined,
  senderTelegramId: string | undefined
) {
  // Helper to send response
  const sendResponse = async (message: string) => {
    if (!botToken) return;
    const client = new TelegramClient(botToken);
    await client.sendMessage(telegramChatId, message);
  };

  // Parse command: /submit [campaign_name] <tweet_url>
  // The tweet URL always contains "status/" so we can identify it
  const commandContent = text.replace(/^\/submit\s*/i, "").trim();
  const parts = commandContent.split(/\s+/);

  let campaignNameFilter: string | null = null;
  let tweetUrl: string | null = null;

  // Find the tweet URL (contains "status/")
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].includes("status/")) {
      tweetUrl = parts[i];
      // Everything before the URL is the campaign name
      if (i > 0) {
        campaignNameFilter = parts.slice(0, i).join(" ");
      }
      break;
    }
  }

  if (!tweetUrl) {
    await sendResponse(
      "Please provide a valid X post URL.\n\n" +
      "Usage:\n" +
      "/submit <post_url> - Submit to your only active campaign\n" +
      "/submit <campaign_name> <post_url> - Submit to a specific campaign\n\n" +
      "Example:\n/submit https://x.com/handle/status/123456789\n" +
      "/submit MyCampaign https://x.com/handle/status/123456789"
    );
    return;
  }

  // Parse tweet URL - extract tweet ID
  const tweetIdMatch = tweetUrl.match(/status\/(\d+)/);
  if (!tweetIdMatch) {
    await sendResponse(
      "Could not parse post ID from URL. Please provide a valid X post URL."
    );
    return;
  }

  const tweetId = tweetIdMatch[1];

  if (!senderUsername) {
    await sendResponse(
      "Unable to identify you. Please make sure your Telegram username is set."
    );
    return;
  }

  // Find KOL by telegram username
  let kol = await db.kOL.findFirst({
    where: {
      organizationId,
      telegramUsername: {
        equals: senderUsername,
        mode: "insensitive",
      },
    },
  });

  // Also check TelegramChatKOL for match
  if (!kol && senderTelegramId) {
    const chatKol = await db.telegramChatKOL.findFirst({
      where: {
        telegramUserId: senderTelegramId,
        kol: {
          organizationId,
        },
      },
      include: { kol: true },
    });

    if (chatKol) {
      kol = chatKol.kol;
    }
  }

  if (!kol) {
    await sendResponse(
      `No KOL profile found for @${senderUsername}. Please contact your agency to add your Telegram username to your profile.`
    );
    return;
  }

  // Update KOL's telegramGroupId to this group so future notifications go here
  await db.kOL.update({
    where: { id: kol.id },
    data: { telegramGroupId: telegramChatId.toString() },
  });

  console.log(`[Submit Group] KOL identified: ${kol.name} (@${kol.twitterHandle}), updated telegramGroupId to ${telegramChatId}`);
  console.log(`[Submit Group] Campaign filter: "${campaignNameFilter || 'none'}"`);

  // Find ALL active campaigns KOL is assigned to
  const allCampaignKols = await db.campaignKOL.findMany({
    where: {
      kolId: kol.id,
      status: { in: ["PENDING", "CONFIRMED"] },
      campaign: {
        status: "ACTIVE",
        agencyId: organizationId,
      },
    },
    include: {
      campaign: {
        select: {
          id: true,
          name: true,
          status: true,
          clientTelegramChatId: true,
          projectTwitterHandle: true,
        },
      },
    },
  });

  if (allCampaignKols.length === 0) {
    await sendResponse(
      "You're not assigned to any active campaign. Please contact your agency."
    );
    return;
  }

  console.log(`[Submit Group] Found ${allCampaignKols.length} active campaign(s) for KOL`);

  // Determine which campaign to use
  let campaignKol: typeof allCampaignKols[0] | null = null;

  if (allCampaignKols.length === 1) {
    // Only one campaign - use it
    campaignKol = allCampaignKols[0];
  } else if (campaignNameFilter) {
    // Multiple campaigns - find by name (case insensitive partial match)
    const filterLower = campaignNameFilter.toLowerCase();
    campaignKol = allCampaignKols.find(ck =>
      ck.campaign.name.toLowerCase().includes(filterLower)
    ) || null;

    if (!campaignKol) {
      const campaignList = allCampaignKols.map(ck => `• ${ck.campaign.name}`).join("\n");
      await sendResponse(
        `No campaign found matching "${campaignNameFilter}".\n\n` +
        `Your active campaigns:\n${campaignList}\n\n` +
        `Usage: /submit <campaign_name> <post_url>`
      );
      return;
    }
  } else {
    // Multiple campaigns but no filter specified - ask user to specify
    const campaignList = allCampaignKols.map(ck => `• ${ck.campaign.name}`).join("\n");
    await sendResponse(
      `You're assigned to multiple active campaigns. Please specify which one:\n\n` +
      `${campaignList}\n\n` +
      `Usage: /submit <campaign_name> <post_url>\n\n` +
      `Example:\n/submit ${allCampaignKols[0].campaign.name} ${tweetUrl}`
    );
    return;
  }

  // Log selected campaign
  console.log(`[Submit Group] Selected campaign:`, JSON.stringify(campaignKol.campaign));
  console.log(`[Submit Group] Campaign clientTelegramChatId: "${campaignKol.campaign.clientTelegramChatId}" (type: ${typeof campaignKol.campaign.clientTelegramChatId})`);

  // Check for duplicate submission
  const existing = await db.post.findFirst({
    where: { tweetId },
  });

  if (existing) {
    await sendResponse(
      "This post was already submitted."
    );
    return;
  }

  // Scrape tweet
  let tweet;
  try {
    tweet = await scrapeSingleTweet(tweetUrl);
  } catch (error) {
    console.error(`[Submit Group] Failed to scrape tweet:`, error);
    tweet = null;
  }

  if (!tweet) {
    await sendResponse(
      "Couldn't fetch post details. Please check the URL and try again."
    );
    return;
  }

  console.log(`[Submit Group] Tweet scraped: ${tweet.content.slice(0, 50)}...`);

  // Create Post record with status POSTED (counts as deliverable)
  const post = await db.post.create({
    data: {
      campaignId: campaignKol.campaignId,
      kolId: kol.id,
      type: "POST",  // Explicitly set type for deliverables tracking
      tweetId: tweet.id,
      tweetUrl: tweet.url,
      content: tweet.content,
      status: "POSTED",
      postedAt: tweet.postedAt,
      impressions: tweet.metrics.views,
      likes: tweet.metrics.likes,
      retweets: tweet.metrics.retweets,
      replies: tweet.metrics.replies,
      quotes: tweet.metrics.quotes,
      bookmarks: tweet.metrics.bookmarks,
    },
  });

  console.log(`[Submit Group] Post created: ${post.id}, type: POST, status: POSTED`);

  const client = botToken ? new TelegramClient(botToken) : null;
  const clientGroupId = campaignKol.campaign.clientTelegramChatId;

  console.log(`[Submit Group] Bot token available: ${!!botToken}`);
  console.log(`[Submit Group] Client available: ${!!client}`);
  console.log(`[Submit Group] clientGroupId value: "${clientGroupId}"`);
  console.log(`[Submit Group] clientGroupId truthy: ${!!clientGroupId}`);

  let clientNotified = false;
  let clientNotifyError = "";

  // 1. Notify client's telegram group if configured
  if (clientGroupId && clientGroupId.trim() && client) {
    console.log(`[Submit Group] Attempting to notify client group: ${clientGroupId}`);
    try {
      const clientNotifResult = await client.sendMessage(
        clientGroupId,
        `*New Post Submitted!*\n\n` +
        `*Campaign:* ${campaignKol.campaign.name}\n` +
        `*KOL:* @${kol.twitterHandle}\n` +
        `*Post:* ${tweet.url}`,
        { parse_mode: "Markdown" }
      );
      console.log(`[Submit Group] Telegram API response:`, JSON.stringify(clientNotifResult));
      if (clientNotifResult.ok) {
        console.log(`[Submit Group] SUCCESS: Notification sent to client group ${clientGroupId}`);
        clientNotified = true;
      } else {
        console.error(`[Submit Group] FAILED: Telegram API error: ${clientNotifResult.description}`);
        clientNotifyError = clientNotifResult.description || "Unknown error";
      }
    } catch (error) {
      console.error(`[Submit Group] EXCEPTION when notifying client group:`, error);
      clientNotifyError = error instanceof Error ? error.message : "Exception occurred";
    }
  } else {
    console.log(`[Submit Group] SKIPPED: No client telegram group - clientGroupId="${clientGroupId}", client=${!!client}`);
    clientNotifyError = `No client Telegram group is linked to campaign "${campaignKol.campaign.name}". Go to the campaign settings to link a client group.`;
  }

  // 2. Reply success to the KOL in the group chat
  let responseMessage = `✅ Post submitted successfully!\n\n` +
    `Campaign: ${campaignKol.campaign.name}\n` +
    `Post: ${tweet.url}\n\n` +
    `This post has been added to your deliverables.`;

  if (clientNotified) {
    responseMessage += `\n\n📣 Client group has been notified.`;
  } else if (clientNotifyError) {
    responseMessage += `\n\n⚠️ ${clientNotifyError}`;
  }

  await sendResponse(responseMessage);

  console.log(`[Submit Group] Completed for KOL ${kol.name}, post ${post.id}`);
}

async function handlePaymentCommand(
  organizationId: string,
  botToken: string | null,
  telegramChatId: number,
  text: string,
  senderUsername: string | undefined,
  senderTelegramId: string | undefined,
  groupTitle: string | null
) {
  // Helper to send response
  const sendResponse = async (message: string) => {
    if (!botToken) return;
    const client = new TelegramClient(botToken);
    await client.sendMessage(telegramChatId, message, { parse_mode: "Markdown" });
  };

  // Parse command: /payment [campaign_name] <amount> <proof_url>
  const commandContent = text.replace(/^\/payment\s*/i, "").trim();

  if (!commandContent) {
    await sendResponse(
      "Please provide an amount and payment proof link.\n\n" +
      "*Usage:*\n" +
      "`/payment <amount> <proof_url>` - Submit payment receipt\n" +
      "`/payment <campaign> <amount> <proof_url>` - Submit for a specific campaign\n\n" +
      "*Examples:*\n" +
      "`/payment 500 https://etherscan.io/tx/0x123...`\n" +
      "`/payment MyCampaign 1000 https://solscan.io/tx/abc...`"
    );
    return;
  }

  if (!senderUsername) {
    await sendResponse(
      "Unable to identify you. Please make sure your Telegram username is set."
    );
    return;
  }

  // Extract URL (anything that looks like a URL)
  const urlMatch = commandContent.match(/(https?:\/\/[^\s]+)/i);
  if (!urlMatch) {
    await sendResponse(
      "Could not find a valid URL. Please include a link to your payment proof (e.g., blockchain explorer, screenshot URL)."
    );
    return;
  }

  const proofUrl = urlMatch[1];
  const beforeUrl = commandContent.substring(0, commandContent.indexOf(proofUrl)).trim();

  // Parse amount and optional campaign name from the part before the URL
  // Format: [campaign_name] <amount>
  const parts = beforeUrl.split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    await sendResponse(
      "Please provide the payment amount (in USD).\n\n" +
      "*Usage:*\n" +
      "`/payment <amount> <proof_url>`\n\n" +
      "*Example:*\n" +
      "`/payment 500 https://etherscan.io/tx/0x123...`"
    );
    return;
  }

  // The last part before URL should be the amount
  const amountStr = parts[parts.length - 1];
  const amount = parseFloat(amountStr.replace(/[$,]/g, ""));

  if (isNaN(amount) || amount <= 0) {
    await sendResponse(
      `Invalid amount: "${amountStr}". Please provide a valid number.\n\n` +
      "*Example:*\n" +
      "`/payment 500 https://etherscan.io/tx/0x123...`"
    );
    return;
  }

  // Convert to cents
  const amountCents = Math.round(amount * 100);

  // Campaign name is everything before the amount
  const campaignNameFilter = parts.length > 1 ? parts.slice(0, -1).join(" ") : null;

  console.log(`[Payment] User @${senderUsername} submitting receipt: $${amount} - ${proofUrl}`);
  console.log(`[Payment] Campaign filter: "${campaignNameFilter || 'none'}"`);

  // Check for duplicate proof URL
  const existingReceipt = await db.paymentReceipt.findUnique({
    where: { proofUrl },
    include: {
      kol: { select: { name: true } },
      campaign: { select: { name: true } },
    },
  });

  if (existingReceipt) {
    await sendResponse(
      `⚠️ *This payment proof has already been submitted!*\n\n` +
      `*KOL:* ${existingReceipt.kol.name}\n` +
      `*Campaign:* ${existingReceipt.campaign?.name || "N/A"}\n` +
      `*Date:* ${existingReceipt.createdAt.toLocaleDateString()}\n\n` +
      `Each payment proof link can only be submitted once.`
    );
    return;
  }

  // Find KOL by telegram username
  let kol = await db.kOL.findFirst({
    where: {
      organizationId,
      telegramUsername: {
        equals: senderUsername,
        mode: "insensitive",
      },
    },
  });

  // Also check TelegramChatKOL for match
  if (!kol && senderTelegramId) {
    const chatKol = await db.telegramChatKOL.findFirst({
      where: {
        telegramUserId: senderTelegramId,
        kol: {
          organizationId,
        },
      },
      include: { kol: true },
    });

    if (chatKol) {
      kol = chatKol.kol;
    }
  }

  if (!kol) {
    await sendResponse(
      `No KOL profile found for @${senderUsername}. Please contact your agency to add your Telegram username to your profile.`
    );
    return;
  }

  console.log(`[Payment] KOL identified: ${kol.name} (@${kol.twitterHandle})`);

  // Find active campaigns KOL is assigned to
  const allCampaignKols = await db.campaignKOL.findMany({
    where: {
      kolId: kol.id,
      status: { in: ["PENDING", "CONFIRMED"] },
      campaign: {
        status: { in: ["ACTIVE", "COMPLETED"] },
        agencyId: organizationId,
      },
    },
    include: {
      campaign: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (allCampaignKols.length === 0) {
    await sendResponse(
      "You're not assigned to any campaign. Please contact your agency."
    );
    return;
  }

  // Determine which campaign to use
  let campaignKol: typeof allCampaignKols[0] | null = null;

  if (allCampaignKols.length === 1) {
    campaignKol = allCampaignKols[0];
  } else if (campaignNameFilter) {
    const filterLower = campaignNameFilter.toLowerCase();
    campaignKol = allCampaignKols.find(ck =>
      ck.campaign.name.toLowerCase().includes(filterLower)
    ) || null;

    if (!campaignKol) {
      const campaignList = allCampaignKols.map(ck => `• ${ck.campaign.name}`).join("\n");
      await sendResponse(
        `No campaign found matching "${campaignNameFilter}".\n\n` +
        `Your campaigns:\n${campaignList}\n\n` +
        `Usage: \`/payment <campaign> <amount> <proof_url>\``
      );
      return;
    }
  } else {
    // Try to match campaign from group title
    if (groupTitle) {
      const cleanedTitle = groupTitle
        .replace(/^basecamp\s*[-|:]\s*/i, "")
        .replace(/^basecamp\s+/i, "")
        .trim()
        .toLowerCase();

      campaignKol = allCampaignKols.find(ck =>
        ck.campaign.name.toLowerCase().includes(cleanedTitle) ||
        cleanedTitle.includes(ck.campaign.name.toLowerCase())
      ) || null;
    }

    if (!campaignKol) {
      const campaignList = allCampaignKols.map(ck => `• ${ck.campaign.name}`).join("\n");
      await sendResponse(
        `You're assigned to multiple campaigns. Please specify which one:\n\n` +
        `${campaignList}\n\n` +
        `Usage: \`/payment <campaign> <amount> <proof_url>\``
      );
      return;
    }
  }

  console.log(`[Payment] Campaign selected: ${campaignKol.campaign.name}`);

  // Create the payment receipt
  const receipt = await db.paymentReceipt.create({
    data: {
      kolId: kol.id,
      campaignId: campaignKol.campaignId,
      amount: amountCents,
      proofUrl,
      telegramUsername: senderUsername,
      telegramUserId: senderTelegramId || null,
    },
  });

  console.log(`[Payment] Receipt created: ${receipt.id}`);

  await sendResponse(
    `✅ *Payment receipt logged!*\n\n` +
    `*KOL:* ${kol.name}\n` +
    `*Campaign:* ${campaignKol.campaign.name}\n` +
    `*Amount:* $${amount.toLocaleString()}\n` +
    `*Proof:* ${proofUrl}\n\n` +
    `This receipt has been added to your profile for accounting records.`
  );

  console.log(`[Payment] Completed for KOL ${kol.name}, receipt ${receipt.id}, amount: $${amount}`);
}
