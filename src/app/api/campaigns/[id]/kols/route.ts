import { NextRequest, NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { campaignKolSchema } from "@/lib/validations";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (authContext.organizationType !== "AGENCY" && !authContext.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: campaignId } = await params;
    const body = await request.json();
    const validatedData = campaignKolSchema.parse(body);

    // Check if campaign exists and belongs to user's org
    const campaign = await db.campaign.findFirst({
      where: {
        id: campaignId,
        agencyId: authContext.organizationId,
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Check if KOL exists and belongs to user's org
    const kol = await db.kOL.findFirst({
      where: {
        id: validatedData.kolId,
        organizationId: authContext.organizationId,
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
        assignedBudget: validatedData.assignedBudget || 0,
        requiredPosts: validatedData.requiredPosts || 0,
        requiredThreads: validatedData.requiredThreads || 0,
        requiredRetweets: validatedData.requiredRetweets || 0,
        requiredSpaces: validatedData.requiredSpaces || 0,
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (authContext.organizationType !== "AGENCY" && !authContext.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: campaignId } = await params;
    const body = await request.json();
    const { kolId, assignedBudget, requiredPosts, requiredThreads, requiredRetweets, requiredSpaces } = body;

    if (!kolId) {
      return NextResponse.json({ error: "KOL ID is required" }, { status: 400 });
    }

    // Check if campaign exists and belongs to user's org
    const campaign = await db.campaign.findFirst({
      where: {
        id: campaignId,
        agencyId: authContext.organizationId,
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Check if assignment exists
    const existingAssignment = await db.campaignKOL.findUnique({
      where: {
        campaignId_kolId: {
          campaignId,
          kolId,
        },
      },
    });

    if (!existingAssignment) {
      return NextResponse.json({ error: "KOL is not assigned to this campaign" }, { status: 404 });
    }

    // Update the assignment
    const updatedCampaignKol = await db.campaignKOL.update({
      where: {
        campaignId_kolId: {
          campaignId,
          kolId,
        },
      },
      data: {
        ...(assignedBudget !== undefined && { assignedBudget }),
        ...(requiredPosts !== undefined && { requiredPosts }),
        ...(requiredThreads !== undefined && { requiredThreads }),
        ...(requiredRetweets !== undefined && { requiredRetweets }),
        ...(requiredSpaces !== undefined && { requiredSpaces }),
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

    return NextResponse.json(updatedCampaignKol);
  } catch (error) {
    console.error("Error updating KOL assignment:", error);
    return NextResponse.json(
      { error: "Failed to update KOL assignment" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (authContext.organizationType !== "AGENCY" && !authContext.isAdmin) {
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
        agencyId: authContext.organizationId,
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
