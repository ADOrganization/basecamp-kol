import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { postSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId");
    const kolId = searchParams.get("kolId");
    const status = searchParams.get("status");

    const isAgency = session.user.organizationType === "AGENCY";

    const posts = await db.post.findMany({
      where: {
        campaign: isAgency
          ? { agencyId: session.user.organizationId }
          : { clientId: session.user.organizationId },
        ...(campaignId && { campaignId }),
        ...(kolId && { kolId }),
        ...(status && { status: status as "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "SCHEDULED" | "POSTED" | "VERIFIED" }),
      },
      include: {
        kol: {
          select: { id: true, name: true, twitterHandle: true },
        },
        campaign: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(posts);
  } catch (error) {
    console.error("Error fetching posts:", error);
    return NextResponse.json(
      { error: "Failed to fetch posts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.organizationType !== "AGENCY") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = postSchema.parse(body);

    // Verify campaign belongs to user's org
    const campaign = await db.campaign.findFirst({
      where: {
        id: validatedData.campaignId,
        agencyId: session.user.organizationId,
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Verify KOL belongs to user's org
    const kol = await db.kOL.findFirst({
      where: {
        id: validatedData.kolId,
        organizationId: session.user.organizationId,
      },
    });

    if (!kol) {
      return NextResponse.json({ error: "KOL not found" }, { status: 404 });
    }

    const post = await db.post.create({
      data: {
        campaignId: validatedData.campaignId,
        kolId: validatedData.kolId,
        type: validatedData.type,
        content: validatedData.content || null,
        tweetUrl: validatedData.tweetUrl || null,
        scheduledFor: validatedData.scheduledFor
          ? new Date(validatedData.scheduledFor)
          : null,
        status: "DRAFT",
      },
      include: {
        kol: {
          select: { id: true, name: true, twitterHandle: true },
        },
        campaign: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    console.error("Error creating post:", error);

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create post" },
      { status: 500 }
    );
  }
}
