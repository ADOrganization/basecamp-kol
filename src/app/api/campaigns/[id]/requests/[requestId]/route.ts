import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { joinRequestResponseSchema } from "@/lib/validations";
import { z } from "zod";

interface RouteContext {
  params: Promise<{ id: string; requestId: string }>;
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    const { id: campaignId, requestId } = await context.params;

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

    // Find the request
    const joinRequest = await db.campaignJoinRequest.findUnique({
      where: { id: requestId },
      include: { kol: true },
    });

    if (!joinRequest || joinRequest.campaignId !== campaignId) {
      return NextResponse.json(
        { error: "Request not found" },
        { status: 404 }
      );
    }

    if (joinRequest.status !== "PENDING") {
      return NextResponse.json(
        { error: "Request has already been processed" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = joinRequestResponseSchema.parse(body);

    // Update request
    const updatedRequest = await db.campaignJoinRequest.update({
      where: { id: requestId },
      data: {
        status: validatedData.status,
        responseNote: validatedData.responseNote,
        respondedAt: new Date(),
      },
    });

    // If approved, add KOL to campaign
    if (validatedData.status === "APPROVED") {
      await db.campaignKOL.create({
        data: {
          campaignId,
          kolId: joinRequest.kolId,
          status: "CONFIRMED",
        },
      });
    }

    return NextResponse.json(updatedRequest);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    console.error("Update request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
