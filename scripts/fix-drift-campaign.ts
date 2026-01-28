import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function fixDriftCampaign() {
  console.log("=== FIXING DRIFT CAMPAIGN CLIENT ASSIGNMENT ===\n");

  // The correct Drift client organization
  const correctClientId = "cmkxkahvr0009pfdri2pa0j6m"; // "Drift" with tracychow@drift.trade
  const campaignId = "cmkvqswnr00019cj2ebm4oap0";

  // Get current state
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      client: { select: { id: true, name: true } },
    },
  });

  if (!campaign) {
    console.log("❌ Campaign not found!");
    await prisma.$disconnect();
    return;
  }

  console.log("Current state:");
  console.log(`  Campaign: ${campaign.name}`);
  console.log(`  Current clientId: ${campaign.clientId}`);
  console.log(`  Current client name: ${campaign.client?.name || "none"}`);

  // Update the campaign
  console.log("\n🔧 Updating campaign...");
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { clientId: correctClientId },
  });
  console.log("✅ Updated campaign clientId to:", correctClientId);

  // Remove old junction entry if exists
  console.log("\n🔧 Updating junction table...");
  try {
    await prisma.campaignClient.deleteMany({
      where: { campaignId },
    });
    console.log("✅ Cleared old junction entries");
  } catch (e) {
    console.log("No old entries to clear");
  }

  // Add new junction entry
  await prisma.campaignClient.create({
    data: {
      campaignId,
      clientId: correctClientId,
    },
  });
  console.log("✅ Added correct client to junction table");

  // Verify
  const updated = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      client: {
        include: {
          members: {
            include: {
              user: { select: { email: true, name: true } },
            },
          },
        },
      },
      campaignClients: {
        include: {
          client: { select: { id: true, name: true } },
        },
      },
    },
  });

  console.log("\n=== VERIFICATION ===");
  console.log(`Campaign: ${updated?.name}`);
  console.log(`Client: ${updated?.client?.name} (${updated?.client?.id})`);
  console.log(`Client Members:`);
  updated?.client?.members.forEach((m) => {
    console.log(`  - ${m.user.email} (${m.user.name})`);
  });
  console.log(`Junction entries: ${updated?.campaignClients.length}`);
  updated?.campaignClients.forEach((cc) => {
    console.log(`  - ${cc.client.name}`);
  });

  console.log("\n✅ DONE! The Drift campaign is now linked to the correct client.");

  await prisma.$disconnect();
}

fixDriftCampaign();
