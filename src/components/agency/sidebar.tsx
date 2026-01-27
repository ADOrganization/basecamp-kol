"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Megaphone,
  FileText,
  MessageSquare,
  Settings,
  LogOut,
  ChevronDown,
  UserPlus,
  ChevronRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface AgencySidebarProps {
  user: {
    name: string | null;
    email: string;
    avatarUrl?: string | null;
    organizationName: string;
  };
  organizationLogo?: string | null;
  isAdmin?: boolean;
}

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, description: "Overview & metrics" },
  { name: "KOL Roster", href: "/kols", icon: Users, description: "Manage influencers" },
  { name: "Campaigns", href: "/campaigns", icon: Megaphone, description: "Active promotions" },
  { name: "Content Review", href: "/content/review", icon: FileText, description: "Approve posts" },
  { name: "Clients", href: "/clients", icon: UserPlus, description: "Client accounts" },
  { name: "Telegram", href: "/telegram", icon: MessageSquare, description: "Messages & chats" },
];

export function AgencySidebar({ user, organizationLogo, isAdmin = false }: AgencySidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    if (isAdmin) {
      await fetch("/api/admin/auth/logout", { method: "POST" });
      router.push("/admin/login");
    } else {
      signOut({ callbackUrl: "/login" });
    }
  };

  return (
    <div className="flex h-full w-64 flex-col bg-card border-r border-border">
      {/* Logo Header */}
      <div className="flex h-16 items-center gap-3 px-5 border-b border-border">
        {organizationLogo ? (
          <img
            src={organizationLogo}
            alt={user.organizationName}
            className="h-9 w-9 rounded-xl object-cover shadow-lg"
          />
        ) : (
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="text-lg font-bold text-white">{user.organizationName.charAt(0)}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <span className="text-lg font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text truncate block">{user.organizationName}</span>
          {isAdmin && (
            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-purple-500/20 text-purple-500 rounded border border-purple-500/30">
              ADMIN
            </span>
          )}
        </div>
        <ThemeToggle />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 mb-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Main Menu
          </p>
        </div>

        {navigation.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                isActive
                  ? "bg-primary-foreground/20"
                  : "bg-muted group-hover:bg-background"
              )}>
                <item.icon className={cn(
                  "h-4 w-4 transition-transform group-hover:scale-110",
                  isActive ? "text-primary-foreground" : ""
                )} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "truncate",
                  isActive ? "text-primary-foreground" : ""
                )}>
                  {item.name}
                </p>
                {!isActive && (
                  <p className="text-[10px] text-muted-foreground truncate group-hover:text-muted-foreground/80">
                    {item.description}
                  </p>
                )}
              </div>
              {isActive && (
                <ChevronRight className="h-4 w-4 text-primary-foreground/70" />
              )}
            </Link>
          );
        })}

        {/* Settings - Separated */}
        <div className="pt-4 mt-4 border-t border-border">
          <div className="px-3 mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              System
            </p>
          </div>
          <Link
            href="/settings"
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
              pathname.startsWith("/settings")
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <div className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
              pathname.startsWith("/settings")
                ? "bg-primary-foreground/20"
                : "bg-muted group-hover:bg-background"
            )}>
              <Settings className={cn(
                "h-4 w-4 transition-transform group-hover:scale-110",
                pathname.startsWith("/settings") ? "text-primary-foreground" : ""
              )} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn(
                "truncate",
                pathname.startsWith("/settings") ? "text-primary-foreground" : ""
              )}>
                Settings
              </p>
              {!pathname.startsWith("/settings") && (
                <p className="text-[10px] text-muted-foreground truncate">
                  Preferences & config
                </p>
              )}
            </div>
            {pathname.startsWith("/settings") && (
              <ChevronRight className="h-4 w-4 text-primary-foreground/70" />
            )}
          </Link>
        </div>
      </nav>

      {/* User Menu */}
      <div className="border-t border-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name || "User avatar"}
                className="h-9 w-9 rounded-lg object-cover ring-2 ring-border"
              />
            ) : (
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-semibold text-white shadow-lg shadow-indigo-500/20">
                {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 text-left min-w-0">
              <p className="font-medium text-foreground truncate text-sm">
                {user.name || user.email.split('@')[0]}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user.organizationName}
              </p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{user.email}</span>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-rose-600 focus:text-rose-600 focus:bg-rose-500/10 cursor-pointer"
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
