import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true, type: true }
  });

  console.log("All organizations in database:");
  if (orgs.length === 0) {
    console.log("  (none found)");
  }
  for (const org of orgs) {
    console.log("- " + org.name + " (" + org.id + ") - Type: " + org.type);
  }

  // Show database URL (masked)
  const dbUrl = process.env.DATABASE_URL || "not set";
  const masked = dbUrl.replace(/:([^:@]+)@/, ":****@");
  console.log("\nDatabase URL: " + masked);
}

main().catch(console.error).finally(() => prisma.$disconnect());
