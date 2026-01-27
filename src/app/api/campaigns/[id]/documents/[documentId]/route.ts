import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { del } from "@vercel/blob";

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

// GET /api/campaigns/[id]/documents/[documentId] - Download/view a document
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
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

    const { id: campaignId, documentId } = await params;

    // Get document with campaign verification
    const document = await db.campaignDocument.findFirst({
      where: {
        id: documentId,
        campaignId: campaignId,
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Redirect to blob URL for download
    if (document.storageType === "blob" && document.storagePath) {
      return NextResponse.redirect(document.storagePath);
    }

    return NextResponse.json({ error: "Document not available" }, { status: 404 });
  } catch (error) {
    console.error("Error fetching document:", error);
    return NextResponse.json(
      { error: "Failed to fetch document" },
      { status: 500 }
    );
  }
}

// DELETE /api/campaigns/[id]/documents/[documentId] - Delete a document
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
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

    const { id: campaignId, documentId } = await params;

    // Get document with campaign verification
    const document = await db.campaignDocument.findFirst({
      where: {
        id: documentId,
        campaignId: campaignId,
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Delete from Vercel Blob if applicable
    if (document.storageType === "blob" && document.storagePath) {
      try {
        await del(document.storagePath);
      } catch (blobError) {
        console.error("Error deleting blob:", blobError);
        // Continue with database deletion even if blob deletion fails
      }
    }

    // Delete database record
    await db.campaignDocument.delete({
      where: { id: documentId },
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
