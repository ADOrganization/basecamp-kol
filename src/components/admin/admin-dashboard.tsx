"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2,
  Users,
  UserCheck,
  Megaphone,
  FileText,
  LogOut,
  Shield,
} from "lucide-react";

interface AdminDashboardProps {
  admin: {
    id: string;
    email: string;
    name: string | null;
  };
  stats: {
    organizations: number;
    users: number;
    kols: number;
    campaigns: number;
    posts: number;
  };
  recentLogins: Array<{
    id: string;
    email: string;
    name: string | null;
    lastLoginAt: Date | null;
  }>;
}

export function AdminDashboard({ admin, stats, recentLogins }: AdminDashboardProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push("/admin/login");
  };

  const statCards = [
    { label: "Organizations", value: stats.organizations, icon: Building2, color: "text-blue-500" },
    { label: "Users", value: stats.users, icon: Users, color: "text-green-500" },
    { label: "KOLs", value: stats.kols, icon: UserCheck, color: "text-purple-500" },
    { label: "Campaigns", value: stats.campaigns, icon: Megaphone, color: "text-orange-500" },
    { label: "Posts", value: stats.posts, icon: FileText, color: "text-pink-500" },
  ];

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#8B5CF6]">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
              <p className="text-[#6B6B80]">Welcome, {admin.name || admin.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="text-[#A0A0B0] hover:text-white hover:bg-white/10"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {statCards.map((stat) => (
            <Card key={stat.label} className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[#6B6B80] text-sm">{stat.label}</p>
                    <p className="text-3xl font-bold text-white mt-1">
                      {stat.value.toLocaleString()}
                    </p>
                  </div>
                  <stat.icon className={`h-8 w-8 ${stat.color}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Logins */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Recent User Logins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentLogins.length === 0 ? (
                <p className="text-[#6B6B80] text-center py-4">No recent logins</p>
              ) : (
                recentLogins.map((login) => (
                  <div
                    key={login.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/5"
                  >
                    <div>
                      <p className="text-white font-medium">
                        {login.name || "No name"}
                      </p>
                      <p className="text-[#6B6B80] text-sm">{login.email}</p>
                    </div>
                    <p className="text-[#A0A0B0] text-sm">
                      {login.lastLoginAt
                        ? new Date(login.lastLoginAt).toLocaleString()
                        : "Never"}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
