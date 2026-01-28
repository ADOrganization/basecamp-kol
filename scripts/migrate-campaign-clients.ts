/**
 * Migration script to sync existing campaigns with clientId to the new CampaignClient junction table.
 * Run with: npx ts-node scripts/migrate-campaign-clients.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migrateCampaignClients() {
  console.log("Starting CampaignClient migration...\n");

  // Find all campaigns that have a clientId but no corresponding CampaignClient entry
  const campaigns = await prisma.campaign.findMany({
    where: {
      clientId: { not: null },
    },
    include: {
      campaignClients: true,
      client: {
        select: { id: true, name: true },
      },
    },
  });

  console.log(`Found ${campaigns.length} campaigns with clientId set.\n`);

  let migrated = 0;
  let alreadyMigrated = 0;
  let failed = 0;

  for (const campaign of campaigns) {
    if (!campaign.clientId) continue;

    // Check if already has a CampaignClient entry for this client
    const existingLink = campaign.campaignClients.find(
      (cc) => cc.clientId === campaign.clientId
    );

    if (existingLink) {
      console.log(`✓ Already migrated: "${campaign.name}" -> ${campaign.client?.name}`);
      alreadyMigrated++;
      continue;
    }

    try {
      await prisma.campaignClient.create({
        data: {
          campaignId: campaign.id,
          clientId: campaign.clientId,
        },
      });
      console.log(`✓ Migrated: "${campaign.name}" -> ${campaign.client?.name}`);
      migrated++;
    } catch (error) {
      console.error(`✗ Failed to migrate "${campaign.name}":`, error);
      failed++;
    }
  }

  console.log("\n=== Migration Summary ===");
  console.log(`Migrated: ${migrated}`);
  console.log(`Already migrated: ${alreadyMigrated}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${campaigns.length}`);
}

migrateCampaignClients()
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
