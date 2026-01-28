import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function checkDriftIssue() {
  console.log("=== INVESTIGATING DRIFT CAMPAIGN ISSUE ===\n");

  // Get the Drift campaign
  const campaign = await prisma.campaign.findFirst({
    where: { name: "Drift" },
    include: {
      agency: true,
      client: {
        include: {
          members: {
            include: {
              user: { select: { email: true, name: true } },
            },
          },
        },
      },
      campaignKols: {
        include: {
          kol: { select: { name: true, twitterHandle: true } },
        },
      },
      posts: { select: { id: true, status: true } },
    },
  });

  if (!campaign) {
    console.log("❌ Drift campaign NOT FOUND!");
    await prisma.$disconnect();
    return;
  }

  console.log("✅ DRIFT CAMPAIGN FOUND:");
  console.log(`   ID: ${campaign.id}`);
  console.log(`   Status: ${campaign.status}`);
  console.log(`   Agency ID: ${campaign.agencyId}`);
  console.log(`   Client ID: ${campaign.clientId}`);
  console.log(`   KOLs: ${campaign.campaignKols.length}`);
  console.log(`   Posts: ${campaign.posts.length}`);

  console.log("\n📊 AGENCY:");
  console.log(`   Name: ${campaign.agency.name}`);
  console.log(`   ID: ${campaign.agency.id}`);
  console.log(`   Slug: ${campaign.agency.slug}`);
  console.log(`   Type: ${campaign.agency.type}`);

  if (campaign.client) {
    console.log("\n👤 CLIENT ORGANIZATION:");
    console.log(`   Name: ${campaign.client.name}`);
    console.log(`   ID: ${campaign.client.id}`);
    console.log(`   Slug: ${campaign.client.slug}`);
    console.log(`   Type: ${campaign.client.type}`);
    console.log(`   Members: ${campaign.client.members.length}`);
    campaign.client.members.forEach((m) => {
      console.log(`      - ${m.user.email} (${m.user.name || "no name"}) - Role: ${m.role}`);
    });
  } else {
    console.log("\n❌ NO CLIENT ASSIGNED!");
  }

  console.log("\n🎯 KOLs ASSIGNED:");
  campaign.campaignKols.forEach((ck) => {
    console.log(`   - ${ck.kol.name} (@${ck.kol.twitterHandle}) - Status: ${ck.status}`);
  });

  // Check all organizations and their members
  console.log("\n\n=== ALL ORGANIZATIONS ===");
  const allOrgs = await prisma.organization.findMany({
    include: {
      members: {
        include: {
          user: { select: { email: true, name: true } },
        },
      },
    },
  });

  allOrgs.forEach((org) => {
    console.log(`\n📁 ${org.name} (${org.type})`);
    console.log(`   ID: ${org.id}`);
    console.log(`   Slug: ${org.slug}`);
    console.log(`   Members: ${org.members.length}`);
    org.members.forEach((m) => {
      console.log(`      - ${m.user.email} (Role: ${m.role})`);
    });
  });

  // Sync to junction table
  console.log("\n\n=== SYNCING TO JUNCTION TABLE ===");
  if (campaign.clientId) {
    try {
      const existing = await prisma.campaignClient.findUnique({
        where: {
          campaignId_clientId: {
            campaignId: campaign.id,
            clientId: campaign.clientId,
          },
        },
      });

      if (existing) {
        console.log("✅ Already in junction table");
      } else {
        await prisma.campaignClient.create({
          data: {
            campaignId: campaign.id,
            clientId: campaign.clientId,
          },
        });
        console.log("✅ Added to junction table!");
      }
    } catch (error) {
      console.log("❌ Failed to sync:", error);
    }
  }

  await prisma.$disconnect();
}

checkDriftIssue();
