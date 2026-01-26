import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    const { id: campaignId } = await context.params;

    if (!session?.user?.organizationType || session.user.organizationType !== "AGENCY") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Verify campaign belongs to the organization
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign || campaign.agencyId !== session.user.organizationId) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Fetch join requests
    const requests = await db.campaignJoinRequest.findMany({
      where: { campaignId },
      include: {
        kol: {
          select: {
            id: true,
            name: true,
            twitterHandle: true,
            avatarUrl: true,
            followersCount: true,
            tier: true,
            categories: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error("Get campaign requests error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
