import { NextRequest, NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";

/**
 * Debug endpoint to check campaign assignments and client linking.
 * GET /api/debug/campaigns
 *
 * Only accessible by agency users or admins.
 */
export async function GET(request: NextRequest) {
  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only allow agency users or admins
    if (authContext.organizationType !== "AGENCY" && !authContext.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const campaignName = searchParams.get("name");

    // Get all campaigns for this agency with their client assignments
    const campaigns = await db.campaign.findMany({
      where: {
        agencyId: authContext.organizationId,
        ...(campaignName && {
          name: { contains: campaignName, mode: "insensitive" as const },
        }),
      },
      select: {
        id: true,
        name: true,
        status: true,
        clientId: true,
        agencyId: true,
        createdAt: true,
        client: {
          select: { id: true, name: true, slug: true },
        },
        campaignClients: {
          include: {
            client: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        _count: {
          select: {
            posts: true,
            campaignKols: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get all client organizations
    const clientOrgs = await db.organization.findMany({
      where: { type: "CLIENT" },
      select: {
        id: true,
        name: true,
        slug: true,
        members: {
          include: {
            user: {
              select: { email: true, name: true },
            },
          },
        },
      },
    });

    // Get the agency info
    const agency = await db.organization.findUnique({
      where: { id: authContext.organizationId },
      select: { id: true, name: true, slug: true },
    });

    return NextResponse.json({
      agency,
      totalCampaigns: campaigns.length,
      campaigns: campaigns.map(c => ({
        id: c.id,
        name: c.name,
        status: c.status,
        clientId: c.clientId,
        client: c.client,
        campaignClients: c.campaignClients,
        counts: c._count,
      })),
      clientOrganizations: clientOrgs.map(org => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        memberCount: org.members.length,
        members: org.members.map(m => ({
          email: m.user.email,
          name: m.user.name,
        })),
      })),
    });
  } catch (error) {
    console.error("[Debug API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch debug data", details: String(error) },
      { status: 500 }
    );
  }
}
