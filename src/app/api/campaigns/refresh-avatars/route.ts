import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchTwitterMedia, setApifyApiKey, clearApifyApiKey, setSocialDataApiKey, clearSocialDataApiKey } from "@/lib/scraper/x-scraper";

// POST - Refresh avatars and banners for campaigns with Twitter handles
// Use ?force=true to refresh ALL campaigns, not just those missing media
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.organizationType !== "AGENCY") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("force") === "true";

    // Load organization's Apify API key for media fetching
    const org = await db.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { apifyApiKey: true },
    });

    if (org?.apifyApiKey) {
      setApifyApiKey(org.apifyApiKey);
      console.log(`[Refresh Avatars] Apify key configured`);
    } else {
      clearApifyApiKey();
      console.log(`[Refresh Avatars] No Apify key, using fallback methods (avatars only)`);
    }

    // Get campaigns with Twitter handles
    // If force=true, get all; otherwise only those missing media
    const campaigns = await db.campaign.findMany({
      where: {
        agencyId: session.user.organizationId,
        projectTwitterHandle: { not: null },
        ...(forceRefresh ? {} : {
          OR: [
            { projectAvatarUrl: null },
            { projectAvatarUrl: "" },
            { projectBannerUrl: null },
            { projectBannerUrl: "" },
          ],
        }),
      },
      select: {
        id: true,
        name: true,
        projectTwitterHandle: true,
      },
    });

    console.log(`[Refresh Avatars] Found ${campaigns.length} campaigns to refresh (force=${forceRefresh})`);

    let successCount = 0;
    let failCount = 0;
    const results: { name: string; handle: string; avatar: boolean; banner: boolean; error?: string }[] = [];

    for (const campaign of campaigns) {
      if (!campaign.projectTwitterHandle) continue;

      const handle = campaign.projectTwitterHandle.replace('@', '');
      try {
        console.log(`[Refresh Avatars] Fetching media for @${handle}...`);
        const media = await fetchTwitterMedia(handle);
        console.log(`[Refresh Avatars] @${handle}: avatar=${!!media.avatarUrl}, banner=${!!media.bannerUrl}`);

        if (media.avatarUrl || media.bannerUrl) {
          await db.campaign.update({
            where: { id: campaign.id },
            data: {
              projectAvatarUrl: media.avatarUrl,
              projectBannerUrl: media.bannerUrl,
            },
          });
          successCount++;
          results.push({
            name: campaign.name,
            handle,
            avatar: !!media.avatarUrl,
            banner: !!media.bannerUrl,
          });
        } else {
          failCount++;
          results.push({
            name: campaign.name,
            handle,
            avatar: false,
            banner: false,
            error: "No media found",
          });
        }
      } catch (error) {
        console.error(`Failed to fetch media for @${handle}:`, error);
        failCount++;
        results.push({
          name: campaign.name,
          handle,
          avatar: false,
          banner: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      total: campaigns.length,
      updated: successCount,
      failed: failCount,
      apifyConfigured: !!org?.apifyApiKey,
      results,
    });
  } catch (error) {
    console.error("Error refreshing campaign media:", error);
    return NextResponse.json(
      { error: "Failed to refresh media" },
      { status: 500 }
    );
  }
}
