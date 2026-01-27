import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { db } from "@/lib/db";
import crypto from "crypto";

// SECURITY: Require explicit ADMIN_JWT_SECRET in production
// Never fall back to a default value for admin authentication
// Lazy initialization to avoid build-time errors

let _adminJwtSecret: Uint8Array | null = null;

function getAdminJwtSecret(): Uint8Array {
  if (_adminJwtSecret) return _adminJwtSecret;

  const secret = process.env.ADMIN_JWT_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CRITICAL: ADMIN_JWT_SECRET environment variable is required in production");
    }
    // Only allow fallback in development with a warning
    console.warn("WARNING: ADMIN_JWT_SECRET not set, using fallback. DO NOT use in production!");
    _adminJwtSecret = new TextEncoder().encode(process.env.AUTH_SECRET || "dev-only-admin-secret");
    return _adminJwtSecret;
  }

  // Validate secret strength
  if (secret.length < 32) {
    throw new Error("ADMIN_JWT_SECRET must be at least 32 characters long");
  }

  _adminJwtSecret = new TextEncoder().encode(secret);
  return _adminJwtSecret;
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export interface AdminSession {
  id: string;
  email: string;
  name: string | null;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_token")?.value;

    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(token, getAdminJwtSecret());

    if (payload.type !== "admin" || !payload.sub) {
      return null;
    }

    // Verify admin still exists and is active
    const admin = await db.adminUser.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, isActive: true },
    });

    if (!admin || !admin.isActive) {
      return null;
    }

    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
    };
  } catch {
    return null;
  }
}

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}
