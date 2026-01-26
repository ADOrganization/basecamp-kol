import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { kolWalletSchema } from "@/lib/validations";
import { z } from "zod";

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

    const body = await request.json();

    // Validate input (network cannot be changed)
    const validatedData = kolWalletSchema.parse({
      ...body,
      network: existingWallet.network, // Keep existing network
    });

    // If this wallet is set as primary, unset other primary wallets for this network
    if (validatedData.isPrimary && !existingWallet.isPrimary) {
      await db.kOLWallet.updateMany({
        where: {
          kolId: session.user.kolId,
          network: existingWallet.network,
          isPrimary: true,
          id: { not: id },
        },
        data: { isPrimary: false },
      });
    }

    // Update wallet
    const wallet = await db.kOLWallet.update({
      where: { id },
      data: {
        address: validatedData.address,
        label: validatedData.label,
        isPrimary: validatedData.isPrimary ?? existingWallet.isPrimary,
      },
    });

    return NextResponse.json(wallet);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    console.error("Update wallet error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
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

    await db.kOLWallet.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete wallet error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
