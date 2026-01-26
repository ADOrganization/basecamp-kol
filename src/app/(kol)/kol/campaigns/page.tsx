import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CampaignCard } from "@/components/kol/campaign-card";
import { Compass, Megaphone } from "lucide-react";

export default async function KOLCampaignsPage() {
  const session = await auth();

  if (!session?.user?.kolId) {
    redirect("/kol/login");
  }

  const kolId = session.user.kolId;

  // Fetch campaigns the KOL is assigned to
  const campaignKols = await db.campaignKOL.findMany({
    where: { kolId },
    include: {
      campaign: {
        include: {
          posts: {
            where: { kolId },
          },
        },
      },
    },
    orderBy: {
      campaign: { createdAt: "desc" },
    },
  });

  const campaigns = campaignKols.map((ck) => {
    const completedPosts = ck.campaign.posts.filter(
      (p) =>
        (p.status === "VERIFIED" || p.status === "POSTED") &&
        (p.type === "POST" || p.type === "THREAD" || p.type === "RETWEET" || p.type === "SPACE")
    );

    return {
      id: ck.campaign.id,
      name: ck.campaign.name,
      description: ck.campaign.description,
      projectTwitterHandle: ck.campaign.projectTwitterHandle,
      projectAvatarUrl: ck.campaign.projectAvatarUrl,
      status: ck.campaign.status,
      startDate: ck.campaign.startDate,
      endDate: ck.campaign.endDate,
      assignedBudget: ck.assignedBudget,
      requiredPosts: ck.requiredPosts,
      requiredThreads: ck.requiredThreads,
      requiredRetweets: ck.requiredRetweets,
      requiredSpaces: ck.requiredSpaces,
      completedDeliverables: completedPosts.length,
      kolStatus: ck.status,
    };
  });

  const activeCampaigns = campaigns.filter(
    (c) =>
      c.status === "ACTIVE" &&
      (c.kolStatus === "PENDING" || c.kolStatus === "CONFIRMED")
  );
  const completedCampaigns = campaigns.filter(
    (c) => c.status === "COMPLETED" || c.kolStatus === "COMPLETED"
  );
  const otherCampaigns = campaigns.filter(
    (c) =>
      !activeCampaigns.includes(c) && !completedCampaigns.includes(c)
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Campaigns</h1>
          <p className="text-muted-foreground mt-1">
            Manage your assigned campaigns and deliverables
          </p>
        </div>
        <Button asChild className="bg-purple-600 hover:bg-purple-700">
          <Link href="/kol/campaigns/discover">
            <Compass className="mr-2 h-4 w-4" />
            Discover Campaigns
          </Link>
        </Button>
      </div>

      {/* Active Campaigns */}
      <section>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Active Campaigns ({activeCampaigns.length})
        </h2>
        {activeCampaigns.length === 0 ? (
          <div className="text-center py-12 bg-muted/30 rounded-lg">
            <Megaphone className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">No active campaigns</p>
            <Button asChild variant="link" className="mt-2">
              <Link href="/kol/campaigns/discover">Discover open campaigns</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeCampaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        )}
      </section>

      {/* Pending/Other Campaigns */}
      {otherCampaigns.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Pending/Draft ({otherCampaigns.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {otherCampaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        </section>
      )}

      {/* Completed Campaigns */}
      {completedCampaigns.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Completed ({completedCampaigns.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {completedCampaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
