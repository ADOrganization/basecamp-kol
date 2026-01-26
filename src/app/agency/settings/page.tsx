import { getAgencyContext } from "@/lib/get-agency-context";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, User, Key, Users } from "lucide-react";
import { ProfileForm } from "@/components/settings/profile-form";
import { OrganizationForm } from "@/components/settings/organization-form";
import { TeamManagement } from "@/components/settings/team-management";
import { TwitterIntegrationCard, TelegramIntegrationCard, NotificationsCard } from "@/components/settings/integrations-card";

export default async function SettingsPage() {
  const context = await getAgencyContext();

  if (!context) {
    redirect("/login");
  }

  const organization = await db.organization.findUnique({
    where: { id: context.organizationId },
    include: {
      members: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!organization) {
    redirect("/login");
  }

  // For admin users, create a synthetic user object since they don't have a User record
  let user;
  if (context.isAdmin) {
    const adminUser = await db.adminUser.findUnique({
      where: { id: context.userId },
    });
    user = adminUser ? {
      id: adminUser.id,
      name: adminUser.name || "Admin",
      email: adminUser.email,
      avatarUrl: null,
      passwordHash: null,
      emailVerified: null,
      lastLoginAt: adminUser.lastLoginAt,
      createdAt: adminUser.createdAt,
      updatedAt: adminUser.updatedAt,
    } : null;
  } else {
    user = await db.user.findUnique({
      where: { id: context.userId },
    });
  }

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account and organization settings
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="organization" className="gap-2">
            <Building2 className="h-4 w-4" />
            Organization
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-2">
            <Users className="h-4 w-4" />
            Team
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Key className="h-4 w-4" />
            Integrations
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <ProfileForm user={user} variant="agency" />
        </TabsContent>

        {/* Organization Tab */}
        <TabsContent value="organization" className="space-y-6">
          <OrganizationForm organization={organization} variant="agency" />
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team" className="space-y-6">
          <TeamManagement
            members={organization.members.map(m => ({
              id: m.id,
              userId: m.userId,
              role: m.role,
              user: {
                id: m.user.id,
                name: m.user.name,
                email: m.user.email,
                avatarUrl: m.user.avatarUrl,
              },
            }))}
            currentUserId={context.userId}
            variant="agency"
          />
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6">
          <TwitterIntegrationCard />
          <TelegramIntegrationCard />
          <NotificationsCard variant="agency" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
