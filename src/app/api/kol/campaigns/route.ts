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

    const campaignKols = await db.campaignKOL.findMany({
      where: { kolId: session.user.kolId },
      include: {
        campaign: {
          include: {
            posts: {
              where: { kolId: session.user.kolId },
            },
          },
        },
      },
      orderBy: {
        campaign: { createdAt: "desc" },
      },
    });

    const campaigns = campaignKols.map((ck) => ({
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
      completedDeliverables: ck.campaign.posts.filter(
        (p) => p.status === "VERIFIED" || p.status === "POSTED"
      ).length,
      kolStatus: ck.status,
    }));

    return NextResponse.json(campaigns);
  } catch (error) {
    console.error("Get campaigns error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
