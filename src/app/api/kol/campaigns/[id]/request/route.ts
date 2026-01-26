import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { joinRequestSchema } from "@/lib/validations";
import { z } from "zod";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
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

    // Verify campaign exists and is open
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      include: {
        campaignKols: {
          where: { kolId },
        },
        joinRequests: {
          where: { kolId },
        },
        _count: {
          select: { campaignKols: true },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    if (campaign.visibility !== "OPEN") {
      return NextResponse.json(
        { error: "This campaign is not open for applications" },
        { status: 400 }
      );
    }

    // Check if already assigned
    if (campaign.campaignKols.length > 0) {
      return NextResponse.json(
        { error: "You are already assigned to this campaign" },
        { status: 400 }
      );
    }

    // Check if already has a pending request
    const existingRequest = campaign.joinRequests.find(
      (r) => r.status === "PENDING"
    );
    if (existingRequest) {
      return NextResponse.json(
        { error: "You already have a pending request for this campaign" },
        { status: 400 }
      );
    }

    // Check application deadline
    if (campaign.applicationDeadline && new Date() > campaign.applicationDeadline) {
      return NextResponse.json(
        { error: "Application deadline has passed" },
        { status: 400 }
      );
    }

    // Check max KOL count
    if (campaign.maxKolCount && campaign._count.campaignKols >= campaign.maxKolCount) {
      return NextResponse.json(
        { error: "Campaign is full" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = joinRequestSchema.parse(body);

    // Create join request
    const joinRequest = await db.campaignJoinRequest.create({
      data: {
        campaignId,
        kolId,
        message: validatedData.message,
        status: "PENDING",
      },
    });

    return NextResponse.json(joinRequest, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    console.error("Create join request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
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

    // Find existing pending request
    const existingRequest = await db.campaignJoinRequest.findFirst({
      where: {
        campaignId,
        kolId,
        status: "PENDING",
      },
    });

    if (!existingRequest) {
      return NextResponse.json(
        { error: "No pending request found" },
        { status: 404 }
      );
    }

    // Update to withdrawn status
    await db.campaignJoinRequest.update({
      where: { id: existingRequest.id },
      data: { status: "WITHDRAWN" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Withdraw join request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
