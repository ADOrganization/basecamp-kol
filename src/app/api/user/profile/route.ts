import { NextRequest, NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { z } from "zod";

const profileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  twitterUsername: z.string().max(50).optional(),
  telegramUsername: z.string().max(50).optional(),
});

export async function PUT(request: NextRequest) {
  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = profileSchema.parse(body);

    // Admin users update AdminUser table, regular users update User table
    if (authContext.isAdmin) {
      const updatedAdmin = await db.adminUser.update({
        where: { id: authContext.userId },
        data: {
          name: validatedData.name,
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      return NextResponse.json({
        ...updatedAdmin,
        twitterUsername: null,
        telegramUsername: null,
      });
    }

    const updatedUser = await db.user.update({
      where: { id: authContext.userId },
      data: {
        name: validatedData.name,
        twitterUsername: validatedData.twitterUsername || null,
        telegramUsername: validatedData.telegramUsername || null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        twitterUsername: true,
        telegramUsername: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Error updating profile:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
