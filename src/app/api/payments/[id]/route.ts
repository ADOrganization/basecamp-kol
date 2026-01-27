import { NextRequest, NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/payments/[id] - Get payment details
export async function GET(request: NextRequest, context: RouteContext) {
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

    const { id } = await context.params;

    const payment = await db.payment.findFirst({
      where: {
        id,
        kol: { organizationId: authContext.organizationId },
      },
      include: {
        kol: {
          select: {
            id: true,
            name: true,
            twitterHandle: true,
            avatarUrl: true,
            walletAddress: true,
            email: true,
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

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    return NextResponse.json(payment);
  } catch (error) {
    console.error("Error fetching payment:", error);
    return NextResponse.json(
      { error: "Failed to fetch payment" },
      { status: 500 }
    );
  }
}

// PATCH /api/payments/[id] - Update payment status
export async function PATCH(request: NextRequest, context: RouteContext) {
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

    const { id } = await context.params;
    const body = await request.json();

    // Verify payment exists and belongs to organization
    const existingPayment = await db.payment.findFirst({
      where: {
        id,
        kol: { organizationId: authContext.organizationId },
      },
    });

    if (!existingPayment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // Build update data
    const updateData: {
      status?: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
      txHash?: string | null;
      notes?: string | null;
      paidAt?: Date | null;
    } = {};

    if (body.status) {
      const validStatuses = ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      updateData.status = body.status;

      // Set paidAt when marking as completed
      if (body.status === "COMPLETED" && !existingPayment.paidAt) {
        updateData.paidAt = new Date();
      }

      // Clear paidAt when reverting from completed
      if (body.status !== "COMPLETED" && existingPayment.status === "COMPLETED") {
        updateData.paidAt = null;
      }
    }

    if (body.txHash !== undefined) {
      updateData.txHash = body.txHash || null;
    }

    if (body.notes !== undefined) {
      updateData.notes = body.notes || null;
    }

    const payment = await db.payment.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json(payment);
  } catch (error) {
    console.error("Error updating payment:", error);
    return NextResponse.json(
      { error: "Failed to update payment" },
      { status: 500 }
    );
  }
}

// DELETE /api/payments/[id] - Delete a payment
export async function DELETE(request: NextRequest, context: RouteContext) {
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

    const { id } = await context.params;

    // Verify payment exists and belongs to organization
    const existingPayment = await db.payment.findFirst({
      where: {
        id,
        kol: { organizationId: authContext.organizationId },
      },
    });

    if (!existingPayment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // Only allow deleting pending payments
    if (existingPayment.status !== "PENDING") {
      return NextResponse.json(
        { error: "Only pending payments can be deleted" },
        { status: 400 }
      );
    }

    await db.payment.delete({ where: { id } });

    return NextResponse.json({ message: "Payment deleted successfully" });
  } catch (error) {
    console.error("Error deleting payment:", error);
    return NextResponse.json(
      { error: "Failed to delete payment" },
      { status: 500 }
    );
  }
}
