"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Megaphone,
  FileCheck,
  BarChart3,
  Settings,
  LogOut,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface ClientSidebarProps {
  user: {
    name: string | null;
    email: string;
    avatarUrl?: string | null;
    organizationName: string;
  };
  organizationLogo?: string | null;
}

const navigation = [
  { name: "Dashboard", href: "/client/dashboard", icon: LayoutDashboard },
  { name: "Campaigns", href: "/client/campaigns", icon: Megaphone },
  { name: "Review Posts", href: "/client/review", icon: FileCheck },
  { name: "Analytics", href: "/client/analytics", icon: BarChart3 },
  { name: "Settings", href: "/client/settings", icon: Settings },
];

export function ClientSidebar({ user, organizationLogo }: ClientSidebarProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col bg-sidebar-bg text-sidebar-foreground border-r border-border">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 px-6 border-b border-sidebar-muted">
        {organizationLogo ? (
          <img
            src={organizationLogo}
            alt={user.organizationName}
            className="h-8 w-8 rounded-lg object-cover"
          />
        ) : (
          <div className="h-8 w-8 rounded-lg bg-teal-600 flex items-center justify-center">
            <span className="text-lg font-bold text-white">{user.organizationName.charAt(0)}</span>
          </div>
        )}
        <span className="text-lg font-semibold truncate flex-1">{user.organizationName}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-teal-600/20 text-teal-400 px-2 py-0.5 rounded">
            Client
          </span>
          <ThemeToggle />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-teal-600 text-white"
                  : "text-sidebar-text-muted hover:bg-sidebar-muted hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User Menu */}
      <div className="border-t border-sidebar-muted p-4">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-sidebar-muted">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name || "User avatar"}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-teal-600 flex items-center justify-center text-sm font-medium text-white">
                {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 text-left">
              <p className="font-medium text-sidebar-foreground truncate">
                {user.name || user.email}
              </p>
              <p className="text-xs text-sidebar-text-muted truncate">
                {user.organizationName}
              </p>
            </div>
            <ChevronDown className="h-4 w-4 text-sidebar-text-muted" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link href="/client/settings">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-rose-600"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
