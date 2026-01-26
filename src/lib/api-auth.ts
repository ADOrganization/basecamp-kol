import { auth } from "@/lib/auth";
import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export interface ApiAuthContext {
  organizationId: string;
  organizationType: "AGENCY" | "CLIENT";
  userId: string;
  isAdmin: boolean;
}

/**
 * Get auth context for API routes.
 * Works for both admin users (via admin_token) and regular users (via NextAuth).
 * Returns null if no valid session exists.
 */
export async function getApiAuthContext(): Promise<ApiAuthContext | null> {
  // First check for admin session
  const adminSession = await getAdminSession();

  if (adminSession) {
    // Admin user - find the agency organization that has actual data
    // We look for the organization that testuser@basecamp.test belongs to,
    // or the first agency with members if that user doesn't exist
    const agencyWithData = await db.organization.findFirst({
      where: {
        type: "AGENCY",
        members: {
          some: {},
        },
      },
      select: { id: true },
      orderBy: { createdAt: "asc" }, // Get the oldest agency (original one)
    });

    if (!agencyWithData) {
      // Fallback: find any agency
      const anyAgency = await db.organization.findFirst({
        where: { type: "AGENCY" },
        select: { id: true },
      });

      if (!anyAgency) {
        console.error("No agency organization found for admin user");
        return null;
      }

      return {
        organizationId: anyAgency.id,
        organizationType: "AGENCY",
        userId: adminSession.id,
        isAdmin: true,
      };
    }

    return {
      organizationId: agencyWithData.id,
      organizationType: "AGENCY",
      userId: adminSession.id,
      isAdmin: true,
    };
  }

  // Check for regular NextAuth session
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  return {
    organizationId: session.user.organizationId,
    organizationType: session.user.organizationType as "AGENCY" | "CLIENT",
    userId: session.user.id,
    isAdmin: false,
  };
}

/**
 * Require agency auth context for API routes.
 * Returns the context if user is agency/admin, null otherwise.
 */
export async function requireAgencyAuth(): Promise<ApiAuthContext | null> {
  const context = await getApiAuthContext();

  if (!context) {
    return null;
  }

  if (context.organizationType !== "AGENCY" && !context.isAdmin) {
    return null;
  }

  return context;
}
