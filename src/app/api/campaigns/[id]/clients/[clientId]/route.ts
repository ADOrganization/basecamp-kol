import { NextRequest, NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";

/**
 * DELETE /api/campaigns/[id]/clients/[clientId]
 * Remove a client organization from a campaign
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; clientId: string }> }
) {
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.standard);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (authContext.organizationType !== "AGENCY" && !authContext.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: campaignId, clientId } = await params;

    // Verify campaign belongs to agency
    const campaign = await db.campaign.findFirst({
      where: {
        id: campaignId,
        agencyId: authContext.organizationId,
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Delete from junction table
    const deleted = await db.campaignClient.deleteMany({
      where: {
        campaignId,
        clientId,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: "Client not linked to campaign" }, { status: 404 });
    }

    // If this was the primary client, clear it
    if (campaign.clientId === clientId) {
      // Find another linked client to become primary, or set to null
      const remainingClient = await db.campaignClient.findFirst({
        where: { campaignId },
        select: { clientId: true },
      });

      await db.campaign.update({
        where: { id: campaignId },
        data: { clientId: remainingClient?.clientId || null },
      });
    }

    return NextResponse.json({ message: "Client removed from campaign" });
  } catch (error) {
    console.error("[Remove Campaign Client API] Error:", error);
    return NextResponse.json(
      { error: "Failed to remove client" },
      { status: 500 }
    );
  }
}
