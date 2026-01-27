import { NextRequest, NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
// SECURITY: Removed SVG from allowed types - SVGs can contain embedded JavaScript (XSS vector)
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

    // Check if user is owner or admin (site admins bypass)
    if (!authContext.isAdmin) {
      const membership = await db.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: authContext.organizationId,
            userId: authContext.userId,
          },
        },
      });

      if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
        return NextResponse.json(
          { error: "Only owners and admins can update the organization logo" },
          { status: 403 }
        );
      }
    }

    const formData = await request.formData();
    const file = formData.get("logo") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type (MIME from request)
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

    // Update organization logo
    const updatedOrg = await db.organization.update({
      where: { id: authContext.organizationId },
      data: { logoUrl: dataUrl },
      select: {
        id: true,
        logoUrl: true,
      },
    });

    return NextResponse.json({ logoUrl: updatedOrg.logoUrl });
  } catch (error) {
    console.error("Error uploading logo:", error);
    return NextResponse.json(
      { error: "Failed to upload logo" },
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

    // Check if user is owner or admin (site admins bypass)
    if (!authContext.isAdmin) {
      const membership = await db.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: authContext.organizationId,
            userId: authContext.userId,
          },
        },
      });

      if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
        return NextResponse.json(
          { error: "Only owners and admins can update the organization logo" },
          { status: 403 }
        );
      }
    }

    // Remove logo
    await db.organization.update({
      where: { id: authContext.organizationId },
      data: { logoUrl: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing logo:", error);
    return NextResponse.json(
      { error: "Failed to remove logo" },
      { status: 500 }
    );
  }
}
