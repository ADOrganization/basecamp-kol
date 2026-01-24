import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createPaymentSchema = z.object({
  kolId: z.string().min(1, "KOL is required"),
  campaignId: z.string().optional(),
  amount: z.number().min(1, "Amount must be positive"),
  method: z.enum(["CRYPTO", "BANK_TRANSFER", "PAYPAL", "OTHER"]),
  walletAddress: z.string().optional(),
  network: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.organizationType !== "AGENCY") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const kolId = searchParams.get("kolId");
    const campaignId = searchParams.get("campaignId");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {
      kol: {
        organizationId: session.user.organizationId,
      },
    };

    if (kolId) where.kolId = kolId;
    if (campaignId) where.campaignId = campaignId;
    if (status) where.status = status;

    const payments = await db.payment.findMany({
      where,
      include: {
        kol: {
          select: {
            id: true,
            name: true,
            twitterHandle: true,
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
      orderBy: {
        createdAt: "desc",
      },
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
    const validatedData = createPaymentSchema.parse(body);

    // Verify KOL belongs to this organization
    const kol = await db.kOL.findFirst({
      where: {
        id: validatedData.kolId,
        organizationId: session.user.organizationId,
      },
    });

    if (!kol) {
      return NextResponse.json({ error: "KOL not found" }, { status: 404 });
    }

    // If campaign specified, verify access
    if (validatedData.campaignId) {
      const campaign = await db.campaign.findFirst({
        where: {
          id: validatedData.campaignId,
          agencyId: session.user.organizationId,
        },
      });

      if (!campaign) {
        return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
      }
    }

    const payment = await db.payment.create({
      data: {
        kolId: validatedData.kolId,
        campaignId: validatedData.campaignId || null,
        amount: validatedData.amount,
        method: validatedData.method,
        status: "PENDING",
        walletAddress: validatedData.walletAddress || null,
        network: validatedData.network || null,
        notes: validatedData.notes || null,
      },
      include: {
        kol: {
          select: {
            id: true,
            name: true,
            twitterHandle: true,
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating payment:", error);
    return NextResponse.json(
      { error: "Failed to create payment" },
      { status: 500 }
    );
  }
}
