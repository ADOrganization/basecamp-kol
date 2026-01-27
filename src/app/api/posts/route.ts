import { NextRequest, NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { postSchema } from "@/lib/validations";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";

// Helper function to find keyword matches in content
function findKeywordMatches(content: string, keywords: string[]): string[] {
  if (!content || !keywords || keywords.length === 0) return [];
  const lowerContent = content.toLowerCase();
  return keywords.filter(kw => lowerContent.includes(kw.toLowerCase()));
}

export async function GET(request: NextRequest) {
  // SECURITY: Apply rate limiting
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.standard);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId");
    const kolId = searchParams.get("kolId");
    const status = searchParams.get("status");

    const isAgency = authContext.organizationType === "AGENCY" || authContext.isAdmin;

    const posts = await db.post.findMany({
      where: {
        campaign: isAgency
          ? { agencyId: authContext.organizationId }
          : { clientId: authContext.organizationId },
        ...(campaignId && { campaignId }),
        ...(kolId && { kolId }),
        ...(status && { status: status as "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "SCHEDULED" | "POSTED" | "VERIFIED" }),
      },
      include: {
        kol: {
          select: { id: true, name: true, twitterHandle: true, avatarUrl: true },
        },
        campaign: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(posts);
  } catch (error) {
    console.error("Error fetching posts:", error);
    return NextResponse.json(
      { error: "Failed to fetch posts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // SECURITY: Apply rate limiting
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.standard);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (authContext.organizationType !== "AGENCY" && !authContext.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = postSchema.parse(body);

    // Verify campaign belongs to user's org
    const campaign = await db.campaign.findFirst({
      where: {
        id: validatedData.campaignId,
        agencyId: authContext.organizationId,
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Verify KOL belongs to user's org
    const kol = await db.kOL.findFirst({
      where: {
        id: validatedData.kolId,
        organizationId: authContext.organizationId,
      },
    });

    if (!kol) {
      return NextResponse.json({ error: "KOL not found" }, { status: 404 });
    }

    // Find keyword matches if content exists
    const matchedKeywords = validatedData.content
      ? findKeywordMatches(validatedData.content, campaign.keywords)
      : [];
    const hasKeywordMatch = matchedKeywords.length > 0;

    // Determine status - if tweet URL exists, it was posted (even if metrics are 0)
    const status = validatedData.tweetUrl ? "POSTED" : "DRAFT";

    const post = await db.post.create({
      data: {
        campaignId: validatedData.campaignId,
        kolId: validatedData.kolId,
        type: validatedData.type,
        content: validatedData.content || null,
        tweetUrl: validatedData.tweetUrl || null,
        scheduledFor: validatedData.scheduledFor
          ? new Date(validatedData.scheduledFor)
          : null,
        postedAt: validatedData.postedAt
          ? new Date(validatedData.postedAt)
          : (status === "POSTED" ? new Date() : null),
        status,
        matchedKeywords,
        hasKeywordMatch,
        impressions: validatedData.impressions || 0,
        likes: validatedData.likes || 0,
        retweets: validatedData.retweets || 0,
        replies: validatedData.replies || 0,
        quotes: validatedData.quotes || 0,
        bookmarks: validatedData.bookmarks || 0,
        clicks: validatedData.clicks || 0,
      },
      include: {
        kol: {
          select: { id: true, name: true, twitterHandle: true, avatarUrl: true },
        },
        campaign: {
          select: { id: true, name: true, keywords: true },
        },
      },
    });

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    console.error("Error creating post:", error);

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create post" },
      { status: 500 }
    );
  }
}
