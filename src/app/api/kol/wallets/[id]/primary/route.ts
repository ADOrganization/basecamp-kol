import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    const { id } = await context.params;

    if (!session?.user?.isKol || !session.user.kolId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Verify wallet belongs to KOL
    const existingWallet = await db.kOLWallet.findUnique({
      where: { id },
    });

    if (!existingWallet || existingWallet.kolId !== session.user.kolId) {
      return NextResponse.json(
        { error: "Wallet not found" },
        { status: 404 }
      );
    }

    // Unset other primary wallets for this network and set this one as primary
    await db.$transaction([
      db.kOLWallet.updateMany({
        where: {
          kolId: session.user.kolId,
          network: existingWallet.network,
          isPrimary: true,
          id: { not: id },
        },
        data: { isPrimary: false },
      }),
      db.kOLWallet.update({
        where: { id },
        data: { isPrimary: true },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Set primary wallet error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
