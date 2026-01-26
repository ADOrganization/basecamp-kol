import { auth } from "@/lib/auth";
import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export interface AgencyContext {
  organizationId: string;
  userId: string;
  isAdmin: boolean;
  userName: string | null;
  userEmail: string;
}

/**
 * Get agency context for the current user.
 * Works for both admin users (via admin_token) and regular users (via NextAuth).
 * Returns null if no valid session exists.
 */
export async function getAgencyContext(): Promise<AgencyContext | null> {
  // First check for admin session
  const adminSession = await getAdminSession();

  if (adminSession) {
    // Admin user - find the agency organization
    const agency = await db.organization.findFirst({
      where: { type: "AGENCY" },
      select: { id: true },
    });

    if (!agency) {
      console.error("No agency organization found for admin user");
      return null;
    }

    return {
      organizationId: agency.id,
      userId: adminSession.id,
      isAdmin: true,
      userName: adminSession.name,
      userEmail: adminSession.email,
    };
  }

  // Check for regular NextAuth session
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  if (session.user.organizationType !== "AGENCY") {
    return null;
  }

  return {
    organizationId: session.user.organizationId,
    userId: session.user.id,
    isAdmin: false,
    userName: session.user.name || null,
    userEmail: session.user.email || "",
  };
}
