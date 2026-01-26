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

    if (!session?.user?.isKol || !session.user.kolId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const kolId = session.user.kolId;

    // Fetch campaign and KOL's assignment
    const campaignKol = await db.campaignKOL.findUnique({
      where: {
        campaignId_kolId: {
          campaignId,
          kolId,
        },
      },
      include: {
        campaign: {
          include: {
            posts: {
              where: { kolId },
              orderBy: { createdAt: "desc" },
            },
            payments: {
              where: { kolId },
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
    });

    if (!campaignKol) {
      return NextResponse.json(
        { error: "Campaign not found or not assigned" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      campaign: campaignKol.campaign,
      assignment: {
        id: campaignKol.id,
        assignedBudget: campaignKol.assignedBudget,
        status: campaignKol.status,
        requiredPosts: campaignKol.requiredPosts,
        requiredThreads: campaignKol.requiredThreads,
        requiredRetweets: campaignKol.requiredRetweets,
        requiredSpaces: campaignKol.requiredSpaces,
        notes: campaignKol.notes,
      },
    });
  } catch (error) {
    console.error("Get campaign detail error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
