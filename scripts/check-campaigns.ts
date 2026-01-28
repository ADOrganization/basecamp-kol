import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function check() {
  const campaigns = await prisma.campaign.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      clientId: true,
      agencyId: true,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  console.log("Campaigns:", JSON.stringify(campaigns, null, 2));

  const orgs = await prisma.organization.findMany({
    where: { type: "CLIENT" },
    select: { id: true, name: true, slug: true },
  });
  console.log("\nClient Organizations:", JSON.stringify(orgs, null, 2));

  // Check campaign clients junction table
  const campaignClients = await prisma.campaignClient.findMany({
    include: {
      campaign: { select: { name: true } },
      client: { select: { name: true } },
    },
  });
  console.log("\nCampaignClients Junction:", JSON.stringify(campaignClients, null, 2));

  await prisma.$disconnect();
}
check();
