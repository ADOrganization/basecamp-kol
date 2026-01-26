import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { campaignVisibilitySchema } from "@/lib/validations";
import { z } from "zod";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: NextRequest, context: RouteContext) {
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

    const body = await request.json();
    const validatedData = campaignVisibilitySchema.parse(body);

    // Update campaign visibility
    const updatedCampaign = await db.campaign.update({
      where: { id: campaignId },
      data: {
        visibility: validatedData.visibility,
        applicationDeadline: validatedData.applicationDeadline
          ? new Date(validatedData.applicationDeadline)
          : null,
        maxKolCount: validatedData.maxKolCount,
      },
    });

    return NextResponse.json(updatedCampaign);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    console.error("Update visibility error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
