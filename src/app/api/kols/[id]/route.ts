import { NextRequest, NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { kolSchema } from "@/lib/validations";
import { fetchTwitterAvatar, fetchTwitterProfile } from "@/lib/scraper/x-scraper";
import { applyRateLimit, addSecurityHeaders, RATE_LIMITS } from "@/lib/api-security";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`[KOL API] Request for KOL: ${id}`);

    // Get auth context
    const authContext = await getApiAuthContext();
    console.log(`[KOL API] Auth context:`, authContext ? { orgId: authContext.organizationId, isAdmin: authContext.isAdmin } : "null");

    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (authContext.organizationType !== "AGENCY" && !authContext.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.log(`[KOL API] Querying KOL ${id} for org ${authContext.organizationId}`);

    // Simple query first
    const kol = await db.kOL.findFirst({
      where: {
        id,
        organizationId: authContext.organizationId,
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

    console.log(`[KOL API] KOL found: ${kol ? kol.name : "null"}`);

    if (!kol) {
      // Debug: check if KOL exists at all
      const kolExists = await db.kOL.findUnique({
        where: { id },
        select: { id: true, organizationId: true, name: true },
      });
      console.log(`[KOL API] KOL exists in any org?`, kolExists);
      return NextResponse.json({ error: "KOL not found" }, { status: 404 });
    }

    // Try to get payment receipts separately
    let paymentReceipts: any[] = [];
    try {
      paymentReceipts = await db.paymentReceipt.findMany({
        where: { kolId: kol.id },
        orderBy: { createdAt: "desc" },
        include: {
          campaign: { select: { id: true, name: true } },
        },
      });
    } catch (e) {
      console.log("[KOL API] PaymentReceipts query failed:", e);
    }

    return NextResponse.json({ ...kol, paymentReceipts });
  } catch (error) {
    console.error("[KOL API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch KOL", details: error instanceof Error ? error.message : "Unknown" },
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

    const { id } = await params;
    const body = await request.json();
    const validatedData = kolSchema.parse(body);

    // Check if KOL exists and belongs to user's org
    const existingKol = await db.kOL.findFirst({
      where: {
        id,
        organizationId: authContext.organizationId,
      },
    });

    if (!existingKol) {
      return NextResponse.json({ error: "KOL not found" }, { status: 404 });
    }

    const twitterHandle = validatedData.twitterHandle.replace("@", "");

    // Check for duplicate handle (excluding current KOL)
    let avatarUrl = existingKol.avatarUrl;
    let followersCount: number | null = existingKol.followersCount;

    if (twitterHandle !== existingKol.twitterHandle) {
      const duplicateKol = await db.kOL.findFirst({
        where: {
          organizationId: authContext.organizationId,
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

      // Twitter handle changed - fetch new profile (avatar + followers)
      try {
        const profile = await fetchTwitterProfile(twitterHandle);
        if (profile) {
          avatarUrl = profile.avatarUrl;
          followersCount = profile.followersCount > 0 ? profile.followersCount : null;
          console.log(`[KOL Update] Fetched profile for @${twitterHandle}: ${followersCount} followers`);
        }
      } catch (error) {
        console.log("Failed to fetch Twitter profile:", error);
        // Fallback to just avatar
        try {
          avatarUrl = await fetchTwitterAvatar(twitterHandle);
        } catch {
          console.log("Failed to fetch Twitter avatar as fallback");
        }
      }
    } else if (!existingKol.avatarUrl || !existingKol.followersCount) {
      // Missing avatar or followers - try to fetch
      try {
        const profile = await fetchTwitterProfile(twitterHandle);
        if (profile) {
          avatarUrl = profile.avatarUrl || existingKol.avatarUrl;
          followersCount = profile.followersCount > 0 ? profile.followersCount : existingKol.followersCount;
        }
      } catch (error) {
        console.log("Failed to fetch Twitter profile:", error);
      }
    }

    const kol = await db.kOL.update({
      where: { id },
      data: {
        name: validatedData.name,
        twitterHandle,
        avatarUrl,
        ...(followersCount !== null && { followersCount }),
        telegramUsername: validatedData.telegramUsername || null,
        telegramGroupId: validatedData.telegramGroupId || null,
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
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (authContext.organizationType !== "AGENCY" && !authContext.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Check if KOL exists and belongs to user's org
    const existingKol = await db.kOL.findFirst({
      where: {
        id,
        organizationId: authContext.organizationId,
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
