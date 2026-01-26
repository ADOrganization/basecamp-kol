import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export default async function AdminDashboardPage() {
  const session = await getAdminSession();

  if (!session) {
    redirect("/admin/login");
  }

  // Fetch stats
  const [
    totalOrganizations,
    totalUsers,
    totalKols,
    totalCampaigns,
    totalPosts,
    recentLogins,
  ] = await Promise.all([
    db.organization.count(),
    db.user.count(),
    db.kOL.count(),
    db.campaign.count(),
    db.post.count(),
    db.user.findMany({
      where: { lastLoginAt: { not: null } },
      orderBy: { lastLoginAt: "desc" },
      take: 10,
      select: {
        id: true,
        email: true,
        name: true,
        lastLoginAt: true,
      },
    }),
  ]);

  return (
    <AdminDashboard
      admin={session}
      stats={{
        organizations: totalOrganizations,
        users: totalUsers,
        kols: totalKols,
        campaigns: totalCampaigns,
        posts: totalPosts,
      }}
      recentLogins={recentLogins}
    />
  );
}
