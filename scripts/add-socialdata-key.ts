import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const SOCIALDATA_KEY = "4314|e3HiWvW8rfPkOp5jJgf2HZDVM7zJjJjXWVg6R0nZ3e2271d7";

async function main() {
  // Find all AGENCY organizations and update their SocialData key
  const agencies = await prisma.organization.findMany({
    where: { type: 'AGENCY' },
    select: { id: true, name: true }
  });

  console.log("Found agencies:");
  for (const agency of agencies) {
    console.log("- " + agency.name + " (" + agency.id + ")");

    // Update with SocialData key
    await prisma.organization.update({
      where: { id: agency.id },
      data: { socialDataApiKey: SOCIALDATA_KEY }
    });
    console.log("  -> SocialData API key added!");
  }

  console.log("\nDone! SocialData API key has been added to all agencies.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
