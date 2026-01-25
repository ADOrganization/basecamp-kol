import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { kolSchema } from "@/lib/validations";
import { fetchTwitterAvatar } from "@/lib/scraper/x-scraper";
import { applyRateLimit, addSecurityHeaders, RATE_LIMITS } from "@/lib/api-security";

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Apply rate limiting to prevent scraping (30 req/min for sensitive data)
    const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.sensitive);
    if (rateLimitResponse) return rateLimitResponse;

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // SECURITY: Only agency users can access the full KOL roster
    // Clients can only see KOLs assigned to their campaigns via /api/campaigns/[id]
    if (session.user.organizationType !== "AGENCY") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const tier = searchParams.get("tier");
    const status = searchParams.get("status");

    const kols = await db.kOL.findMany({
      where: {
        organizationId: session.user.organizationId,
        ...(search && {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { twitterHandle: { contains: search, mode: "insensitive" } },
          ],
        }),
        ...(tier && { tier: tier as "SMALL" | "MID" | "LARGE" | "MACRO" | "NANO" | "MICRO" | "RISING" | "MEGA" }),
        ...(status && { status: status as "ACTIVE" | "INACTIVE" | "BLACKLISTED" | "PENDING" }),
      },
      include: {
        tags: true,
        campaignKols: {
          select: {
            assignedBudget: true,
          },
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

    // Calculate total earnings for each KOL (assignedBudget is in cents)
    const kolsWithEarnings = kols.map((kol) => {
      const totalEarningsCents = kol.campaignKols.reduce(
        (sum, ck) => sum + (ck.assignedBudget || 0),
        0
      );
      // Remove campaignKols from response to avoid exposing individual budget data
      const { campaignKols: _, ...kolData } = kol;
      return { ...kolData, totalEarnings: totalEarningsCents / 100 };
    });

    // Add security headers to prevent caching of sensitive data
    const response = NextResponse.json(kolsWithEarnings);
    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Error fetching KOLs:", error);
    return NextResponse.json(
      { error: "Failed to fetch KOLs" },
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
    const validatedData = kolSchema.parse(body);

    // Normalize twitter handle
    const twitterHandle = validatedData.twitterHandle.replace("@", "");

    // Check if KOL already exists
    const existingKol = await db.kOL.findUnique({
      where: {
        organizationId_twitterHandle: {
          organizationId: session.user.organizationId,
          twitterHandle,
        },
      },
    });

    if (existingKol) {
      return NextResponse.json(
        { error: "A KOL with this Twitter handle already exists" },
        { status: 400 }
      );
    }

    // Fetch Twitter avatar
    let avatarUrl: string | null = null;
    try {
      avatarUrl = await fetchTwitterAvatar(twitterHandle);
    } catch (error) {
      console.log("Failed to fetch Twitter avatar:", error);
    }

    const kol = await db.kOL.create({
      data: {
        organizationId: session.user.organizationId,
        name: validatedData.name,
        twitterHandle,
        avatarUrl,
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
        ...(validatedData.tagIds && validatedData.tagIds.length > 0 && {
          tags: {
            connect: validatedData.tagIds.map((id) => ({ id })),
          },
        }),
      },
      include: {
        tags: true,
      },
    });

    return NextResponse.json(kol, { status: 201 });
  } catch (error) {
    console.error("Error creating KOL:", error);

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create KOL" },
      { status: 500 }
    );
  }
}
