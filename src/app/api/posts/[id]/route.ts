import { NextRequest, NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { postApprovalSchema } from "@/lib/validations";
import { TelegramClient } from "@/lib/telegram/client";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";
import { refreshPostMetrics } from "@/lib/metrics-refresh";

// Helper function to find keyword matches in content
function findKeywordMatches(content: string, keywords: string[]): string[] {
  if (!content || !keywords || keywords.length === 0) return [];
  const lowerContent = content.toLowerCase();
  return keywords.filter(kw => lowerContent.includes(kw.toLowerCase()));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Apply rate limiting
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.standard);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const isAgency = authContext.organizationType === "AGENCY" || authContext.isAdmin;

    const post = await db.post.findFirst({
      where: {
        id,
        campaign: isAgency
          ? { agencyId: authContext.organizationId }
          : { clientId: authContext.organizationId },
      },
      include: {
        kol: {
          select: {
            id: true,
            name: true,
            twitterHandle: true,
            tier: true,
            followersCount: true,
          },
        },
        campaign: {
          select: { id: true, name: true, status: true },
        },
      },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json(post);
  } catch (error) {
    console.error("Error fetching post:", error);
    return NextResponse.json(
      { error: "Failed to fetch post" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Apply rate limiting
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.standard);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const isAgency = authContext.organizationType === "AGENCY" || authContext.isAdmin;

    // Verify post access and get campaign keywords
    const existingPost = await db.post.findFirst({
      where: {
        id,
        campaign: isAgency
          ? { agencyId: authContext.organizationId }
          : { clientId: authContext.organizationId },
      },
      include: {
        campaign: {
          select: { keywords: true },
        },
      },
    });

    if (!existingPost) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Client can only approve/reject
    if (!isAgency) {
      const validatedData = postApprovalSchema.parse(body);
      const post = await db.post.update({
        where: { id },
        data: {
          status: validatedData.status,
          clientNotes: validatedData.clientNotes || null,
        },
      });

      // Send Telegram notification for status changes
      if (["APPROVED", "REJECTED", "CHANGES_REQUESTED"].includes(validatedData.status)) {
        await sendStatusNotification(
          id,
          validatedData.status,
          validatedData.clientNotes || null,
          authContext.organizationId
        );
      }

      return NextResponse.json(post);
    }

    // Recalculate keyword matches if content is updated
    const newContent = body.content !== undefined ? body.content : existingPost.content;
    const matchedKeywords = newContent
      ? findKeywordMatches(newContent, existingPost.campaign.keywords)
      : [];
    const hasKeywordMatch = matchedKeywords.length > 0;

    // Agency can update all fields
    const newStatus = body.status || existingPost.status;
    const post = await db.post.update({
      where: { id },
      data: {
        type: body.type || existingPost.type,
        content: body.content !== undefined ? body.content : existingPost.content,
        tweetUrl: body.tweetUrl !== undefined ? body.tweetUrl : existingPost.tweetUrl,
        tweetId: body.tweetId !== undefined ? body.tweetId : existingPost.tweetId,
        status: newStatus,
        clientNotes: body.clientNotes !== undefined ? body.clientNotes : existingPost.clientNotes,
        scheduledFor: body.scheduledFor
          ? new Date(body.scheduledFor)
          : existingPost.scheduledFor,
        postedAt: body.postedAt ? new Date(body.postedAt) : existingPost.postedAt,
        matchedKeywords,
        hasKeywordMatch,
        impressions: body.impressions ?? existingPost.impressions,
        likes: body.likes ?? existingPost.likes,
        retweets: body.retweets ?? existingPost.retweets,
        replies: body.replies ?? existingPost.replies,
        quotes: body.quotes ?? existingPost.quotes,
        bookmarks: body.bookmarks ?? existingPost.bookmarks,
        clicks: body.clicks ?? existingPost.clicks,
      },
      include: {
        kol: {
          select: { id: true, name: true, twitterHandle: true },
        },
        campaign: {
          select: { id: true, name: true, keywords: true },
        },
      },
    });

    // Send Telegram notification for status changes
    if (body.status && ["APPROVED", "REJECTED", "CHANGES_REQUESTED"].includes(body.status) && body.status !== existingPost.status) {
      await sendStatusNotification(
        id,
        body.status,
        body.clientNotes || null,
        authContext.organizationId
      );
    }

    // Auto-refresh metrics if tweetUrl was added or changed
    const tweetUrlChanged = body.tweetUrl && body.tweetUrl !== existingPost.tweetUrl;
    if (tweetUrlChanged) {
      refreshPostMetrics(post.id, body.tweetUrl, authContext.organizationId)
        .then(result => {
          if (result.success) {
            console.log(`[Posts API] Auto-refreshed metrics for updated post ${post.id}`);
          } else {
            console.log(`[Posts API] Auto-refresh failed for post ${post.id}: ${result.error}`);
          }
        })
        .catch(err => console.error(`[Posts API] Auto-refresh error:`, err));
    }

    return NextResponse.json(post);
  } catch (error) {
    console.error("Error updating post:", error);
    return NextResponse.json(
      { error: "Failed to update post" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const existingPost = await db.post.findFirst({
      where: {
        id,
        campaign: {
          agencyId: authContext.organizationId,
        },
      },
    });

    if (!existingPost) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    await db.post.delete({ where: { id } });

    return NextResponse.json({ message: "Post deleted successfully" });
  } catch (error) {
    console.error("Error deleting post:", error);
    return NextResponse.json(
      { error: "Failed to delete post" },
      { status: 500 }
    );
  }
}

// Send Telegram notification to KOL and client when post status changes
async function sendStatusNotification(
  postId: string,
  newStatus: string,
  notes: string | null,
  organizationId: string
) {
  try {
    // Get the post with KOL info and campaign
    const post = await db.post.findUnique({
      where: { id: postId },
      include: {
        kol: {
          select: {
            id: true,
            name: true,
            twitterHandle: true,
            telegramGroupId: true,
          },
        },
        campaign: {
          select: {
            name: true,
            agencyId: true,
            clientTelegramChatId: true,
          },
        },
      },
    });

    if (!post?.kol) return;

    // Get the organization's bot token
    const org = await db.organization.findUnique({
      where: { id: post.campaign.agencyId },
      select: { telegramBotToken: true },
    });

    if (!org?.telegramBotToken) {
      console.log("[Post Status] No bot token configured");
      return;
    }

    const client = new TelegramClient(org.telegramBotToken);

    // Build the KOL notification message
    let kolMessage = "";
    switch (newStatus) {
      case "APPROVED":
        kolMessage = `✅ *Content Approved*\n\n` +
          `Your content for campaign "${post.campaign.name}" has been approved!\n\n` +
          `You can now post this content.`;
        break;
      case "REJECTED":
        kolMessage = `❌ *Content Rejected*\n\n` +
          `Your content for campaign "${post.campaign.name}" has been rejected.\n\n` +
          (notes ? `*Reason:* ${notes}\n\n` : "") +
          `Please submit new content using the /review command.`;
        break;
      case "CHANGES_REQUESTED":
        kolMessage = `✏️ *Changes Requested*\n\n` +
          `Changes have been requested for your content in campaign "${post.campaign.name}".\n\n` +
          (notes ? `*Feedback:* ${notes}\n\n` : "") +
          `Please revise and resubmit using the /review command.`;
        break;
      default:
        return; // Don't send notifications for other status changes
    }

    // 1. Send to KOL's assigned telegram group
    if (post.kol.telegramGroupId) {
      try {
        const kolResult = await client.sendMessage(post.kol.telegramGroupId, kolMessage, {
          parse_mode: "Markdown",
        });
        if (kolResult.ok) {
          console.log(`[Post Status] Sent ${newStatus} notification to KOL ${post.kol.name}'s group`);
        } else {
          console.error(`[Post Status] Failed to send to KOL group: ${kolResult.description}`);
        }
      } catch (error) {
        console.error(`[Post Status] Error sending to KOL group:`, error);
      }
    } else {
      console.log(`[Post Status] KOL ${post.kol.name} has no assigned telegram group`);
    }

    // 2. Send to client's telegram group
    if (post.campaign.clientTelegramChatId) {
      // Build client notification message
      let clientMessage = "";
      switch (newStatus) {
        case "APPROVED":
          clientMessage = `✅ *Content Approved*\n\n` +
            `Content from @${post.kol.twitterHandle} for campaign "${post.campaign.name}" has been approved.`;
          break;
        case "REJECTED":
          clientMessage = `❌ *Content Rejected*\n\n` +
            `Content from @${post.kol.twitterHandle} for campaign "${post.campaign.name}" has been rejected.\n\n` +
            (notes ? `*Reason:* ${notes}` : "");
          break;
        case "CHANGES_REQUESTED":
          clientMessage = `✏️ *Changes Requested*\n\n` +
            `Changes have been requested for content from @${post.kol.twitterHandle} in campaign "${post.campaign.name}".\n\n` +
            (notes ? `*Feedback:* ${notes}` : "");
          break;
      }

      try {
        const clientResult = await client.sendMessage(post.campaign.clientTelegramChatId, clientMessage, {
          parse_mode: "Markdown",
        });
        if (clientResult.ok) {
          console.log(`[Post Status] Sent ${newStatus} notification to client group`);
        } else {
          console.error(`[Post Status] Failed to send to client group: ${clientResult.description}`);
        }
      } catch (error) {
        console.error(`[Post Status] Error sending to client group:`, error);
      }
    } else {
      console.log(`[Post Status] Campaign has no client telegram group configured`);
    }

  } catch (error) {
    console.error("Failed to send status notification:", error);
    // Don't throw - notification failure shouldn't break the status update
  }
}
