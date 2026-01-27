import { NextRequest, NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";

const markReadSchema = z.object({
  kolId: z.string().min(1, "KOL ID is required"),
});

// POST - Mark all messages in a conversation as read
export async function POST(request: NextRequest) {
  // SECURITY: Apply rate limiting
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.standard);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { kolId } = markReadSchema.parse(body);

    // Verify KOL belongs to user's organization
    const kol = await db.kOL.findFirst({
      where: {
        id: kolId,
        organizationId: authContext.organizationId,
      },
    });

    if (!kol) {
      return NextResponse.json({ error: "KOL not found" }, { status: 404 });
    }

    // Mark all unread inbound messages for this KOL as read
    const result = await db.telegramMessage.updateMany({
      where: {
        kolId: kolId,
        isRead: false,
        direction: "INBOUND",
      },
      data: {
        isRead: true,
      },
    });

    return NextResponse.json({
      success: true,
      updatedCount: result.count,
    });
  } catch (error) {
    console.error("Error marking messages as read:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to mark messages as read" },
      { status: 500 }
    );
  }
}
