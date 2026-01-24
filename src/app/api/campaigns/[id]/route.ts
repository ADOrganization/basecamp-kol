import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { campaignSchema } from "@/lib/validations";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const isAgency = session.user.organizationType === "AGENCY";

    const campaign = await db.campaign.findFirst({
      where: {
        id,
        ...(isAgency
          ? { agencyId: session.user.organizationId }
          : { clientId: session.user.organizationId }),
      },
      include: {
        client: {
          select: { id: true, name: true, slug: true },
        },
        agency: {
          select: { id: true, name: true },
        },
        campaignKols: {
          include: {
            kol: {
              select: {
                id: true,
                name: true,
                twitterHandle: true,
                tier: true,
                followersCount: true,
                avgEngagementRate: true,
              },
            },
          },
        },
        posts: {
          include: {
            kol: {
              select: { id: true, name: true, twitterHandle: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json(campaign);
  } catch (error) {
    console.error("Error fetching campaign:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaign" },
      { status: 500 }
    );
  }
}

export async function PUT(
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

    const { id } = await params;
    const body = await request.json();
    const validatedData = campaignSchema.parse(body);

    // Check if campaign exists and belongs to user's org
    const existingCampaign = await db.campaign.findFirst({
      where: {
        id,
        agencyId: session.user.organizationId,
      },
    });

    if (!existingCampaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const campaign = await db.campaign.update({
      where: { id },
      data: {
        clientId: validatedData.clientId || null,
        name: validatedData.name,
        description: validatedData.description || null,
        projectTwitterHandle: validatedData.projectTwitterHandle || null,
        keywords: validatedData.keywords || [],
        totalBudget: validatedData.totalBudget || 0,
        status: validatedData.status,
        startDate: validatedData.startDate ? new Date(validatedData.startDate) : null,
        endDate: validatedData.endDate ? new Date(validatedData.endDate) : null,
        kpis: validatedData.kpis ?? undefined,
      },
      include: {
        client: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(campaign);
  } catch (error) {
    console.error("Error updating campaign:", error);

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update campaign" },
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

    const { id } = await params;

    // Check if campaign exists and belongs to user's org
    const existingCampaign = await db.campaign.findFirst({
      where: {
        id,
        agencyId: session.user.organizationId,
      },
    });

    if (!existingCampaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    await db.campaign.delete({ where: { id } });

    return NextResponse.json({ message: "Campaign deleted successfully" });
  } catch (error) {
    console.error("Error deleting campaign:", error);
    return NextResponse.json(
      { error: "Failed to delete campaign" },
      { status: 500 }
    );
  }
}
