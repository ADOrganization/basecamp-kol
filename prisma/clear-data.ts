import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function clearAllData() {
  console.log("Clearing all data from the database...\n");

  // Delete in order to respect foreign key constraints
  console.log("Deleting posts...");
  const deletedPosts = await prisma.post.deleteMany({});
  console.log(`  Deleted ${deletedPosts.count} posts`);

  console.log("Deleting campaign KOL assignments...");
  const deletedCampaignKols = await prisma.campaignKOL.deleteMany({});
  console.log(`  Deleted ${deletedCampaignKols.count} assignments`);

  console.log("Deleting campaigns...");
  const deletedCampaigns = await prisma.campaign.deleteMany({});
  console.log(`  Deleted ${deletedCampaigns.count} campaigns`);

  console.log("Deleting KOLs...");
  const deletedKols = await prisma.kOL.deleteMany({});
  console.log(`  Deleted ${deletedKols.count} KOLs`);

  console.log("Deleting KOL tags...");
  const deletedTags = await prisma.kOLTag.deleteMany({});
  console.log(`  Deleted ${deletedTags.count} tags`);

  console.log("Deleting organization members...");
  const deletedMembers = await prisma.organizationMember.deleteMany({});
  console.log(`  Deleted ${deletedMembers.count} members`);

  console.log("Deleting users...");
  const deletedUsers = await prisma.user.deleteMany({});
  console.log(`  Deleted ${deletedUsers.count} users`);

  console.log("Deleting organizations...");
  const deletedOrgs = await prisma.organization.deleteMany({});
  console.log(`  Deleted ${deletedOrgs.count} organizations`);

  console.log("\n✅ All data cleared successfully!");
  console.log("\nYou can now register a fresh account at /register");
}

clearAllData()
  .catch((e) => {
    console.error("Error clearing data:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
