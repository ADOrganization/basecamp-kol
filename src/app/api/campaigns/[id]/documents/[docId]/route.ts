import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { readFile, unlink } from "fs/promises";
import { existsSync } from "fs";

// SECURITY: Lazy-load JWT secret - NEVER use hardcoded fallback
function getAdminJwtSecret(): Uint8Array {
  const secret = process.env.ADMIN_JWT_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("SECURITY: ADMIN_JWT_SECRET or AUTH_SECRET environment variable is required");
  }
  return new TextEncoder().encode(secret);
}

async function getAdminFromToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getAdminJwtSecret());
    if (payload.type !== "admin" || !payload.sub) return null;

    const admin = await db.adminUser.findUnique({
      where: { id: payload.sub as string },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!admin || !admin.isActive) return null;
    return admin;
  } catch {
    return null;
  }
}

// SECURITY: Only admins can view/delete campaign documents
// Documents contain sensitive legal contracts

// GET /api/campaigns/[id]/documents/[docId] - Download a document (admin only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  // SECURITY: Apply rate limiting
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.standard);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // SECURITY: Verify admin authentication
    const admin = await getAdminFromToken();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: campaignId, docId } = await params;

    // Get document from database
    const document = await db.campaignDocument.findFirst({
      where: {
        id: docId,
        campaignId, // SECURITY: Ensure document belongs to this campaign
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Check if file exists on disk
    if (!existsSync(document.storagePath)) {
      console.error(`[Documents] File not found on disk: ${document.storagePath}`);
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Read file from disk
    const fileBuffer = await readFile(document.storagePath);

    // SECURITY: Validate file size matches expected
    if (fileBuffer.length !== document.fileSize) {
      console.error(`[Documents] File size mismatch for ${docId}: expected ${document.fileSize}, got ${fileBuffer.length}`);
      return NextResponse.json({ error: "File corrupted" }, { status: 500 });
    }

    console.log(`[Documents] Admin ${admin.id} downloaded document "${document.name}" from campaign ${campaignId}`);

    // SECURITY: Sanitize filename for HTTP header (prevent header injection)
    const sanitizedFilename = document.filename
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/\.\./g, ".")
      .substring(0, 100);

    // SECURITY: Force download (attachment) instead of inline viewing to prevent XSS
    // Even PDFs can contain embedded JavaScript that executes in some viewers
    return new NextResponse(fileBuffer, {
      headers: {
        // SECURITY: Use application/octet-stream to prevent browser interpretation
        "Content-Type": "application/octet-stream",
        // SECURITY: Force download with attachment disposition
        "Content-Disposition": `attachment; filename="${sanitizedFilename}"`,
        "Content-Length": document.fileSize.toString(),
        // SECURITY: Prevent MIME type sniffing
        "X-Content-Type-Options": "nosniff",
        // SECURITY: Prevent framing
        "X-Frame-Options": "DENY",
        // SECURITY: Sandbox any content execution
        "Content-Security-Policy": "sandbox",
        // SECURITY: Prevent caching of sensitive documents
        "Cache-Control": "no-store, no-cache, no-transform, must-revalidate, private, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error) {
    console.error("Error downloading document:", error);
    return NextResponse.json(
      { error: "Failed to download document" },
      { status: 500 }
    );
  }
}

// DELETE /api/campaigns/[id]/documents/[docId] - Delete a document (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  // SECURITY: Apply rate limiting
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.standard);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // SECURITY: Verify admin authentication
    const admin = await getAdminFromToken();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: campaignId, docId } = await params;

    // Get document from database
    const document = await db.campaignDocument.findFirst({
      where: {
        id: docId,
        campaignId, // SECURITY: Ensure document belongs to this campaign
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Delete file from disk
    if (existsSync(document.storagePath)) {
      try {
        await unlink(document.storagePath);
      } catch (err) {
        console.error(`[Documents] Failed to delete file from disk: ${document.storagePath}`, err);
        // Continue with database deletion even if file deletion fails
      }
    }

    // Delete from database
    await db.campaignDocument.delete({
      where: { id: docId },
    });

    console.log(`[Documents] Admin ${admin.email} deleted document "${document.name}" from campaign ${campaignId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}
