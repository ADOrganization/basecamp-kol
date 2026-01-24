import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { campaignKolSchema } from "@/lib/validations";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.organizationType !== "AGENCY") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: campaignId } = await params;
    const body = await request.json();
    const validatedData = campaignKolSchema.parse(body);

    // Check if campaign exists and belongs to user's org
    const campaign = await db.campaign.findFirst({
      where: {
        id: campaignId,
        agencyId: session.user.organizationId,
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Check if KOL exists and belongs to user's org
    const kol = await db.kOL.findFirst({
      where: {
        id: validatedData.kolId,
        organizationId: session.user.organizationId,
      },
    });

    if (!kol) {
      return NextResponse.json({ error: "KOL not found" }, { status: 404 });
    }

    // Check if assignment already exists
    const existingAssignment = await db.campaignKOL.findUnique({
      where: {
        campaignId_kolId: {
          campaignId,
          kolId: validatedData.kolId,
        },
      },
    });

    if (existingAssignment) {
      return NextResponse.json(
        { error: "KOL is already assigned to this campaign" },
        { status: 400 }
      );
    }

    const campaignKol = await db.campaignKOL.create({
      data: {
        campaignId,
        kolId: validatedData.kolId,
        assignedBudget: validatedData.assignedBudget,
        deliverables: validatedData.deliverables ?? undefined,
        notes: validatedData.notes || null,
      },
      include: {
        kol: {
          select: {
            id: true,
            name: true,
            twitterHandle: true,
            tier: true,
          },
        },
      },
    });

    return NextResponse.json(campaignKol, { status: 201 });
  } catch (error) {
    console.error("Error assigning KOL to campaign:", error);

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to assign KOL to campaign" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.organizationType !== "AGENCY") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: campaignId } = await params;
    const { searchParams } = new URL(request.url);
    const kolId = searchParams.get("kolId");

    if (!kolId) {
      return NextResponse.json({ error: "KOL ID is required" }, { status: 400 });
    }

    // Check if campaign exists and belongs to user's org
    const campaign = await db.campaign.findFirst({
      where: {
        id: campaignId,
        agencyId: session.user.organizationId,
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    await db.campaignKOL.delete({
      where: {
        campaignId_kolId: {
          campaignId,
          kolId,
        },
      },
    });

    return NextResponse.json({ message: "KOL removed from campaign" });
  } catch (error) {
    console.error("Error removing KOL from campaign:", error);
    return NextResponse.json(
      { error: "Failed to remove KOL from campaign" },
      { status: 500 }
    );
  }
}
