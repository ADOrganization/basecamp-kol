import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting seed...");

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
      name: "CryptoProject Labs",
      slug: "demo-client",
      type: "CLIENT",
    },
  });

  // Create second client
  const client2 = await prisma.organization.upsert({
    where: { slug: "defi-ventures" },
    update: {},
    create: {
      name: "DeFi Ventures",
      slug: "defi-ventures",
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

  // Create tags
  const tags = [
    { name: "DeFi Expert", color: "#3b82f6" },
    { name: "NFT Specialist", color: "#8b5cf6" },
    { name: "Gaming", color: "#22c55e" },
    { name: "Trading", color: "#f59e0b" },
    { name: "Technical", color: "#06b6d4" },
    { name: "Memes", color: "#ec4899" },
    { name: "Education", color: "#14b8a6" },
    { name: "News", color: "#6366f1" },
  ];

  const createdTags: { id: string; name: string }[] = [];
  for (const tag of tags) {
    const created = await prisma.kOLTag.upsert({
      where: {
        id: `tag-${tag.name.toLowerCase().replace(/\s/g, "-")}`,
      },
      update: {},
      create: {
        id: `tag-${tag.name.toLowerCase().replace(/\s/g, "-")}`,
        organizationId: agency.id,
        name: tag.name,
        color: tag.color,
      },
    });
    createdTags.push(created);
  }

  // Create KOLs with varied data
  const kolsData = [
    {
      name: "CryptoWhale",
      twitterHandle: "cryptowhale",
      tier: "MEGA" as const,
      followersCount: 1250000,
      avgEngagementRate: 0.035,
      ratePerPost: 500000,
      ratePerThread: 800000,
      ratePerRetweet: 150000,
      status: "ACTIVE" as const,
      walletAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f12345",
      tags: ["DeFi Expert", "Trading"],
    },
    {
      name: "DeFi Degen",
      twitterHandle: "defidegen",
      tier: "MACRO" as const,
      followersCount: 680000,
      avgEngagementRate: 0.042,
      ratePerPost: 250000,
      ratePerThread: 400000,
      ratePerRetweet: 80000,
      status: "ACTIVE" as const,
      walletAddress: "0x892d35Cc6634C0532925a3b844Bc9e7595f67890",
      tags: ["DeFi Expert", "Technical"],
    },
    {
      name: "NFT Hunter",
      twitterHandle: "nfthunter",
      tier: "MID" as const,
      followersCount: 320000,
      avgEngagementRate: 0.055,
      ratePerPost: 120000,
      ratePerThread: 200000,
      status: "ACTIVE" as const,
      walletAddress: "0x123d35Cc6634C0532925a3b844Bc9e7595f11111",
      tags: ["NFT Specialist", "Gaming"],
    },
    {
      name: "Alpha Caller",
      twitterHandle: "alphacaller",
      tier: "MICRO" as const,
      followersCount: 52000,
      avgEngagementRate: 0.08,
      ratePerPost: 35000,
      ratePerThread: 55000,
      status: "ACTIVE" as const,
      tags: ["Trading", "Technical"],
    },
    {
      name: "Meme Lord",
      twitterHandle: "memelord",
      tier: "MID" as const,
      followersCount: 185000,
      avgEngagementRate: 0.12,
      ratePerPost: 75000,
      ratePerThread: 120000,
      status: "ACTIVE" as const,
      tags: ["Memes"],
    },
    {
      name: "Crypto Educator",
      twitterHandle: "cryptoeducator",
      tier: "MACRO" as const,
      followersCount: 520000,
      avgEngagementRate: 0.038,
      ratePerPost: 180000,
      ratePerThread: 300000,
      status: "ACTIVE" as const,
      tags: ["Education", "DeFi Expert"],
    },
    {
      name: "GameFi King",
      twitterHandle: "gamefiking",
      tier: "MID" as const,
      followersCount: 245000,
      avgEngagementRate: 0.065,
      ratePerPost: 95000,
      ratePerThread: 160000,
      status: "ACTIVE" as const,
      tags: ["Gaming", "NFT Specialist"],
    },
    {
      name: "Chain News",
      twitterHandle: "chainnews",
      tier: "MACRO" as const,
      followersCount: 890000,
      avgEngagementRate: 0.025,
      ratePerPost: 220000,
      ratePerThread: 350000,
      status: "ACTIVE" as const,
      tags: ["News"],
    },
    {
      name: "Yield Farmer",
      twitterHandle: "yieldfarmer",
      tier: "MICRO" as const,
      followersCount: 38000,
      avgEngagementRate: 0.095,
      ratePerPost: 28000,
      ratePerThread: 45000,
      status: "PENDING" as const,
      tags: ["DeFi Expert"],
    },
    {
      name: "NFT Flipper",
      twitterHandle: "nftflipper",
      tier: "NANO" as const,
      followersCount: 8500,
      avgEngagementRate: 0.15,
      ratePerPost: 8000,
      status: "ACTIVE" as const,
      tags: ["NFT Specialist", "Trading"],
    },
  ];

  const createdKols: { id: string; name: string; ratePerPost: number | null }[] = [];
  for (const kol of kolsData) {
    const tagIds = createdTags
      .filter((t) => kol.tags.includes(t.name))
      .map((t) => ({ id: t.id }));

    const created = await prisma.kOL.upsert({
      where: {
        organizationId_twitterHandle: {
          organizationId: agency.id,
          twitterHandle: kol.twitterHandle,
        },
      },
      update: {
        tags: { set: tagIds },
      },
      create: {
        organizationId: agency.id,
        name: kol.name,
        twitterHandle: kol.twitterHandle,
        tier: kol.tier,
        followersCount: kol.followersCount,
        avgEngagementRate: kol.avgEngagementRate,
        ratePerPost: kol.ratePerPost,
        ratePerThread: kol.ratePerThread,
        ratePerRetweet: kol.ratePerRetweet,
        status: kol.status,
        walletAddress: kol.walletAddress,
        tags: { connect: tagIds },
      },
    });
    createdKols.push(created);
  }

  // Create campaigns
  const campaigns = [
    {
      id: "campaign-token-launch",
      name: "Token Launch Campaign",
      description: "Q1 launch campaign for new DeFi protocol. Focus on awareness and community building.",
      totalBudget: 5000000,
      spentBudget: 2850000,
      status: "ACTIVE" as const,
      clientId: client.id,
      kpis: { impressions: 5000000, engagement: 4, clicks: 50000, followers: 10000 },
      startDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    },
    {
      id: "campaign-nft-collection",
      name: "NFT Collection Drop",
      description: "Promoting the new generative art NFT collection launch.",
      totalBudget: 2500000,
      spentBudget: 800000,
      status: "ACTIVE" as const,
      clientId: client.id,
      kpis: { impressions: 2000000, engagement: 5 },
      startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
    },
    {
      id: "campaign-defi-protocol",
      name: "DeFi Protocol V2",
      description: "Announcing major protocol upgrade with new features.",
      totalBudget: 3500000,
      spentBudget: 3500000,
      status: "COMPLETED" as const,
      clientId: client2.id,
      kpis: { impressions: 3000000, engagement: 3.5 },
      startDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    },
    {
      id: "campaign-staking-launch",
      name: "Staking Platform Launch",
      description: "New staking mechanism with enhanced rewards.",
      totalBudget: 1800000,
      spentBudget: 0,
      status: "DRAFT" as const,
      clientId: client.id,
      kpis: { impressions: 1500000 },
      startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000),
    },
  ];

  for (const campaign of campaigns) {
    await prisma.campaign.upsert({
      where: { id: campaign.id },
      update: {
        spentBudget: campaign.spentBudget,
        status: campaign.status,
      },
      create: {
        ...campaign,
        agencyId: agency.id,
      },
    });
  }

  // Assign KOLs to campaigns and create posts
  const kolAssignments = [
    // Token Launch Campaign
    { campaignId: "campaign-token-launch", kolIndex: 0, status: "CONFIRMED" as const, budget: 500000 },
    { campaignId: "campaign-token-launch", kolIndex: 1, status: "CONFIRMED" as const, budget: 250000 },
    { campaignId: "campaign-token-launch", kolIndex: 2, status: "CONFIRMED" as const, budget: 120000 },
    { campaignId: "campaign-token-launch", kolIndex: 5, status: "CONFIRMED" as const, budget: 180000 },
    // NFT Collection
    { campaignId: "campaign-nft-collection", kolIndex: 2, status: "CONFIRMED" as const, budget: 120000 },
    { campaignId: "campaign-nft-collection", kolIndex: 4, status: "PENDING" as const, budget: 75000 },
    { campaignId: "campaign-nft-collection", kolIndex: 6, status: "CONFIRMED" as const, budget: 95000 },
    // DeFi Protocol (completed)
    { campaignId: "campaign-defi-protocol", kolIndex: 0, status: "COMPLETED" as const, budget: 500000 },
    { campaignId: "campaign-defi-protocol", kolIndex: 1, status: "COMPLETED" as const, budget: 250000 },
    { campaignId: "campaign-defi-protocol", kolIndex: 7, status: "COMPLETED" as const, budget: 220000 },
  ];

  for (const assignment of kolAssignments) {
    const kol = createdKols[assignment.kolIndex];
    if (!kol) continue;

    await prisma.campaignKOL.upsert({
      where: {
        campaignId_kolId: {
          campaignId: assignment.campaignId,
          kolId: kol.id,
        },
      },
      update: { status: assignment.status },
      create: {
        campaignId: assignment.campaignId,
        kolId: kol.id,
        assignedBudget: assignment.budget,
        status: assignment.status,
        deliverables: [
          { type: "POST", quantity: 3 },
          { type: "THREAD", quantity: 1 },
        ],
      },
    });
  }

  // Create posts with varied statuses
  const postsData = [
    // Token Launch - published posts
    {
      campaignId: "campaign-token-launch",
      kolIndex: 0,
      content: "Just discovered an incredible new DeFi protocol that's about to change the game! The tokenomics are solid and the team is doxxed. This is the alpha you've been waiting for. #DeFi #Crypto $DEMO",
      status: "POSTED" as const,
      daysAgo: 12,
      impressions: 485000,
      likes: 12500,
      retweets: 3200,
      replies: 890,
    },
    {
      campaignId: "campaign-token-launch",
      kolIndex: 1,
      content: "Thread time! Let me break down why this protocol is built different:\n\n1/ Innovative yield mechanism\n2/ Battle-tested smart contracts\n3/ Community-first approach\n\nRead on...",
      status: "POSTED" as const,
      type: "THREAD" as const,
      daysAgo: 10,
      impressions: 320000,
      likes: 8900,
      retweets: 2100,
      replies: 450,
    },
    {
      campaignId: "campaign-token-launch",
      kolIndex: 2,
      content: "The team behind this project just announced a major partnership. This is going to be huge for the ecosystem! Don't sleep on this one. #Crypto #Web3",
      status: "POSTED" as const,
      daysAgo: 8,
      impressions: 156000,
      likes: 4200,
      retweets: 980,
      replies: 210,
    },
    {
      campaignId: "campaign-token-launch",
      kolIndex: 5,
      content: "Educational thread: Understanding the mechanics behind this new protocol.\n\nI've analyzed the docs and here's what you need to know about the staking rewards system...",
      status: "POSTED" as const,
      type: "THREAD" as const,
      daysAgo: 5,
      impressions: 245000,
      likes: 6800,
      retweets: 1500,
      replies: 320,
    },
    // Pending approval
    {
      campaignId: "campaign-token-launch",
      kolIndex: 0,
      content: "Big announcement coming this week! The protocol is about to launch their mainnet. Stay tuned for more details. Who's ready? 🚀",
      status: "PENDING_APPROVAL" as const,
      daysAgo: 1,
    },
    {
      campaignId: "campaign-token-launch",
      kolIndex: 1,
      content: "Here's my honest review after using the testnet for 2 weeks. Spoiler: I'm impressed! The UX is smooth and gas optimization is on point.",
      status: "PENDING_APPROVAL" as const,
      daysAgo: 0,
    },
    // NFT Collection posts
    {
      campaignId: "campaign-nft-collection",
      kolIndex: 2,
      content: "This new NFT collection just dropped and the art is absolutely stunning! Limited supply of 5,000 pieces. The rarity distribution looks fair too.",
      status: "POSTED" as const,
      daysAgo: 3,
      impressions: 178000,
      likes: 5600,
      retweets: 1200,
      replies: 280,
    },
    {
      campaignId: "campaign-nft-collection",
      kolIndex: 6,
      content: "GameFi integration confirmed for this NFT collection! Holders will be able to use their NFTs in-game. This adds real utility beyond just speculation.",
      status: "APPROVED" as const,
      daysAgo: 1,
    },
    {
      campaignId: "campaign-nft-collection",
      kolIndex: 4,
      content: "POV: When the NFT collection you've been waiting for finally drops and the art is fire 🔥",
      status: "PENDING_APPROVAL" as const,
      daysAgo: 0,
    },
    // DeFi Protocol (completed campaign)
    {
      campaignId: "campaign-defi-protocol",
      kolIndex: 0,
      content: "The V2 upgrade is live! New features include cross-chain bridging, improved APY calculations, and a revamped UI. This protocol keeps delivering.",
      status: "POSTED" as const,
      daysAgo: 30,
      impressions: 520000,
      likes: 15000,
      retweets: 4100,
      replies: 920,
    },
    {
      campaignId: "campaign-defi-protocol",
      kolIndex: 1,
      content: "Just migrated my positions to V2 and the gas savings are insane! They really optimized the contracts. Bullish on this team.",
      status: "POSTED" as const,
      daysAgo: 28,
      impressions: 289000,
      likes: 7200,
      retweets: 1800,
      replies: 380,
    },
    {
      campaignId: "campaign-defi-protocol",
      kolIndex: 7,
      content: "BREAKING: Protocol V2 launch sees $50M TVL in first 24 hours. Full coverage and analysis in our latest article.",
      status: "POSTED" as const,
      daysAgo: 29,
      impressions: 412000,
      likes: 9800,
      retweets: 2900,
      replies: 520,
    },
    // Draft posts
    {
      campaignId: "campaign-token-launch",
      kolIndex: 5,
      content: "[DRAFT] Planning a comprehensive guide on how to get started with the protocol. Will cover wallet setup, staking, and earning rewards.",
      status: "DRAFT" as const,
      daysAgo: 0,
    },
  ];

  for (const post of postsData) {
    const kol = createdKols[post.kolIndex];
    if (!kol) continue;

    const postedAt = post.status === "POSTED"
      ? new Date(Date.now() - post.daysAgo * 24 * 60 * 60 * 1000)
      : null;

    await prisma.post.create({
      data: {
        campaignId: post.campaignId,
        kolId: kol.id,
        type: post.type || "POST",
        content: post.content,
        status: post.status,
        postedAt,
        impressions: post.impressions || 0,
        likes: post.likes || 0,
        retweets: post.retweets || 0,
        replies: post.replies || 0,
        tweetUrl: post.status === "POSTED" ? `https://twitter.com/${kol.name.toLowerCase().replace(/\s/g, "")}/status/${Math.random().toString().slice(2, 20)}` : null,
      },
    });
  }

  console.log("\n✅ Seed completed successfully!");
  console.log("\n=== Test Accounts ===");
  console.log("Agency: agency@demo.com / password123");
  console.log("Client: client@demo.com / password123");
  console.log("\n=== Created Data ===");
  console.log(`- ${createdKols.length} KOLs`);
  console.log(`- ${campaigns.length} Campaigns`);
  console.log(`- ${postsData.length} Posts`);
  console.log(`- ${tags.length} Tags`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
