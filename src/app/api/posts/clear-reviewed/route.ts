import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Hide reviewed posts from review page (soft delete - posts remain in campaigns)
    const result = await db.post.updateMany({
      where: {
        campaign: {
          agencyId: session.user.organizationId,
        },
        status: {
          in: ["APPROVED", "POSTED", "VERIFIED", "REJECTED", "CHANGES_REQUESTED"],
        },
        hiddenFromReview: false,
      },
      data: {
        hiddenFromReview: true,
      },
    });

    return NextResponse.json({
      success: true,
      hiddenCount: result.count
    });
  } catch (error) {
    console.error("Failed to clear reviewed posts:", error);
    return NextResponse.json(
      { error: "Failed to clear reviewed posts" },
      { status: 500 }
    );
  }
}
