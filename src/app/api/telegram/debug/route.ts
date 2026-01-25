import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { TelegramClient } from "@/lib/telegram/client";

function generateWebhookSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let secret = '';
  for (let i = 0; i < 32; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
}

// GET - Check webhook status and show debug info
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.organizationType !== "AGENCY") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const org = await db.organization.findUnique({
      where: { id: session.user.organizationId },
      select: {
        id: true,
        name: true,
        telegramBotToken: true,
        telegramWebhookSecret: true,
      },
    });

    if (!org?.telegramBotToken) {
      return NextResponse.json({
        status: "not_configured",
        message: "No Telegram bot token configured",
      });
    }

    // Check webhook info from Telegram
    const client = new TelegramClient(org.telegramBotToken);
    const botInfo = await client.getMe();

    const webhookResponse = await fetch(
      `https://api.telegram.org/bot${org.telegramBotToken}/getWebhookInfo`
    );
    const webhookInfo = await webhookResponse.json();

    // Get stats from database
    const [chatCount, messageCount, kolLinkCount] = await Promise.all([
      db.telegramChat.count({
        where: { organizationId: org.id },
      }),
      db.telegramMessage.count({
        where: { kol: { organizationId: org.id } },
      }),
      db.telegramChatKOL.count({
        where: { chat: { organizationId: org.id } },
      }),
    ]);

    return NextResponse.json({
      status: "ok",
      bot: botInfo.ok ? {
        username: botInfo.result?.username,
        firstName: botInfo.result?.first_name,
      } : { error: botInfo.description },
      webhook: webhookInfo.ok ? {
        url: webhookInfo.result?.url || "Not set",
        hasSecretToken: webhookInfo.result?.has_custom_certificate === false,
        pendingUpdates: webhookInfo.result?.pending_update_count,
        lastError: webhookInfo.result?.last_error_message,
        lastErrorDate: webhookInfo.result?.last_error_date
          ? new Date(webhookInfo.result.last_error_date * 1000).toISOString()
          : null,
      } : { error: webhookInfo.description },
      database: {
        hasWebhookSecret: !!org.telegramWebhookSecret,
        totalChats: chatCount,
        totalMessages: messageCount,
        totalKolLinks: kolLinkCount,
      },
    });
  } catch (error) {
    console.error("Error checking telegram status:", error);
    return NextResponse.json(
      { error: "Failed to check status" },
      { status: 500 }
    );
  }
}

// POST - Re-register webhook
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.organizationType !== "AGENCY") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const org = await db.organization.findUnique({
      where: { id: session.user.organizationId },
      select: {
        id: true,
        telegramBotToken: true,
        telegramWebhookSecret: true,
      },
    });

    if (!org?.telegramBotToken) {
      return NextResponse.json(
        { error: "No Telegram bot token configured" },
        { status: 400 }
      );
    }

    // Get the app URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
    if (!appUrl) {
      return NextResponse.json(
        { error: "App URL not configured (NEXT_PUBLIC_APP_URL)" },
        { status: 500 }
      );
    }

    const webhookUrl = `${appUrl.startsWith('http') ? appUrl : `https://${appUrl}`}/api/telegram/webhook`;
    const webhookSecret = org.telegramWebhookSecret || generateWebhookSecret();

    // Register webhook with Telegram
    const response = await fetch(
      `https://api.telegram.org/bot${org.telegramBotToken}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: webhookSecret,
          allowed_updates: ["message", "my_chat_member", "chat_member"],
        }),
      }
    );

    const result = await response.json();

    if (!result.ok) {
      return NextResponse.json(
        { error: `Failed to register webhook: ${result.description}` },
        { status: 400 }
      );
    }

    // Save webhook secret if new
    if (!org.telegramWebhookSecret) {
      await db.organization.update({
        where: { id: org.id },
        data: { telegramWebhookSecret: webhookSecret },
      });
    }

    // Get updated webhook info
    const infoResponse = await fetch(
      `https://api.telegram.org/bot${org.telegramBotToken}/getWebhookInfo`
    );
    const webhookInfo = await infoResponse.json();

    return NextResponse.json({
      success: true,
      webhookUrl,
      webhookInfo: webhookInfo.result,
    });
  } catch (error) {
    console.error("Error registering webhook:", error);
    return NextResponse.json(
      { error: "Failed to register webhook" },
      { status: 500 }
    );
  }
}
