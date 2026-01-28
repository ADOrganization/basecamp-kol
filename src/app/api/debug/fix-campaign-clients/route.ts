import { NextRequest, NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";

/**
 * Debug endpoint to fix campaign-client assignments.
 * POST /api/debug/fix-campaign-clients
 *
 * This will sync all campaigns with clientId to the CampaignClient junction table.
 * Only accessible by agency users or admins.
 */
export async function POST(request: NextRequest) {
  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only allow agency users or admins
    if (authContext.organizationType !== "AGENCY" && !authContext.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Find all campaigns with clientId that don't have corresponding CampaignClient entries
    const campaigns = await db.campaign.findMany({
      where: {
        agencyId: authContext.organizationId,
        clientId: { not: null },
      },
      include: {
        campaignClients: true,
        client: { select: { id: true, name: true } },
      },
    });

    const results = {
      total: campaigns.length,
      fixed: 0,
      alreadyCorrect: 0,
      failed: 0,
      details: [] as { campaign: string; action: string; clientId: string }[],
    };

    for (const campaign of campaigns) {
      if (!campaign.clientId) continue;

      // Check if already has a CampaignClient entry for this client
      const existingLink = campaign.campaignClients.find(
        (cc) => cc.clientId === campaign.clientId
      );

      if (existingLink) {
        results.alreadyCorrect++;
        results.details.push({
          campaign: campaign.name,
          action: "already_linked",
          clientId: campaign.clientId,
        });
        continue;
      }

      try {
        await db.campaignClient.create({
          data: {
            campaignId: campaign.id,
            clientId: campaign.clientId,
          },
        });
        results.fixed++;
        results.details.push({
          campaign: campaign.name,
          action: "fixed",
          clientId: campaign.clientId,
        });
      } catch (error) {
        results.failed++;
        results.details.push({
          campaign: campaign.name,
          action: `failed: ${String(error)}`,
          clientId: campaign.clientId,
        });
      }
    }

    return NextResponse.json({
      message: "Campaign client fix complete",
      results,
    });
  } catch (error) {
    console.error("[Fix Campaign Clients API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fix campaign clients", details: String(error) },
      { status: 500 }
    );
  }
}
