import { NextRequest, NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export async function POST(request: NextRequest) {
  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("avatar") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload JPG, PNG, GIF, or WebP." },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 2MB." },
        { status: 400 }
      );
    }

    // Convert to base64 data URL
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    // Admin users - avatars not supported (AdminUser doesn't have avatarUrl field)
    if (authContext.isAdmin) {
      return NextResponse.json(
        { error: "Avatar upload not supported for admin accounts" },
        { status: 400 }
      );
    }

    // Update user avatar in database
    const updatedUser = await db.user.update({
      where: { id: authContext.userId },
      data: { avatarUrl: dataUrl },
      select: {
        id: true,
        avatarUrl: true,
      },
    });

    return NextResponse.json({ avatarUrl: updatedUser.avatarUrl });
  } catch (error) {
    console.error("Error uploading avatar:", error);
    return NextResponse.json(
      { error: "Failed to upload avatar" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admin users - avatars not supported
    if (authContext.isAdmin) {
      return NextResponse.json(
        { error: "Avatar removal not supported for admin accounts" },
        { status: 400 }
      );
    }

    // Remove avatar
    await db.user.update({
      where: { id: authContext.userId },
      data: { avatarUrl: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing avatar:", error);
    return NextResponse.json(
      { error: "Failed to remove avatar" },
      { status: 500 }
    );
  }
}
