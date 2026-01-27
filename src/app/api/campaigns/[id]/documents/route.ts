import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { put, del } from "@vercel/blob";
import crypto from "crypto";
import path from "path";

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

// SECURITY: Only admins can upload/view campaign documents
// Documents contain sensitive legal contracts

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_CAMPAIGN_STORAGE = 100 * 1024 * 1024; // 100MB per campaign

// SECURITY: Whitelist of allowed MIME types
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
];

// SECURITY: Whitelist of allowed file extensions (must match MIME types)
const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg"];

// SECURITY: Magic number signatures to validate actual file content
// This prevents attackers from uploading malicious files with fake MIME types
const MAGIC_NUMBERS: Record<string, number[][]> = {
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // %PDF
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]], // PNG signature
  "image/jpeg": [[0xff, 0xd8, 0xff]], // JPEG signature
  // DOC files start with OLE compound document header
  "application/msword": [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]],
  // DOCX files are ZIP archives (PK signature)
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [[0x50, 0x4b, 0x03, 0x04]],
};

// SECURITY: Validate file content matches expected magic number
function validateMagicNumber(buffer: Buffer, mimeType: string): boolean {
  const signatures = MAGIC_NUMBERS[mimeType];
  if (!signatures) return false;

  for (const signature of signatures) {
    if (buffer.length < signature.length) continue;

    let matches = true;
    for (let i = 0; i < signature.length; i++) {
      if (buffer[i] !== signature[i]) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }
  return false;
}

// GET /api/campaigns/[id]/documents - List all documents for a campaign (admin only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id: campaignId } = await params;

    // Verify campaign exists
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, name: true },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Get all documents for the campaign
    const documents = await db.campaignDocument.findMany({
      where: { campaignId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        filename: true,
        type: true,
        mimeType: true,
        fileSize: true,
        description: true,
        uploadedBy: true,
        createdAt: true,
      },
    });

    return NextResponse.json(documents);
  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}

// POST /api/campaigns/[id]/documents - Upload a document (admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id: campaignId } = await params;

    // Verify campaign exists
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, name: true },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const name = formData.get("name") as string | null;
    const type = formData.get("type") as string | null;
    const description = formData.get("description") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // SECURITY: Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB" },
        { status: 400 }
      );
    }

    // SECURITY: Validate MIME type against whitelist
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: PDF, DOC, DOCX, PNG, JPG" },
        { status: 400 }
      );
    }

    // SECURITY: Validate file extension against whitelist
    const fileExt = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
      return NextResponse.json(
        { error: "Invalid file extension. Allowed: .pdf, .doc, .docx, .png, .jpg, .jpeg" },
        { status: 400 }
      );
    }

    // SECURITY: Validate extension matches claimed MIME type
    const extMimeMap: Record<string, string[]> = {
      ".pdf": ["application/pdf"],
      ".doc": ["application/msword"],
      ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      ".png": ["image/png"],
      ".jpg": ["image/jpeg"],
      ".jpeg": ["image/jpeg"],
    };
    if (!extMimeMap[fileExt]?.includes(file.type)) {
      return NextResponse.json(
        { error: "File extension does not match file type" },
        { status: 400 }
      );
    }

    // Read file content for validation
    const buffer = Buffer.from(await file.arrayBuffer());

    // SECURITY: Validate magic number (actual file content) matches claimed MIME type
    // This prevents attackers from uploading malicious files with fake extensions/MIME types
    if (!validateMagicNumber(buffer, file.type)) {
      console.warn(`[Documents] Magic number validation failed for ${file.name} (claimed: ${file.type})`);
      return NextResponse.json(
        { error: "File content does not match file type. File may be corrupted or invalid." },
        { status: 400 }
      );
    }

    // SECURITY: Check per-campaign storage quota
    const existingDocs = await db.campaignDocument.aggregate({
      where: { campaignId },
      _sum: { fileSize: true },
    });
    const currentUsage = existingDocs._sum.fileSize || 0;
    if (currentUsage + file.size > MAX_CAMPAIGN_STORAGE) {
      return NextResponse.json(
        { error: "Campaign storage quota exceeded. Maximum 100MB per campaign." },
        { status: 400 }
      );
    }

    // SECURITY: Generate a random filename to prevent path traversal
    const randomName = crypto.randomBytes(16).toString("hex");
    const safeFilename = `${randomName}${fileExt}`;
    const blobPath = `campaigns/${campaignId}/documents/${safeFilename}`;

    // Upload to Vercel Blob
    const blob = await put(blobPath, buffer, {
      access: "public", // We control access via our API
      contentType: file.type,
    });

    // Create database record
    const document = await db.campaignDocument.create({
      data: {
        campaignId,
        name: name || file.name,
        filename: file.name,
        type: (type as any) || "CONTRACT",
        mimeType: file.type,
        fileSize: file.size,
        storagePath: blob.url,
        storageType: "blob",
        description: description || null,
        uploadedBy: admin.id,
      },
      select: {
        id: true,
        name: true,
        filename: true,
        type: true,
        mimeType: true,
        fileSize: true,
        description: true,
        createdAt: true,
      },
    });

    console.log(`[Documents] Admin ${admin.email} uploaded document "${document.name}" to campaign ${campaignId}`);

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error("Error uploading document:", error);
    return NextResponse.json(
      { error: "Failed to upload document" },
      { status: 500 }
    );
  }
}
