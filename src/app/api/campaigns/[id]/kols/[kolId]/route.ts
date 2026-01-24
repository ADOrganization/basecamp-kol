import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateCampaignKolSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "DECLINED", "COMPLETED"]).optional(),
  assignedBudget: z.number().optional(),
  deliverables: z
    .array(
      z.object({
        type: z.string(),
        quantity: z.number(),
      })
    )
    .optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; kolId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.organizationType !== "AGENCY") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: campaignId, kolId } = await params;
    const body = await request.json();
    const validatedData = updateCampaignKolSchema.parse(body);

    // Verify campaign belongs to agency
    const campaign = await db.campaign.findFirst({
      where: {
        id: campaignId,
        agencyId: session.user.organizationId,
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Find the campaign-kol assignment
    const campaignKol = await db.campaignKOL.findFirst({
      where: {
        campaignId,
        kolId,
      },
    });

    if (!campaignKol) {
      return NextResponse.json(
        { error: "KOL not assigned to this campaign" },
        { status: 404 }
      );
    }

    // Update the assignment
    const updated = await db.campaignKOL.update({
      where: { id: campaignKol.id },
      data: {
        status: validatedData.status ?? campaignKol.status,
        assignedBudget: validatedData.assignedBudget ?? campaignKol.assignedBudget,
        ...(validatedData.deliverables && { deliverables: validatedData.deliverables }),
      },
      include: {
        kol: {
          select: {
            id: true,
            name: true,
            twitterHandle: true,
            tier: true,
            followersCount: true,
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error updating campaign KOL:", error);
    return NextResponse.json(
      { error: "Failed to update campaign KOL" },
      { status: 500 }
    );
  }
}
