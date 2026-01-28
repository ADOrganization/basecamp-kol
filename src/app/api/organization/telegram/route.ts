import { NextRequest, NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  TelegramClient,
  verifyBotToken,
  generateWebhookSecret,
} from "@/lib/telegram/client";

const telegramSettingsSchema = z.object({
  botToken: z.string().min(1, "Bot token is required"),
});

// GET - Retrieve Telegram bot status
export async function GET() {
  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const org = await db.organization.findUnique({
      where: { id: authContext.organizationId },
      select: {
        telegramBotToken: true,
        telegramBotUsername: true,
        telegramWebhookSecret: true,
      },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // If token exists but no webhook secret, register webhook
    if (org.telegramBotToken && !org.telegramWebhookSecret) {
      const webhookSecret = generateWebhookSecret();
      const client = new TelegramClient(org.telegramBotToken);
      // IMPORTANT: Always use the production URL for webhook registration
      const PRODUCTION_URL = "https://admin.basecampnetwork.xyz";
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || PRODUCTION_URL;

      if (baseUrl) {
        const webhookUrl = `${baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`}/api/telegram/webhook`;
        console.log(`[Telegram] Registering webhook with URL: ${webhookUrl}`);
        await client.setWebhook(webhookUrl, {
          secret_token: webhookSecret,
          allowed_updates: ["message", "my_chat_member", "chat_member"],
        });

        await db.organization.update({
          where: { id: authContext.organizationId },
          data: { telegramWebhookSecret: webhookSecret },
        });
      }
    }

    return NextResponse.json({
      isConnected: !!org.telegramBotToken,
      botUsername: org.telegramBotUsername || null,
    });
  } catch (error) {
    console.error("Error getting Telegram settings:", error);
    return NextResponse.json(
      { error: "Failed to get Telegram settings" },
      { status: 500 }
    );
  }
}

// PUT - Update Telegram bot token
export async function PUT(request: NextRequest) {
  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission (admins bypass)
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
          { error: "You don't have permission to update settings" },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const validatedData = telegramSettingsSchema.parse(body);

    // Verify the bot token with Telegram API
    const verification = await verifyBotToken(validatedData.botToken);

    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error || "Invalid bot token" },
        { status: 400 }
      );
    }

    // Generate webhook secret
    const webhookSecret = generateWebhookSecret();

    // Register webhook with Telegram
    const client = new TelegramClient(validatedData.botToken);
    // IMPORTANT: Always use the production URL for webhook registration
    const PRODUCTION_URL = "https://admin.basecampnetwork.xyz";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || PRODUCTION_URL;

    if (baseUrl) {
      const webhookUrl = `${baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`}/api/telegram/webhook`;
      console.log(`[Telegram] Registering webhook with URL: ${webhookUrl}`);
      const webhookResult = await client.setWebhook(webhookUrl, {
        secret_token: webhookSecret,
        allowed_updates: ["message", "my_chat_member", "chat_member"],
      });

      if (!webhookResult.ok) {
        console.warn("Failed to set webhook:", webhookResult.description);
        // Don't fail the whole operation, just log the warning
      }
    }

    // Save the verified token and webhook secret
    await db.organization.update({
      where: { id: authContext.organizationId },
      data: {
        telegramBotToken: validatedData.botToken,
        telegramBotUsername: verification.username || null,
        telegramWebhookSecret: webhookSecret,
      },
    });

    return NextResponse.json({
      success: true,
      botUsername: verification.username,
    });
  } catch (error) {
    console.error("Error updating Telegram settings:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update Telegram settings" },
      { status: 500 }
    );
  }
}

// DELETE - Disconnect Telegram bot
export async function DELETE() {
  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission (admins bypass)
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
          { error: "You don't have permission to update settings" },
          { status: 403 }
        );
      }
    }

    // Get current token to delete webhook
    const org = await db.organization.findUnique({
      where: { id: authContext.organizationId },
      select: { telegramBotToken: true },
    });

    // Delete webhook if token exists
    if (org?.telegramBotToken) {
      const client = new TelegramClient(org.telegramBotToken);
      await client.deleteWebhook(true);
    }

    await db.organization.update({
      where: { id: authContext.organizationId },
      data: {
        telegramBotToken: null,
        telegramBotUsername: null,
        telegramWebhookSecret: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disconnecting Telegram:", error);
    return NextResponse.json(
      { error: "Failed to disconnect Telegram" },
      { status: 500 }
    );
  }
}
