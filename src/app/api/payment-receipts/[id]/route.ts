import { NextRequest, NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";

const updateSchema = z.object({
  campaignId: z.string().nullable().optional(),
  amount: z.number().min(0).optional(),
  proofUrl: z.string().url().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateSchema.parse(body);

    // Verify receipt exists and belongs to org
    const existingReceipt = await db.paymentReceipt.findUnique({
      where: { id },
      include: {
        kol: { select: { organizationId: true } },
      },
    });

    if (!existingReceipt) {
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
    }

    if (existingReceipt.kol.organizationId !== authContext.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check for duplicate proof URL if it's being changed
    if (validatedData.proofUrl && validatedData.proofUrl !== existingReceipt.proofUrl) {
      const duplicateReceipt = await db.paymentReceipt.findUnique({
        where: { proofUrl: validatedData.proofUrl },
      });

      if (duplicateReceipt) {
        return NextResponse.json(
          { error: "A receipt with this proof URL already exists" },
          { status: 400 }
        );
      }
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

    const receipt = await db.paymentReceipt.update({
      where: { id },
      data: {
        ...(validatedData.campaignId !== undefined && { campaignId: validatedData.campaignId }),
        ...(validatedData.amount !== undefined && { amount: validatedData.amount }),
        ...(validatedData.proofUrl !== undefined && { proofUrl: validatedData.proofUrl }),
      },
      include: {
        campaign: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(receipt);
  } catch (error) {
    console.error("Error updating payment receipt:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update payment receipt" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // Verify receipt exists and belongs to org
    const existingReceipt = await db.paymentReceipt.findUnique({
      where: { id },
      include: {
        kol: { select: { organizationId: true } },
      },
    });

    if (!existingReceipt) {
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
    }

    if (existingReceipt.kol.organizationId !== authContext.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db.paymentReceipt.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Receipt deleted successfully" });
  } catch (error) {
    console.error("Error deleting payment receipt:", error);
    return NextResponse.json(
      { error: "Failed to delete payment receipt" },
      { status: 500 }
    );
  }
}
