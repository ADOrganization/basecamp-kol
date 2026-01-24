import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create test agency
  const agency = await prisma.organization.upsert({
    where: { slug: "demo-agency" },
    update: {},
    create: {
      name: "Demo Agency",
      slug: "demo-agency",
      type: "AGENCY",
    },
  });

  // Create test client
  const client = await prisma.organization.upsert({
    where: { slug: "demo-client" },
    update: {},
    create: {
      name: "Demo Client",
      slug: "demo-client",
      type: "CLIENT",
    },
  });

  // Create agency user
  const agencyUserPassword = await bcrypt.hash("password123", 12);
  const agencyUser = await prisma.user.upsert({
    where: { email: "agency@demo.com" },
    update: {},
    create: {
      email: "agency@demo.com",
      name: "Agency Admin",
      passwordHash: agencyUserPassword,
    },
  });

  // Create client user
  const clientUserPassword = await bcrypt.hash("password123", 12);
  const clientUser = await prisma.user.upsert({
    where: { email: "client@demo.com" },
    update: {},
    create: {
      email: "client@demo.com",
      name: "Client User",
      passwordHash: clientUserPassword,
    },
  });

  // Link users to organizations
  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: agency.id,
        userId: agencyUser.id,
      },
    },
    update: {},
    create: {
      organizationId: agency.id,
      userId: agencyUser.id,
      role: "OWNER",
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: client.id,
        userId: clientUser.id,
      },
    },
    update: {},
    create: {
      organizationId: client.id,
      userId: clientUser.id,
      role: "OWNER",
    },
  });

  // Create some sample KOLs
  const kols = [
    {
      name: "CryptoWhale",
      twitterHandle: "cryptowhale",
      tier: "MEGA" as const,
      followersCount: 1200000,
      avgEngagementRate: 0.035,
      ratePerPost: 500000, // $5000
      ratePerThread: 800000,
      status: "ACTIVE" as const,
    },
    {
      name: "DeFi Degen",
      twitterHandle: "defidegen",
      tier: "MACRO" as const,
      followersCount: 650000,
      avgEngagementRate: 0.042,
      ratePerPost: 250000,
      ratePerThread: 400000,
      status: "ACTIVE" as const,
    },
    {
      name: "NFT Hunter",
      twitterHandle: "nfthunter",
      tier: "MID" as const,
      followersCount: 280000,
      avgEngagementRate: 0.055,
      ratePerPost: 100000,
      ratePerThread: 180000,
      status: "ACTIVE" as const,
    },
    {
      name: "Alpha Caller",
      twitterHandle: "alphacaller",
      tier: "MICRO" as const,
      followersCount: 45000,
      avgEngagementRate: 0.08,
      ratePerPost: 30000,
      ratePerThread: 50000,
      status: "ACTIVE" as const,
    },
    {
      name: "Meme Lord",
      twitterHandle: "memelord",
      tier: "MICRO" as const,
      followersCount: 78000,
      avgEngagementRate: 0.12,
      ratePerPost: 45000,
      status: "PENDING" as const,
    },
  ];

  for (const kol of kols) {
    await prisma.kOL.upsert({
      where: {
        organizationId_twitterHandle: {
          organizationId: agency.id,
          twitterHandle: kol.twitterHandle,
        },
      },
      update: {},
      create: {
        organizationId: agency.id,
        ...kol,
      },
    });
  }

  // Create a sample campaign
  const campaign = await prisma.campaign.upsert({
    where: { id: "demo-campaign-1" },
    update: {},
    create: {
      id: "demo-campaign-1",
      agencyId: agency.id,
      clientId: client.id,
      name: "Token Launch Campaign",
      description: "Q1 launch campaign for new DeFi protocol",
      totalBudget: 5000000, // $50,000
      status: "ACTIVE",
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      kpis: {
        impressions: 5000000,
        engagement: 4,
        clicks: 50000,
        followers: 10000,
      },
    },
  });

  // Assign KOLs to campaign
  const allKols = await prisma.kOL.findMany({
    where: { organizationId: agency.id },
    take: 3,
  });

  for (const kol of allKols) {
    await prisma.campaignKOL.upsert({
      where: {
        campaignId_kolId: {
          campaignId: campaign.id,
          kolId: kol.id,
        },
      },
      update: {},
      create: {
        campaignId: campaign.id,
        kolId: kol.id,
        assignedBudget: kol.ratePerPost || 100000,
        status: "CONFIRMED",
      },
    });

    // Create sample posts
    await prisma.post.create({
      data: {
        campaignId: campaign.id,
        kolId: kol.id,
        type: "POST",
        content: `Excited to share about this new DeFi protocol! Check it out #DeFi #Crypto`,
        status: "POSTED",
        postedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        impressions: Math.floor(Math.random() * 500000) + 100000,
        likes: Math.floor(Math.random() * 5000) + 1000,
        retweets: Math.floor(Math.random() * 1000) + 200,
        replies: Math.floor(Math.random() * 500) + 50,
      },
    });
  }

  console.log("Seed completed successfully!");
  console.log("\n=== Test Accounts ===");
  console.log("Agency: agency@demo.com / password123");
  console.log("Client: client@demo.com / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
