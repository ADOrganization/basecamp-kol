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
    // Admin user - find the agency organization with the most data (KOLs + campaigns)
    // This ensures we get the agency that actually has content
    const agencies = await db.organization.findMany({
      where: {
        type: "AGENCY",
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            kols: true,
            agencyCampaigns: true,
          },
        },
      },
    });

    console.log(`[API Auth] Admin session found. Found ${agencies.length} agencies:`,
      agencies.map(a => ({ id: a.id, name: a.name, kols: a._count.kols, campaigns: a._count.agencyCampaigns }))
    );

    // Sort by total content (KOLs + campaigns) and pick the one with most data
    const sortedAgencies = agencies.sort((a, b) => {
      const aTotal = a._count.kols + a._count.agencyCampaigns;
      const bTotal = b._count.kols + b._count.agencyCampaigns;
      return bTotal - aTotal; // Descending order
    });

    const agencyWithData = sortedAgencies[0];

    if (!agencyWithData) {
      console.error("[API Auth] No agency organization found for admin user");
      return null;
    }

    console.log(`[API Auth] Selected agency: ${agencyWithData.id} (${agencyWithData.name})`);

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
