import { NextRequest, NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { paymentSchema } from "@/lib/validations";

// GET /api/payments - List all payments
export async function GET(request: NextRequest) {
  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (authContext.organizationType !== "AGENCY" && !authContext.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const kolId = searchParams.get("kolId");
    const campaignId = searchParams.get("campaignId");

    const payments = await db.payment.findMany({
      where: {
        kol: { organizationId: authContext.organizationId },
        ...(status && { status: status as any }),
        ...(kolId && { kolId }),
        ...(campaignId && { campaignId }),
      },
      include: {
        kol: {
          select: {
            id: true,
            name: true,
            twitterHandle: true,
            avatarUrl: true,
            walletAddress: true,
          },
        },
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(payments);
  } catch (error) {
    console.error("Error fetching payments:", error);
    return NextResponse.json(
      { error: "Failed to fetch payments" },
      { status: 500 }
    );
  }
}

// POST /api/payments - Create a new payment
export async function POST(request: NextRequest) {
  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (authContext.organizationType !== "AGENCY" && !authContext.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = paymentSchema.parse(body);

    // Verify KOL belongs to organization
    const kol = await db.kOL.findFirst({
      where: {
        id: validatedData.kolId,
        organizationId: authContext.organizationId,
      },
    });

    if (!kol) {
      return NextResponse.json({ error: "KOL not found" }, { status: 404 });
    }

    // Verify campaign belongs to organization if provided
    if (validatedData.campaignId) {
      const campaign = await db.campaign.findFirst({
        where: {
          id: validatedData.campaignId,
          agencyId: authContext.organizationId,
        },
      });

      if (!campaign) {
        return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
      }
    }

    // Convert amount to cents if provided in dollars
    const amountInCents = validatedData.amount * 100;

    const payment = await db.payment.create({
      data: {
        kolId: validatedData.kolId,
        campaignId: validatedData.campaignId || null,
        amount: amountInCents,
        currency: validatedData.currency,
        method: validatedData.method,
        walletAddress: validatedData.walletAddress || kol.walletAddress || null,
        network: validatedData.network || null,
        notes: validatedData.notes || null,
        status: "PENDING",
      },
      include: {
        kol: {
          select: {
            id: true,
            name: true,
            twitterHandle: true,
            avatarUrl: true,
          },
        },
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    console.error("Error creating payment:", error);

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create payment" },
      { status: 500 }
    );
  }
}
