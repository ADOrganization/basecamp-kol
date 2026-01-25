import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get single chat with messages and linked KOLs
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const chat = await db.telegramChat.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        kolLinks: {
          include: {
            kol: {
              include: {
                campaignKols: {
                  include: {
                    campaign: {
                      select: { id: true, name: true, status: true },
                    },
                  },
                },
              },
            },
          },
        },
        messages: {
          orderBy: { timestamp: "desc" },
          take: limit,
          skip: offset,
        },
      },
    });

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    // Get total message count for pagination
    const totalMessages = await db.telegramGroupMessage.count({
      where: { chatId: id },
    });

    return NextResponse.json({
      chat: {
        id: chat.id,
        telegramChatId: chat.telegramChatId,
        title: chat.title,
        type: chat.type,
        username: chat.username,
        status: chat.status,
        memberCount: chat.memberCount,
        botJoinedAt: chat.botJoinedAt,
        botLeftAt: chat.botLeftAt,
      },
      kolLinks: chat.kolLinks.map((link) => ({
        id: link.id,
        matchedBy: link.matchedBy,
        kol: {
          id: link.kol.id,
          name: link.kol.name,
          twitterHandle: link.kol.twitterHandle,
          telegramUsername: link.kol.telegramUsername,
          avatarUrl: link.kol.avatarUrl,
          campaigns: link.kol.campaignKols.map((ck) => ({
            campaignId: ck.campaignId,
            campaignName: ck.campaign.name,
            campaignStatus: ck.campaign.status,
            requiredPosts: ck.requiredPosts,
            requiredThreads: ck.requiredThreads,
            requiredRetweets: ck.requiredRetweets,
            requiredSpaces: ck.requiredSpaces,
          })),
        },
      })),
      messages: chat.messages.map((msg) => ({
        id: msg.id,
        content: msg.content,
        direction: msg.direction,
        senderUsername: msg.senderUsername,
        senderName: msg.senderName,
        timestamp: msg.timestamp,
        replyToMessageId: msg.replyToMessageId,
      })),
      pagination: {
        total: totalMessages,
        limit,
        offset,
        hasMore: offset + limit < totalMessages,
      },
    });
  } catch (error) {
    console.error("Error fetching telegram chat:", error);
    return NextResponse.json(
      { error: "Failed to fetch telegram chat" },
      { status: 500 }
    );
  }
}

// DELETE - Remove chat from tracking
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permission
    const membership = await db.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId: session.user.organizationId,
        role: { in: ["OWNER", "ADMIN"] },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "You don't have permission to delete chats" },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Verify chat belongs to organization
    const chat = await db.telegramChat.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    // Delete the chat (cascades to kolLinks and messages)
    await db.telegramChat.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting telegram chat:", error);
    return NextResponse.json(
      { error: "Failed to delete telegram chat" },
      { status: 500 }
    );
  }
}
