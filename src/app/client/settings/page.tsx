import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, User, Users, Bell, Shield, FileText, Settings } from "lucide-react";
import { ProfileForm } from "@/components/settings/profile-form";
import { PasswordForm } from "@/components/settings/password-form";
import { OrganizationForm } from "@/components/settings/organization-form";
import { TeamManagement } from "@/components/settings/team-management";

export default async function ClientSettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const organization = await db.organization.findUnique({
    where: { id: session.user.organizationId },
    include: {
      members: {
        include: {
          user: true,
        },
      },
    },
  });

  const user = await db.user.findUnique({
    where: { id: session.user.id },
  });

  if (!organization || !user) {
    redirect("/login");
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-8 text-white">
        <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.5))]" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -mr-32 -mt-32" />
        <div className="relative">
          <div className="flex items-center gap-2 text-indigo-200 mb-2">
            <Settings className="h-5 w-5" />
            <span className="text-sm font-medium">Account Management</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-indigo-100 max-w-xl">
            Manage your account, organization details, team members, and notification preferences.
          </p>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="profile" className="gap-2 data-[state=active]:bg-background">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="organization" className="gap-2 data-[state=active]:bg-background">
            <Building2 className="h-4 w-4" />
            Organization
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-2 data-[state=active]:bg-background">
            <Users className="h-4 w-4" />
            Team
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2 data-[state=active]:bg-background">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <ProfileForm user={user} variant="client" />
          <PasswordForm />
        </TabsContent>

        {/* Organization Tab */}
        <TabsContent value="organization" className="space-y-6">
          <OrganizationForm organization={organization} variant="client" />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Billing Information
              </CardTitle>
              <CardDescription>
                Manage your billing details and invoices
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">Current Plan</p>
                    <p className="text-sm text-muted-foreground">Enterprise Client</p>
                  </div>
                  <Badge className="bg-teal-100 text-teal-700">Active</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">View Invoices</p>
                    <p className="text-sm text-muted-foreground">Download past invoices and statements</p>
                  </div>
                  <Button variant="outline" size="sm">View All</Button>
                </div>
              </div>
            </CardContent>
          </Card>
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
            currentUserId={session.user.id}
            variant="client"
          />
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Notifications</CardTitle>
              <CardDescription>
                Configure which emails you&apos;d like to receive
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Campaign Updates</p>
                    <p className="text-sm text-muted-foreground">Get notified when campaign status changes</p>
                  </div>
                  <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-border" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Post Approvals</p>
                    <p className="text-sm text-muted-foreground">Receive alerts when posts need your review</p>
                  </div>
                  <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-border" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Weekly Reports</p>
                    <p className="text-sm text-muted-foreground">Receive weekly performance summaries</p>
                  </div>
                  <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-border" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">KOL Performance Alerts</p>
                    <p className="text-sm text-muted-foreground">Get notified about exceptional KOL performance</p>
                  </div>
                  <input type="checkbox" className="h-4 w-4 rounded border-border" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security
              </CardTitle>
              <CardDescription>
                Manage your account security settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Two-Factor Authentication</p>
                    <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
                  </div>
                  <Button variant="outline" size="sm">Enable</Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Active Sessions</p>
                    <p className="text-sm text-muted-foreground">Manage your active login sessions</p>
                  </div>
                  <Button variant="outline" size="sm">View</Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Login History</p>
                    <p className="text-sm text-muted-foreground">View recent login activity</p>
                  </div>
                  <Button variant="outline" size="sm">View</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
