import { NextRequest, NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";

/**
 * Organization members API
 *
 * GET - List all members
 * POST - Legacy invite (now uses /api/admin/users/invite for magic link invitations)
 */

export async function POST(request: NextRequest) {
  // Redirect to new invitation system
  return NextResponse.json(
    {
      error: "This endpoint is deprecated",
      message: "Please use /api/admin/users/invite to send invitation emails.",
    },
    { status: 400 }
  );
}

export async function GET() {
  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const members = await db.organizationMember.findMany({
      where: { organizationId: authContext.organizationId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            isDisabled: true,
            lastLoginAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(members);
  } catch (error) {
    console.error("Error fetching members:", error);
    return NextResponse.json(
      { error: "Failed to fetch members" },
      { status: 500 }
    );
  }
}
