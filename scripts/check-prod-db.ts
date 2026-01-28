import { PrismaClient } from "@prisma/client";

// Use production database URL
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function checkProdDatabase() {
  console.log("Connecting to production database...\n");

  try {
    // Check all campaigns
    const campaigns = await prisma.campaign.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        clientId: true,
        agencyId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    console.log("=== ALL CAMPAIGNS ===");
    console.log(`Total: ${campaigns.length}`);
    campaigns.forEach((c) => {
      console.log(`- ${c.name} (${c.status}) - clientId: ${c.clientId || "none"}`);
    });

    // Check for campaigns with "drift" in name (case insensitive)
    const driftCampaigns = await prisma.campaign.findMany({
      where: {
        name: { contains: "drift", mode: "insensitive" },
      },
    });

    console.log("\n=== DRIFT CAMPAIGNS ===");
    console.log(`Found: ${driftCampaigns.length}`);
    driftCampaigns.forEach((c) => {
      console.log(JSON.stringify(c, null, 2));
    });

    // Check all organizations
    const orgs = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        slug: true,
      },
    });

    console.log("\n=== ALL ORGANIZATIONS ===");
    orgs.forEach((o) => {
      console.log(`- ${o.name} (${o.type}) - ${o.slug}`);
    });

    // Check campaign clients junction
    const campaignClients = await prisma.campaignClient.findMany({
      include: {
        campaign: { select: { name: true } },
        client: { select: { name: true } },
      },
    });

    console.log("\n=== CAMPAIGN CLIENTS JUNCTION ===");
    console.log(`Total: ${campaignClients.length}`);
    campaignClients.forEach((cc) => {
      console.log(`- Campaign: ${cc.campaign.name} -> Client: ${cc.client.name}`);
    });

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProdDatabase();
