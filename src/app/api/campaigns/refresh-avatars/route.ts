import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchTwitterMedia } from "@/lib/scraper/x-scraper";

// POST - Refresh avatars and banners for all campaigns with Twitter handles
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.organizationType !== "AGENCY") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get campaigns with Twitter handles but missing avatars or banners
    const campaigns = await db.campaign.findMany({
      where: {
        agencyId: session.user.organizationId,
        projectTwitterHandle: { not: null },
        OR: [
          { projectAvatarUrl: null },
          { projectAvatarUrl: "" },
          { projectBannerUrl: null },
          { projectBannerUrl: "" },
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
        const media = await fetchTwitterMedia(handle);
        if (media.avatarUrl || media.bannerUrl) {
          await db.campaign.update({
            where: { id: campaign.id },
            data: {
              projectAvatarUrl: media.avatarUrl,
              projectBannerUrl: media.bannerUrl,
            },
          });
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        console.error(`Failed to fetch media for @${handle}:`, error);
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
    console.error("Error refreshing campaign media:", error);
    return NextResponse.json(
      { error: "Failed to refresh media" },
      { status: 500 }
    );
  }
}
