import { NextRequest, NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { encryptSensitiveData, safeDecrypt } from "@/lib/crypto";

const twitterSettingsSchema = z.object({
  apifyApiKey: z.string().optional(),
  socialDataApiKey: z.string().optional(),
});

// GET - Retrieve Twitter/API settings
export async function GET() {
  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const org = await db.organization.findUnique({
      where: { id: authContext.organizationId },
      select: {
        apifyApiKey: true,
        socialDataApiKey: true,
      },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // SECURITY: Decrypt keys if encrypted, then mask for display
    // Using safeDecrypt to handle both encrypted and plain text keys (for migration)
    const apifyKey = safeDecrypt(org.apifyApiKey);
    const socialDataKey = safeDecrypt(org.socialDataApiKey);

    // Mask the API keys for security (show only last 4 chars)
    const maskedApifyKey = apifyKey
      ? `${"*".repeat(Math.max(0, apifyKey.length - 4))}${apifyKey.slice(-4)}`
      : null;

    const maskedSocialDataKey = socialDataKey
      ? `${"*".repeat(Math.max(0, socialDataKey.length - 4))}${socialDataKey.slice(-4)}`
      : null;

    return NextResponse.json({
      hasApifyKey: !!org.apifyApiKey,
      maskedApifyKey: maskedApifyKey,
      hasSocialDataKey: !!org.socialDataApiKey,
      maskedSocialDataKey: maskedSocialDataKey,
    });
  } catch (error) {
    console.error("Error getting Twitter settings:", error);
    return NextResponse.json(
      { error: "Failed to get Twitter settings" },
      { status: 500 }
    );
  }
}

// PUT - Update Twitter/Apify settings
export async function PUT(request: NextRequest) {
  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission (admins bypass)
    if (!authContext.isAdmin) {
      const membership = await db.organizationMember.findFirst({
        where: {
          userId: authContext.userId,
          organizationId: authContext.organizationId,
          role: { in: ["OWNER", "ADMIN"] },
        },
      });

      if (!membership) {
        return NextResponse.json(
          { error: "You don't have permission to update settings" },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const validatedData = twitterSettingsSchema.parse(body);

    const updateData: { apifyApiKey?: string | null; socialDataApiKey?: string | null } = {};

    // SECURITY: Encrypt API keys before storing
    if (validatedData.apifyApiKey !== undefined) {
      updateData.apifyApiKey = validatedData.apifyApiKey
        ? encryptSensitiveData(validatedData.apifyApiKey)
        : null;
    }

    if (validatedData.socialDataApiKey !== undefined) {
      updateData.socialDataApiKey = validatedData.socialDataApiKey
        ? encryptSensitiveData(validatedData.socialDataApiKey)
        : null;
    }

    await db.organization.update({
      where: { id: authContext.organizationId },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating Twitter settings:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update Twitter settings" },
      { status: 500 }
    );
  }
}
