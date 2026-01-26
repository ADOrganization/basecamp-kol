import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { kolWalletSchema } from "@/lib/validations";
import { z } from "zod";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.isKol || !session.user.kolId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const wallets = await db.kOLWallet.findMany({
      where: { kolId: session.user.kolId },
      orderBy: [{ network: "asc" }, { isPrimary: "desc" }, { createdAt: "asc" }],
    });

    return NextResponse.json(wallets);
  } catch (error) {
    console.error("Get wallets error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.isKol || !session.user.kolId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate input
    const validatedData = kolWalletSchema.parse(body);

    // If this wallet is set as primary, unset other primary wallets for this network
    if (validatedData.isPrimary) {
      await db.kOLWallet.updateMany({
        where: {
          kolId: session.user.kolId,
          network: validatedData.network,
          isPrimary: true,
        },
        data: { isPrimary: false },
      });
    }

    // Create wallet
    const wallet = await db.kOLWallet.create({
      data: {
        kolId: session.user.kolId,
        network: validatedData.network,
        address: validatedData.address,
        label: validatedData.label,
        isPrimary: validatedData.isPrimary ?? false,
      },
    });

    return NextResponse.json(wallet, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    // Handle unique constraint violation
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "This wallet address already exists for this network" },
        { status: 400 }
      );
    }

    console.error("Create wallet error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
