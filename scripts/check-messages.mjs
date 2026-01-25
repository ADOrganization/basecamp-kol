import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Check TelegramChats
  const chats = await prisma.telegramChat.findMany({
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      username: true,
    }
  });
  console.log('Telegram Chats:', chats.length);
  chats.forEach(c => console.log(`  - ${c.type}: ${c.title || c.username} (${c.status})`));

  // Check TelegramChatKOL links
  const kolLinks = await prisma.telegramChatKOL.findMany({
    include: {
      kol: { select: { name: true, telegramUsername: true } },
      chat: { select: { type: true, title: true } }
    }
  });
  console.log('\nKOL Links:', kolLinks.length);
  kolLinks.forEach(l => console.log(`  - ${l.kol.name} (@${l.kol.telegramUsername}) -> ${l.chat.type}: ${l.chat.title}, telegramUserId: ${l.telegramUserId || 'null'}`));

  // Check TelegramMessages (1:1)
  const messages = await prisma.telegramMessage.findMany({
    orderBy: { timestamp: 'desc' },
    take: 10,
    include: {
      kol: { select: { name: true } }
    }
  });
  console.log('\nRecent 1:1 Messages:', messages.length);
  messages.forEach(m => console.log(`  - [${m.direction}] ${m.kol.name}: ${m.content?.slice(0, 50)}...`));

  // Check TelegramGroupMessages
  const groupMessages = await prisma.telegramGroupMessage.findMany({
    orderBy: { timestamp: 'desc' },
    take: 10,
    include: {
      chat: { select: { title: true, type: true } }
    }
  });
  console.log('\nRecent Group Messages:', groupMessages.length);
  groupMessages.forEach(m => console.log(`  - [${m.direction}] ${m.chat.title}: ${m.content?.slice(0, 50)}...`));

  // Check Posts with DRAFT status (from /review command)
  const drafts = await prisma.post.findMany({
    where: { status: 'DRAFT' },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      kol: { select: { name: true } },
      campaign: { select: { name: true } }
    }
  });
  console.log('\nDraft Posts:', drafts.length);
  drafts.forEach(d => console.log(`  - ${d.kol?.name || 'Unknown'} for "${d.campaign?.name}": ${d.content?.slice(0, 50)}...`));

  await prisma.$disconnect();
}

main().catch(console.error);
