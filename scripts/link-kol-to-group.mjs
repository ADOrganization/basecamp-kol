import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Find the supergroup chat
  const supergroup = await prisma.telegramChat.findFirst({
    where: { type: 'SUPERGROUP' }
  });

  if (!supergroup) {
    console.log('No supergroup found');
    return;
  }

  console.log('Found supergroup:', supergroup.title, supergroup.id);

  // Find the KOL (Viperr)
  const kol = await prisma.kOL.findFirst({
    where: { telegramUsername: { not: null } }
  });

  if (!kol) {
    console.log('No KOL found');
    return;
  }

  console.log('Found KOL:', kol.name, kol.id);

  // Check existing links
  const existingLink = await prisma.telegramChatKOL.findFirst({
    where: { chatId: supergroup.id, kolId: kol.id }
  });

  if (existingLink) {
    console.log('Link already exists');
  } else {
    // Create link
    const link = await prisma.telegramChatKOL.create({
      data: {
        chatId: supergroup.id,
        kolId: kol.id,
        telegramUserId: '1501002829', // From the private chat link
        matchedBy: 'manual',
      }
    });
    console.log('Created link:', link.id);
  }

  // Verify links
  const links = await prisma.telegramChatKOL.findMany({
    include: {
      kol: { select: { name: true } },
      chat: { select: { title: true, type: true } }
    }
  });
  console.log('\nAll KOL Links:');
  links.forEach(l => console.log(`  - ${l.kol.name} -> ${l.chat.type}: ${l.chat.title}`));

  await prisma.$disconnect();
}

main().catch(console.error);
