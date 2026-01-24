import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { campaignSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const isAgency = session.user.organizationType === "AGENCY";

    const campaigns = await db.campaign.findMany({
      where: {
        ...(isAgency
          ? { agencyId: session.user.organizationId }
          : { clientId: session.user.organizationId }),
        ...(status && { status: status as "DRAFT" | "PENDING_APPROVAL" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED" }),
      },
      include: {
        client: {
          select: { id: true, name: true },
        },
        campaignKols: {
          include: {
            kol: {
              select: { id: true, name: true, twitterHandle: true },
            },
          },
        },
        posts: {
          select: { id: true, status: true },
        },
        _count: {
          select: {
            campaignKols: true,
            posts: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(campaigns);
  } catch (error) {
    console.error("Error fetching campaigns:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaigns" },
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
    const validatedData = campaignSchema.parse(body);

    const campaign = await db.campaign.create({
      data: {
        agencyId: session.user.organizationId,
        clientId: validatedData.clientId || null,
        name: validatedData.name,
        description: validatedData.description || null,
        totalBudget: validatedData.totalBudget,
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

    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    console.error("Error creating campaign:", error);

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create campaign" },
      { status: 500 }
    );
  }
}
