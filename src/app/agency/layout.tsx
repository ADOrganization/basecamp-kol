import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AgencySidebar } from "@/components/agency/sidebar";
import { getAdminSession } from "@/lib/admin-auth";

export default async function AgencyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    // Check for admin session first (admin portal access)
    const adminSession = await getAdminSession();

    if (adminSession) {
      // Admin user - give them access to agency features
      // Find the Basecamp agency organization
      const basecampOrg = await db.organization.findFirst({
        where: { type: "AGENCY" },
        select: { name: true, logoUrl: true },
      });

      // Get admin user's avatar
      const adminUser = await db.adminUser.findUnique({
        where: { id: adminSession.sub },
        select: { avatarUrl: true },
      });

      return (
        <div className="flex h-screen bg-background">
          <AgencySidebar
            user={{
              name: adminSession.name || "Admin",
              email: adminSession.email,
              avatarUrl: adminUser?.avatarUrl || null,
              organizationName: basecampOrg?.name || "Basecamp Network",
            }}
            organizationLogo={basecampOrg?.logoUrl || null}
            isAdmin={true}
          />
          <main className="flex-1 overflow-y-auto">
            <div className="p-8">{children}</div>
          </main>
        </div>
      );
    }

    // Regular user auth flow
    const session = await auth();

    if (!session?.user) {
      redirect("/login");
    }

    if (session.user.organizationType !== "AGENCY") {
      redirect("/client/dashboard");
    }

    // Fetch fresh user data from database for sidebar (not cached in JWT)
    let userName = session.user.name || "User";
    let userEmail = session.user.email || "";
    let userAvatarUrl: string | null = null;
    let orgName = session.user.organizationName || "Organization";
    let orgLogoUrl: string | null = null;

    try {
      const freshUser = await db.user.findUnique({
        where: { id: session.user.id },
        select: {
          name: true,
          email: true,
          avatarUrl: true,
          memberships: {
            select: {
              organization: {
                select: { name: true, logoUrl: true },
              },
            },
            take: 1,
          },
        },
      });

      if (freshUser) {
        userName = freshUser.name ?? userName;
        userEmail = freshUser.email ?? userEmail;
        userAvatarUrl = freshUser.avatarUrl ?? null;
        orgName = freshUser.memberships[0]?.organization.name ?? orgName;
        orgLogoUrl = freshUser.memberships[0]?.organization.logoUrl ?? null;
      }
    } catch (dbError) {
      console.error("Error fetching user data:", dbError);
      // Continue with session data
    }

    return (
      <div className="flex h-screen bg-background">
        <AgencySidebar
          user={{
            name: userName,
            email: userEmail,
            avatarUrl: userAvatarUrl,
            organizationName: orgName,
          }}
          organizationLogo={orgLogoUrl}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="p-8">{children}</div>
        </main>
      </div>
    );
  } catch (error) {
    console.error("Agency layout error:", error);
    redirect("/login");
  }
}
