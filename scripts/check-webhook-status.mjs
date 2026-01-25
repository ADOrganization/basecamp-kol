import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst({
    where: { telegramBotToken: { not: null } },
    select: {
      id: true,
      name: true,
      telegramBotToken: true,
      telegramWebhookSecret: true
    }
  });

  console.log('Organization:', org?.name || 'Not found');
  console.log('Has bot token:', Boolean(org?.telegramBotToken));
  console.log('Has webhook secret:', Boolean(org?.telegramWebhookSecret));

  if (org?.telegramBotToken) {
    const res = await fetch('https://api.telegram.org/bot' + org.telegramBotToken + '/getWebhookInfo');
    const data = await res.json();
    console.log('\nWebhook Status:');
    console.log('  URL:', data.result?.url || 'Not set');
    console.log('  Pending updates:', data.result?.pending_update_count || 0);
    console.log('  Last error:', data.result?.last_error_message || 'None');
    console.log('  Last error date:', data.result?.last_error_date
      ? new Date(data.result.last_error_date * 1000).toISOString()
      : 'N/A');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
