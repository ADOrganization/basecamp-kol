import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DiscoverCampaigns } from "./discover-campaigns";

export default async function KOLDiscoverCampaignsPage() {
  const session = await auth();

  if (!session?.user?.kolId) {
    redirect("/kol/login");
  }

  const kolId = session.user.kolId;

  // Fetch open campaigns that the KOL is not already part of
  const openCampaigns = await db.campaign.findMany({
    where: {
      visibility: "OPEN",
      status: { in: ["ACTIVE", "PENDING_APPROVAL"] },
      OR: [
        { applicationDeadline: null },
        { applicationDeadline: { gte: new Date() } },
      ],
      // Exclude campaigns the KOL is already assigned to
      NOT: {
        campaignKols: {
          some: { kolId },
        },
      },
    },
    include: {
      joinRequests: {
        where: { kolId },
      },
      _count: {
        select: { campaignKols: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const campaigns = openCampaigns.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    projectTwitterHandle: c.projectTwitterHandle,
    projectAvatarUrl: c.projectAvatarUrl,
    applicationDeadline: c.applicationDeadline,
    maxKolCount: c.maxKolCount,
    currentKolCount: c._count.campaignKols,
    keywords: c.keywords,
    existingRequest: c.joinRequests[0] || null,
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Discover Campaigns</h1>
        <p className="text-muted-foreground mt-1">
          Browse open campaigns and request to join
        </p>
      </div>

      <DiscoverCampaigns campaigns={campaigns} />
    </div>
  );
}
