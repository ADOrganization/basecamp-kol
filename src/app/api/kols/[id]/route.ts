import { NextRequest, NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { kolSchema } from "@/lib/validations";
import { fetchTwitterAvatar } from "@/lib/scraper/x-scraper";
import { applyRateLimit, addSecurityHeaders, RATE_LIMITS } from "@/lib/api-security";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // SECURITY: Apply rate limiting to prevent scraping (30 req/min for sensitive data)
    const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.sensitive);
    if (rateLimitResponse) return rateLimitResponse;

    const authContext = await getApiAuthContext();
    console.log(`[KOL API] Auth context:`, authContext ? { orgId: authContext.organizationId, isAdmin: authContext.isAdmin } : null);

    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // SECURITY: Only agency users can access individual KOL details
    // Clients can only see KOL data through campaign endpoints
    if (authContext.organizationType !== "AGENCY" && !authContext.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    console.log(`[KOL API] Fetching KOL ${id} for org ${authContext.organizationId}`);

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
        paymentReceipts: {
          orderBy: { createdAt: "desc" },
          include: {
            campaign: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!kol) {
      // Check if KOL exists but belongs to different org
      const kolAnyOrg = await db.kOL.findUnique({
        where: { id },
        select: { id: true, organizationId: true, name: true },
      });
      console.log(`[KOL API] KOL not found for org. KOL exists?`, kolAnyOrg);
      return NextResponse.json({ error: "KOL not found" }, { status: 404 });
    }

    const kolData = kol;

    // Add security headers to prevent caching of sensitive data
    const response = NextResponse.json(kolData);
    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Error fetching KOL:", error);
    // Include more error details for debugging
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("Error details:", { message: errorMessage, stack: errorStack });
    return NextResponse.json(
      { error: "Failed to fetch KOL", details: errorMessage },
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

      // Twitter handle changed - fetch new avatar
      try {
        avatarUrl = await fetchTwitterAvatar(twitterHandle);
      } catch (error) {
        console.log("Failed to fetch Twitter avatar:", error);
      }
    } else if (!existingKol.avatarUrl) {
      // No avatar yet - try to fetch one
      try {
        avatarUrl = await fetchTwitterAvatar(twitterHandle);
      } catch (error) {
        console.log("Failed to fetch Twitter avatar:", error);
      }
    }

    const kol = await db.kOL.update({
      where: { id },
      data: {
        name: validatedData.name,
        twitterHandle,
        avatarUrl,
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
