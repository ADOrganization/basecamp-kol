import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const orgs = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      telegramBotToken: true,
      telegramWebhookSecret: true,
      telegramBotUsername: true,
    }
  });

  console.log('\n=== Organizations ===');
  for (const org of orgs) {
    console.log(`- ${org.name}`);
    console.log(`  Bot Username: ${org.telegramBotUsername || 'Not set'}`);
    console.log(`  Has Token: ${!!org.telegramBotToken}`);
    console.log(`  Has Webhook Secret: ${!!org.telegramWebhookSecret}`);
  }

  const chats = await prisma.telegramChat.findMany({
    include: {
      kolLinks: true,
      _count: { select: { messages: true } }
    }
  });

  console.log('\n=== Telegram Chats ===');
  console.log(`Total: ${chats.length}`);
  for (const chat of chats) {
    console.log(`- ${chat.title || 'Unnamed'} (${chat.status})`);
    console.log(`  Type: ${chat.type}, Members: ${chat.memberCount}`);
    console.log(`  KOL Links: ${chat.kolLinks.length}, Messages: ${chat._count.messages}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
