import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchTwitterAvatar } from "@/lib/scraper/x-scraper";

// POST - Refresh avatars for all campaigns with Twitter handles
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.organizationType !== "AGENCY") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get campaigns with Twitter handles but missing avatars
    const campaigns = await db.campaign.findMany({
      where: {
        agencyId: session.user.organizationId,
        projectTwitterHandle: { not: null },
        OR: [
          { projectAvatarUrl: null },
          { projectAvatarUrl: "" },
        ],
      },
      select: {
        id: true,
        projectTwitterHandle: true,
      },
    });

    let successCount = 0;
    let failCount = 0;

    for (const campaign of campaigns) {
      if (!campaign.projectTwitterHandle) continue;

      const handle = campaign.projectTwitterHandle.replace('@', '');
      try {
        const avatarUrl = await fetchTwitterAvatar(handle);
        if (avatarUrl) {
          await db.campaign.update({
            where: { id: campaign.id },
            data: { projectAvatarUrl: avatarUrl },
          });
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        console.error(`Failed to fetch avatar for @${handle}:`, error);
        failCount++;
      }
    }

    return NextResponse.json({
      success: true,
      total: campaigns.length,
      updated: successCount,
      failed: failCount,
    });
  } catch (error) {
    console.error("Error refreshing campaign avatars:", error);
    return NextResponse.json(
      { error: "Failed to refresh avatars" },
      { status: 500 }
    );
  }
}
