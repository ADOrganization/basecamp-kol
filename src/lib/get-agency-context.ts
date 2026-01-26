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
    // Admin user - find the agency organization with the most data (KOLs + campaigns)
    // This ensures we get the agency that actually has content
    const agencies = await db.organization.findMany({
      where: {
        type: "AGENCY",
      },
      select: {
        id: true,
        _count: {
          select: {
            kols: true,
            agencyCampaigns: true,
          },
        },
      },
    });

    // Sort by total content (KOLs + campaigns) and pick the one with most data
    const sortedAgencies = agencies.sort((a, b) => {
      const aTotal = a._count.kols + a._count.agencyCampaigns;
      const bTotal = b._count.kols + b._count.agencyCampaigns;
      return bTotal - aTotal; // Descending order
    });

    const agencyWithData = sortedAgencies[0];

    if (!agencyWithData) {
      console.error("No agency organization found for admin user");
      return null;
    }

    return {
      organizationId: agencyWithData.id,
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
