import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const twitterSettingsSchema = z.object({
  twitterApiKey: z.string().optional(),
});

// GET - Retrieve Twitter settings
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const org = await db.organization.findUnique({
      where: { id: session.user.organizationId },
      select: {
        twitterApiKey: true,
      },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Mask the API key for security (show only last 4 chars)
    const maskedKey = org.twitterApiKey
      ? `${"*".repeat(Math.max(0, org.twitterApiKey.length - 4))}${org.twitterApiKey.slice(-4)}`
      : null;

    return NextResponse.json({
      hasApiKey: !!org.twitterApiKey,
      maskedApiKey: maskedKey,
    });
  } catch (error) {
    console.error("Error getting Twitter settings:", error);
    return NextResponse.json(
      { error: "Failed to get Twitter settings" },
      { status: 500 }
    );
  }
}

// PUT - Update Twitter settings
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission
    const membership = await db.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId: session.user.organizationId,
        role: { in: ["OWNER", "ADMIN"] },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "You don't have permission to update settings" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = twitterSettingsSchema.parse(body);

    await db.organization.update({
      where: { id: session.user.organizationId },
      data: {
        twitterApiKey: validatedData.twitterApiKey || null,
      },
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
