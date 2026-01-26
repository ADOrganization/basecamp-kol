import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { db } from "@/lib/db";

const ADMIN_JWT_SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || process.env.AUTH_SECRET || "admin-secret-key"
);

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

    const { payload } = await jwtVerify(token, ADMIN_JWT_SECRET);

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
