import { NextRequest, NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

// SECURITY: Magic number signatures for image validation
const MAGIC_NUMBERS: Record<string, number[]> = {
  "image/jpeg": [0xFF, 0xD8, 0xFF],
  "image/png": [0x89, 0x50, 0x4E, 0x47],
  "image/gif": [0x47, 0x49, 0x46, 0x38], // GIF8
  "image/webp": [0x52, 0x49, 0x46, 0x46], // RIFF (WebP starts with RIFF)
};

function validateMagicNumber(buffer: Buffer, mimeType: string): boolean {
  const signature = MAGIC_NUMBERS[mimeType];
  if (!signature) return false;

  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) return false;
  }

  // Additional check for WebP: bytes 8-11 should be "WEBP"
  if (mimeType === "image/webp") {
    const webpSignature = [0x57, 0x45, 0x42, 0x50]; // WEBP
    for (let i = 0; i < webpSignature.length; i++) {
      if (buffer[8 + i] !== webpSignature[i]) return false;
    }
  }

  return true;
}

export async function POST(request: NextRequest) {
  // SECURITY: Apply rate limiting for file uploads
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.fileUpload);
  if (rateLimitResponse) return rateLimitResponse;

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

    // Convert to buffer for validation
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // SECURITY: Validate magic number to prevent MIME type spoofing
    if (!validateMagicNumber(buffer, file.type)) {
      return NextResponse.json(
        { error: "File content does not match the declared type. Possible malicious file." },
        { status: 400 }
      );
    }

    const base64 = buffer.toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    // Update avatar in database based on user type
    if (authContext.isAdmin) {
      const updatedAdmin = await db.adminUser.update({
        where: { id: authContext.userId },
        data: { avatarUrl: dataUrl },
        select: {
          id: true,
          avatarUrl: true,
        },
      });
      return NextResponse.json({ avatarUrl: updatedAdmin.avatarUrl });
    }

    // Regular user
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

export async function DELETE(request: NextRequest) {
  // SECURITY: Apply rate limiting
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.standard);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Remove avatar based on user type
    if (authContext.isAdmin) {
      await db.adminUser.update({
        where: { id: authContext.userId },
        data: { avatarUrl: null },
      });
      return NextResponse.json({ success: true });
    }

    // Regular user
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
