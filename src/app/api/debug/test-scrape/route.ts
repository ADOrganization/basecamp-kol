import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { scrapeSingleTweet, setApifyApiKey, hasApifyApiKey } from "@/lib/scraper/x-scraper";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.organizationType !== "AGENCY") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { tweetUrl } = await request.json();

    if (!tweetUrl) {
      return NextResponse.json({ error: "tweetUrl required" }, { status: 400 });
    }

    // Load org's Apify key
    const org = await db.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { apifyApiKey: true },
    });

    if (org?.apifyApiKey) {
      setApifyApiKey(org.apifyApiKey);
    }

    console.log(`[Debug] Testing scrape for: ${tweetUrl}`);
    console.log(`[Debug] Apify key configured: ${hasApifyApiKey()}`);

    const result = await scrapeSingleTweet(tweetUrl);

    console.log(`[Debug] Scrape result:`, JSON.stringify(result, null, 2));

    return NextResponse.json({
      apifyConfigured: hasApifyApiKey(),
      tweetUrl,
      result: result ? {
        id: result.id,
        content: result.content?.slice(0, 100),
        metrics: result.metrics,
        authorHandle: result.authorHandle,
      } : null,
    });
  } catch (error) {
    console.error("[Debug] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
