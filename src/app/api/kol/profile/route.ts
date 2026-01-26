import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { kolProfileSchema } from "@/lib/validations";
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

    const kol = await db.kOL.findUnique({
      where: { id: session.user.kolId },
      include: {
        account: { select: { email: true } },
        tags: true,
      },
    });

    if (!kol) {
      return NextResponse.json(
        { error: "KOL not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(kol);
  } catch (error) {
    console.error("Get profile error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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
    const validatedData = kolProfileSchema.parse(body);

    // Update KOL profile
    const updatedKol = await db.kOL.update({
      where: { id: session.user.kolId },
      data: {
        name: validatedData.name,
        bio: validatedData.bio,
        categories: validatedData.categories,
        twitterHandle: validatedData.twitterHandle,
        telegramUsername: validatedData.telegramUsername,
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

    console.error("Update profile error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
