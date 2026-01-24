import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { kolSchema } from "@/lib/validations";

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

    const kol = await db.kOL.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        tags: true,
        campaignKols: {
          include: {
            campaign: true,
          },
        },
        posts: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        payments: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!kol) {
      return NextResponse.json({ error: "KOL not found" }, { status: 404 });
    }

    return NextResponse.json(kol);
  } catch (error) {
    console.error("Error fetching KOL:", error);
    return NextResponse.json(
      { error: "Failed to fetch KOL" },
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
    const validatedData = kolSchema.parse(body);

    // Check if KOL exists and belongs to user's org
    const existingKol = await db.kOL.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existingKol) {
      return NextResponse.json({ error: "KOL not found" }, { status: 404 });
    }

    const twitterHandle = validatedData.twitterHandle.replace("@", "");

    // Check for duplicate handle (excluding current KOL)
    if (twitterHandle !== existingKol.twitterHandle) {
      const duplicateKol = await db.kOL.findFirst({
        where: {
          organizationId: session.user.organizationId,
          twitterHandle,
          NOT: { id },
        },
      });

      if (duplicateKol) {
        return NextResponse.json(
          { error: "A KOL with this Twitter handle already exists" },
          { status: 400 }
        );
      }
    }

    const kol = await db.kOL.update({
      where: { id },
      data: {
        name: validatedData.name,
        twitterHandle,
        telegramUsername: validatedData.telegramUsername || null,
        email: validatedData.email || null,
        tier: validatedData.tier,
        status: validatedData.status,
        ratePerPost: validatedData.ratePerPost || null,
        ratePerThread: validatedData.ratePerThread || null,
        ratePerRetweet: validatedData.ratePerRetweet || null,
        ratePerSpace: validatedData.ratePerSpace || null,
        walletAddress: validatedData.walletAddress || null,
        paymentNotes: validatedData.paymentNotes || null,
        notes: validatedData.notes || null,
        tags: {
          set: validatedData.tagIds?.map((tagId) => ({ id: tagId })) || [],
        },
      },
      include: {
        tags: true,
      },
    });

    return NextResponse.json(kol);
  } catch (error) {
    console.error("Error updating KOL:", error);

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update KOL" },
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

    // Check if KOL exists and belongs to user's org
    const existingKol = await db.kOL.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existingKol) {
      return NextResponse.json({ error: "KOL not found" }, { status: 404 });
    }

    await db.kOL.delete({ where: { id } });

    return NextResponse.json({ message: "KOL deleted successfully" });
  } catch (error) {
    console.error("Error deleting KOL:", error);
    return NextResponse.json(
      { error: "Failed to delete KOL" },
      { status: 500 }
    );
  }
}
