import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { kolRatesSchema } from "@/lib/validations";
import { z } from "zod";

export async function PUT(request: NextRequest) {
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
    const validatedData = kolRatesSchema.parse(body);

    // Update KOL rates
    const updatedKol = await db.kOL.update({
      where: { id: session.user.kolId },
      data: {
        ratePerPost: validatedData.ratePerPost,
        ratePerThread: validatedData.ratePerThread,
        ratePerRetweet: validatedData.ratePerRetweet,
        ratePerSpace: validatedData.ratePerSpace,
      },
    });

    return NextResponse.json(updatedKol);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    console.error("Update rates error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
