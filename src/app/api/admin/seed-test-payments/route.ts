import { NextRequest, NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";

/**
 * POST /api/admin/seed-test-payments
 * Creates test payment data for demonstration purposes.
 * Admin only endpoint.
 */
export async function POST(request: NextRequest) {
  try {
    const authContext = await getApiAuthContext();
    if (!authContext || !authContext.isAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Get all KOLs and campaigns for the organization
    const [kols, campaigns] = await Promise.all([
      db.kOL.findMany({
        where: { organizationId: authContext.organizationId },
        select: { id: true, name: true, walletAddress: true },
        take: 10,
      }),
      db.campaign.findMany({
        where: { agencyId: authContext.organizationId },
        select: { id: true, name: true },
        take: 5,
      }),
    ]);

    if (kols.length === 0) {
      return NextResponse.json(
        { error: "No KOLs found. Please add KOLs first." },
        { status: 400 }
      );
    }

    const statuses = ["PENDING", "PROCESSING", "COMPLETED", "COMPLETED", "COMPLETED"] as const;
    const methods = ["CRYPTO", "CRYPTO", "CRYPTO", "BANK_TRANSFER", "PAYPAL"] as const;
    const networks = ["ETH", "SOL", "MATIC", "ARB", "BASE"];
    const amounts = [50000, 75000, 100000, 150000, 200000, 250000, 300000, 500000]; // in cents

    const paymentsToCreate = [];
    const now = new Date();

    // Create 15-20 test payments spread over the last 6 months
    for (let i = 0; i < 18; i++) {
      const kol = kols[Math.floor(Math.random() * kols.length)];
      const campaign = campaigns.length > 0 && Math.random() > 0.3
        ? campaigns[Math.floor(Math.random() * campaigns.length)]
        : null;
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const method = methods[Math.floor(Math.random() * methods.length)];
      const amount = amounts[Math.floor(Math.random() * amounts.length)];

      // Random date within last 6 months
      const daysAgo = Math.floor(Math.random() * 180);
      const createdAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      const paidAt = status === "COMPLETED"
        ? new Date(createdAt.getTime() + Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000)
        : null;

      paymentsToCreate.push({
        kolId: kol.id,
        campaignId: campaign?.id || null,
        amount,
        currency: "USD",
        method,
        status,
        walletAddress: method === "CRYPTO" ? (kol.walletAddress || `0x${Math.random().toString(16).slice(2, 42)}`) : null,
        network: method === "CRYPTO" ? networks[Math.floor(Math.random() * networks.length)] : null,
        txHash: status === "COMPLETED" && method === "CRYPTO" ? `0x${Math.random().toString(16).slice(2, 66)}` : null,
        notes: Math.random() > 0.7 ? `Test payment for ${kol.name}` : null,
        paidAt,
        createdAt,
      });
    }

    // Create all payments
    const result = await db.payment.createMany({
      data: paymentsToCreate,
    });

    return NextResponse.json({
      success: true,
      message: `Created ${result.count} test payments`,
      paymentsCreated: result.count,
    });
  } catch (error) {
    console.error("Seed test payments error:", error);
    return NextResponse.json(
      { error: "Failed to create test payments" },
      { status: 500 }
    );
  }
}
