import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Delete all reviewed posts (APPROVED, POSTED, VERIFIED, REJECTED) for this agency
    const result = await db.post.deleteMany({
      where: {
        campaign: {
          agencyId: session.user.organizationId,
        },
        status: {
          in: ["APPROVED", "POSTED", "VERIFIED", "REJECTED", "CHANGES_REQUESTED"],
        },
      },
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.count
    });
  } catch (error) {
    console.error("Failed to clear reviewed posts:", error);
    return NextResponse.json(
      { error: "Failed to clear reviewed posts" },
      { status: 500 }
    );
  }
}
