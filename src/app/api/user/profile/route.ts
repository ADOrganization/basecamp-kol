import { NextRequest, NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { fetchTwitterMedia } from "@/lib/scraper/x-scraper";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";

const profileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  twitterUsername: z.string().max(50).optional(),
  telegramUsername: z.string().max(50).optional(),
});

export async function PUT(request: NextRequest) {
  // SECURITY: Apply rate limiting
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.standard);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = profileSchema.parse(body);

    // Fetch avatar from X if username provided
    let avatarUrl: string | null = null;
    if (validatedData.twitterUsername) {
      const handle = validatedData.twitterUsername.replace(/^@/, "");
      try {
        // Get organization's API keys for scraping
        const org = await db.organization.findUnique({
          where: { id: authContext.organizationId },
          select: { socialDataApiKey: true },
        });

        if (org?.socialDataApiKey) {
          const { setSocialDataApiKey } = await import("@/lib/scraper/x-scraper");
          setSocialDataApiKey(org.socialDataApiKey);
        }

        const media = await fetchTwitterMedia(handle);
        if (media.avatarUrl) {
          avatarUrl = media.avatarUrl;
        }
      } catch (err) {
        console.log("Failed to fetch X avatar:", err);
        // Continue without avatar update
      }
    }

    // Admin users update AdminUser table, regular users update User table
    if (authContext.isAdmin) {
      const updateData: Record<string, unknown> = {
        name: validatedData.name,
        twitterUsername: validatedData.twitterUsername || null,
      };

      // Only update avatar if we fetched one
      if (avatarUrl) {
        updateData.avatarUrl = avatarUrl;
      }

      const updatedAdmin = await db.adminUser.update({
        where: { id: authContext.userId },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          twitterUsername: true,
        },
      });

      return NextResponse.json({
        ...updatedAdmin,
        telegramUsername: null,
      });
    }

    const updateData: Record<string, unknown> = {
      name: validatedData.name,
      twitterUsername: validatedData.twitterUsername || null,
      telegramUsername: validatedData.telegramUsername || null,
    };

    // Only update avatar if we fetched one
    if (avatarUrl) {
      updateData.avatarUrl = avatarUrl;
    }

    const updatedUser = await db.user.update({
      where: { id: authContext.userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
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
