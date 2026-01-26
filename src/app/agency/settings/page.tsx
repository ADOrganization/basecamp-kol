import { getAgencyContext } from "@/lib/get-agency-context";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, User, Key, Users, Settings, Shield, UserCog } from "lucide-react";
import { ProfileForm } from "@/components/settings/profile-form";
import { OrganizationForm } from "@/components/settings/organization-form";
import { TeamManagement } from "@/components/settings/team-management";
import { TwitterIntegrationCard, TelegramIntegrationCard, NotificationsCard } from "@/components/settings/integrations-card";
import { TwoFactorAuth } from "@/components/settings/two-factor-auth";
import { AdminTeamManagement } from "@/components/settings/admin-team-management";

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
  let user: { id: string; name: string | null; email: string; avatarUrl: string | null } | null = null;
  let adminRole: string | null = null;

  if (context.isAdmin) {
    const adminUser = await db.adminUser.findUnique({
      where: { id: context.userId },
    });
    if (adminUser) {
      user = {
        id: adminUser.id,
        name: adminUser.name,
        email: adminUser.email,
        avatarUrl: adminUser.avatarUrl,
      };
      adminRole = adminUser.role;
    }
  } else {
    const dbUser = await db.user.findUnique({
      where: { id: context.userId },
    });
    if (dbUser) {
      user = {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        avatarUrl: dbUser.avatarUrl,
      };
    }
  }

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center shadow-lg shadow-slate-500/20">
              <Settings className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Settings</h1>
          </div>
          <p className="text-muted-foreground">
            Manage your account, organization, and integrations.
          </p>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-lg">
          <TabsTrigger value="profile" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="organization" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
            <Building2 className="h-4 w-4" />
            Organization
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
            <Users className="h-4 w-4" />
            Team
          </TabsTrigger>
          {context.isAdmin && (
            <TabsTrigger value="admin-team" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
              <UserCog className="h-4 w-4" />
              Admin Team
            </TabsTrigger>
          )}
          <TabsTrigger value="integrations" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
            <Key className="h-4 w-4" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                <User className="h-4 w-4 text-indigo-500" />
              </div>
              <div>
                <h2 className="font-semibold">Personal Profile</h2>
                <p className="text-sm text-muted-foreground">Update your personal information</p>
              </div>
            </div>
            <ProfileForm user={user} variant="agency" />
          </div>
        </TabsContent>

        {/* Organization Tab */}
        <TabsContent value="organization" className="space-y-6">
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Building2 className="h-4 w-4 text-purple-500" />
              </div>
              <div>
                <h2 className="font-semibold">Organization Settings</h2>
                <p className="text-sm text-muted-foreground">Manage your organization details</p>
              </div>
            </div>
            <OrganizationForm organization={organization} variant="agency" />
          </div>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team" className="space-y-6">
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <h2 className="font-semibold">Team Management</h2>
                <p className="text-sm text-muted-foreground">Manage team members and roles</p>
              </div>
            </div>
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
          </div>
        </TabsContent>

        {/* Admin Team Tab */}
        {context.isAdmin && (
          <TabsContent value="admin-team" className="space-y-6">
            <div className="rounded-xl border bg-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <UserCog className="h-4 w-4 text-purple-500" />
                </div>
                <div>
                  <h2 className="font-semibold">Admin Team</h2>
                  <p className="text-sm text-muted-foreground">Manage admin portal access and permissions</p>
                </div>
              </div>
              <AdminTeamManagement
                currentAdminId={context.userId}
                currentAdminRole={adminRole || "ADMIN"}
              />
            </div>
          </TabsContent>
        )}

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6">
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Key className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <h2 className="font-semibold">Integrations</h2>
                <p className="text-sm text-muted-foreground">Connect external services and APIs</p>
              </div>
            </div>
            <div className="space-y-4">
              <TwitterIntegrationCard />
              <TelegramIntegrationCard />
              <NotificationsCard variant="agency" />
            </div>
          </div>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Shield className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <h2 className="font-semibold">Security Settings</h2>
                <p className="text-sm text-muted-foreground">Manage your account security and authentication</p>
              </div>
            </div>
            {context.isAdmin ? (
              <TwoFactorAuth />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Two-factor authentication is available for admin accounts only.</p>
                <p className="text-sm mt-2">Contact your administrator to enable 2FA for your account.</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
