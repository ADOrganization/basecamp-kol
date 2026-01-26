import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Calendar, Shield } from "lucide-react";

export default async function KOLSettingsPage() {
  const session = await auth();

  if (!session?.user?.kolId) {
    redirect("/kol/login");
  }

  const kolAccount = await db.kOLAccount.findUnique({
    where: { kolId: session.user.kolId },
    include: {
      kol: {
        include: {
          organization: { select: { name: true } },
        },
      },
    },
  });

  if (!kolAccount) {
    redirect("/kol/login");
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account settings
        </p>
      </div>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>
            Your KOL Portal account details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <User className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Display Name</p>
                <p className="font-medium">{kolAccount.kol.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{kolAccount.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <Calendar className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Member Since</p>
                <p className="font-medium">
                  {new Date(kolAccount.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Shield className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Organization</p>
                <p className="font-medium">{kolAccount.kol.organization.name}</p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Account Status:</span>
              {kolAccount.isVerified ? (
                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                  Verified
                </Badge>
              ) : (
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                  Pending Verification
                </Badge>
              )}
            </div>
            {kolAccount.lastLoginAt && (
              <p className="text-sm text-muted-foreground mt-2">
                Last login: {new Date(kolAccount.lastLoginAt).toLocaleString()}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>
            Manage your account security settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            <p>Password management and two-factor authentication coming soon.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
