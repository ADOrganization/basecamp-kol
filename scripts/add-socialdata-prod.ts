import { PrismaClient } from '@prisma/client';

// Use the production database URL
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

const SOCIALDATA_KEY = "4314|e3HiWvW8rfPkOp5jJgf2HZDVM7zJjJjXWVg6R0nZ3e2271d7";

async function main() {
  // Find all organizations
  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true, type: true, socialDataApiKey: true }
  });

  console.log("Found " + orgs.length + " organizations:");

  for (const org of orgs) {
    const hasKey = org.socialDataApiKey ? "has key" : "NO KEY";
    console.log("- " + org.name + " (" + org.type + ") - " + hasKey);
  }

  // Update all AGENCY organizations with the SocialData key (stored as plain text for now)
  const agencies = orgs.filter(o => o.type === 'AGENCY');

  if (agencies.length === 0) {
    console.log("\nNo agencies found. Let me show all orgs and update them:");
    for (const org of orgs) {
      await prisma.organization.update({
        where: { id: org.id },
        data: { socialDataApiKey: SOCIALDATA_KEY }
      });
      console.log("Updated: " + org.name);
    }
  } else {
    for (const agency of agencies) {
      await prisma.organization.update({
        where: { id: agency.id },
        data: { socialDataApiKey: SOCIALDATA_KEY }
      });
      console.log("\nUpdated agency: " + agency.name);
    }
  }

  console.log("\nDone! SocialData API key has been added.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
