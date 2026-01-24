import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { postApprovalSchema } from "@/lib/validations";

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

    // Verify post access
    const existingPost = await db.post.findFirst({
      where: {
        id,
        campaign: isAgency
          ? { agencyId: session.user.organizationId }
          : { clientId: session.user.organizationId },
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
      return NextResponse.json(post);
    }

    // Agency can update all fields
    const post = await db.post.update({
      where: { id },
      data: {
        type: body.type || existingPost.type,
        content: body.content !== undefined ? body.content : existingPost.content,
        tweetUrl: body.tweetUrl !== undefined ? body.tweetUrl : existingPost.tweetUrl,
        tweetId: body.tweetId !== undefined ? body.tweetId : existingPost.tweetId,
        status: body.status || existingPost.status,
        scheduledFor: body.scheduledFor
          ? new Date(body.scheduledFor)
          : existingPost.scheduledFor,
        postedAt: body.postedAt ? new Date(body.postedAt) : existingPost.postedAt,
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
          select: { id: true, name: true },
        },
      },
    });

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
