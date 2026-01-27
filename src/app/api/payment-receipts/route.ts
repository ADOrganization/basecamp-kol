import { NextRequest, NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";

const receiptSchema = z.object({
  kolId: z.string(),
  campaignId: z.string().nullable().optional(),
  amount: z.number().min(0),
  proofUrl: z.string().url(),
});

export async function POST(request: NextRequest) {
  // SECURITY: Apply rate limiting
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.standard);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (authContext.organizationType !== "AGENCY" && !authContext.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = receiptSchema.parse(body);

    // Verify KOL belongs to the organization
    const kol = await db.kOL.findFirst({
      where: {
        id: validatedData.kolId,
        organizationId: authContext.organizationId,
      },
    });

    if (!kol) {
      return NextResponse.json({ error: "KOL not found" }, { status: 404 });
    }

    // Check for duplicate proof URL
    const existingReceipt = await db.paymentReceipt.findUnique({
      where: { proofUrl: validatedData.proofUrl },
    });

    if (existingReceipt) {
      return NextResponse.json(
        { error: "A receipt with this proof URL already exists" },
        { status: 400 }
      );
    }

    // If campaignId provided, verify it exists
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

    const receipt = await db.paymentReceipt.create({
      data: {
        kolId: validatedData.kolId,
        campaignId: validatedData.campaignId || null,
        amount: validatedData.amount,
        proofUrl: validatedData.proofUrl,
      },
      include: {
        campaign: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(receipt);
  } catch (error) {
    console.error("Error creating payment receipt:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create payment receipt" },
      { status: 500 }
    );
  }
}
