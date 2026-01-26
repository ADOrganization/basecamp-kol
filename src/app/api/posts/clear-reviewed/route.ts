import { NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function DELETE() {
  const authContext = await getApiAuthContext();

  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (authContext.organizationType !== "AGENCY" && !authContext.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Hide reviewed posts from review page (soft delete - posts remain in campaigns)
    const result = await db.post.updateMany({
      where: {
        campaign: {
          agencyId: authContext.organizationId,
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
