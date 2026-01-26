import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.isKol || !session.user.kolId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
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

    return NextResponse.json(campaigns);
  } catch (error) {
    console.error("Get discover campaigns error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
