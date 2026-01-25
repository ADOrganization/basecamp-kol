// Script to manually register webhook for an organization
// Usage: node scripts/register-webhook.mjs

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function generateWebhookSecret() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let secret = '';
  for (let i = 0; i < 32; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
}

async function main() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;

  if (!baseUrl) {
    console.error('Error: NEXT_PUBLIC_APP_URL or VERCEL_URL not set');
    process.exit(1);
  }

  const orgs = await prisma.organization.findMany({
    where: {
      telegramBotToken: { not: null }
    },
    select: {
      id: true,
      name: true,
      telegramBotToken: true,
      telegramWebhookSecret: true,
    }
  });

  console.log(`Found ${orgs.length} organizations with bot tokens`);

  for (const org of orgs) {
    console.log(`\nProcessing: ${org.name}`);

    if (org.telegramWebhookSecret) {
      console.log('  Already has webhook secret, checking webhook status...');
    } else {
      console.log('  No webhook secret, registering webhook...');
    }

    const webhookSecret = org.telegramWebhookSecret || generateWebhookSecret();
    const webhookUrl = `${baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`}/api/telegram/webhook`;

    // Register webhook with Telegram
    const response = await fetch(`https://api.telegram.org/bot${org.telegramBotToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: webhookSecret,
        allowed_updates: ['message', 'my_chat_member', 'chat_member'],
      }),
    });

    const result = await response.json();

    if (result.ok) {
      console.log(`  Webhook registered successfully: ${webhookUrl}`);

      // Save webhook secret if new
      if (!org.telegramWebhookSecret) {
        await prisma.organization.update({
          where: { id: org.id },
          data: { telegramWebhookSecret: webhookSecret },
        });
        console.log('  Saved webhook secret to database');
      }
    } else {
      console.error(`  Failed to register webhook: ${result.description}`);
    }

    // Get current webhook info
    const infoResponse = await fetch(`https://api.telegram.org/bot${org.telegramBotToken}/getWebhookInfo`);
    const info = await infoResponse.json();

    if (info.ok) {
      console.log('  Webhook info:');
      console.log(`    URL: ${info.result.url || 'Not set'}`);
      console.log(`    Pending updates: ${info.result.pending_update_count}`);
      if (info.result.last_error_message) {
        console.log(`    Last error: ${info.result.last_error_message}`);
      }
    }
  }

  await prisma.$disconnect();
  console.log('\nDone!');
}

main().catch(console.error);
