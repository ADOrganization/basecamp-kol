import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(
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
    const { action, notes } = body;

    // Verify client has access to this post
    const existingPost = await db.post.findFirst({
      where: {
        id,
        campaign: {
          clientId: session.user.organizationId,
        },
      },
    });

    if (!existingPost) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Determine new status based on action
    let newStatus: "APPROVED" | "REJECTED";
    if (action === "approve") {
      newStatus = "APPROVED";
    } else if (action === "reject") {
      newStatus = "REJECTED";
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Update the post
    const post = await db.post.update({
      where: { id },
      data: {
        status: newStatus,
        clientNotes: notes || null,
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
    console.error("Error approving/rejecting post:", error);
    return NextResponse.json(
      { error: "Failed to process approval" },
      { status: 500 }
    );
  }
}
