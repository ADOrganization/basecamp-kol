import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { postApprovalSchema } from "@/lib/validations";
import { TelegramClient } from "@/lib/telegram/client";

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
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const isAgency = session.user.organizationType === "AGENCY";

    const post = await db.post.findFirst({
      where: {
        id,
        campaign: isAgency
          ? { agencyId: session.user.organizationId }
          : { clientId: session.user.organizationId },
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
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const isAgency = session.user.organizationType === "AGENCY";

    // Verify post access and get campaign keywords
    const existingPost = await db.post.findFirst({
      where: {
        id,
        campaign: isAgency
          ? { agencyId: session.user.organizationId }
          : { clientId: session.user.organizationId },
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
          session.user.organizationId
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
        session.user.organizationId
      );
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
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.organizationType !== "AGENCY") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const existingPost = await db.post.findFirst({
      where: {
        id,
        campaign: {
          agencyId: session.user.organizationId,
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

// Send Telegram notification to KOL when post status changes
async function sendStatusNotification(
  postId: string,
  newStatus: string,
  notes: string | null,
  organizationId: string
) {
  try {
    // Get the post with KOL info
    const post = await db.post.findUnique({
      where: { id: postId },
      include: {
        kol: {
          include: {
            telegramChatLinks: {
              include: {
                chat: true,
              },
            },
          },
        },
        campaign: {
          select: { name: true, agencyId: true },
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

    // Find a chat to send the notification to
    // Priority: 1) Group/supergroup chat (where /review was likely submitted), 2) Private chat
    const groupChat = post.kol.telegramChatLinks.find(
      (link) => (link.chat.type === "GROUP" || link.chat.type === "SUPERGROUP") && link.chat.status === "ACTIVE"
    );
    const privateChat = post.kol.telegramChatLinks.find(
      (link) => link.chat.type === "PRIVATE" && link.chat.status === "ACTIVE"
    );

    const targetChat = groupChat || privateChat;
    if (!targetChat) {
      console.log(`[Post Status] No telegram chat found for KOL ${post.kol.name}`);
      console.log(`[Post Status] KOL has ${post.kol.telegramChatLinks.length} chat links`);
      return;
    }

    console.log(`[Post Status] Sending to ${targetChat.chat.type} chat: ${targetChat.chat.telegramChatId}`);

    const client = new TelegramClient(org.telegramBotToken);

    // Build the notification message
    let message = "";

    switch (newStatus) {
      case "APPROVED":
        message = `✅ *Content Approved*\n\n` +
          `Your content for campaign "${post.campaign.name}" has been approved!\n\n` +
          `You can now post this content.`;
        break;
      case "REJECTED":
        message = `❌ *Content Rejected*\n\n` +
          `Your content for campaign "${post.campaign.name}" has been rejected.\n\n` +
          (notes ? `*Reason:* ${notes}\n\n` : "") +
          `Please submit new content using the /review command.`;
        break;
      case "CHANGES_REQUESTED":
        message = `✏️ *Changes Requested*\n\n` +
          `Changes have been requested for your content in campaign "${post.campaign.name}".\n\n` +
          (notes ? `*Feedback:* ${notes}\n\n` : "") +
          `Please revise and resubmit using the /review command.`;
        break;
      default:
        return; // Don't send notifications for other status changes
    }

    const result = await client.sendMessage(targetChat.chat.telegramChatId, message, {
      parse_mode: "Markdown",
    });

    if (result.ok) {
      console.log(`[Post Status] Sent ${newStatus} notification to KOL ${post.kol.name} in ${targetChat.chat.type} chat`);
    } else {
      console.error(`[Post Status] Failed to send message: ${result.description}`);
    }
  } catch (error) {
    console.error("Failed to send status notification:", error);
    // Don't throw - notification failure shouldn't break the status update
  }
}
