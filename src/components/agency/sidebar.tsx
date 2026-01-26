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
  Shield,
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
  isAdmin?: boolean;
}

const navigation = [
  { name: "Dashboard", href: "/agency/dashboard", icon: LayoutDashboard },
  { name: "KOLs", href: "/agency/kols", icon: Users },
  { name: "Campaigns", href: "/agency/campaigns", icon: Megaphone },
  { name: "Content Review", href: "/agency/content/review", icon: FileText },
  { name: "Client Accounts", href: "/agency/clients", icon: UserPlus },
  { name: "Telegram", href: "/agency/telegram", icon: MessageSquare },
  { name: "Settings", href: "/agency/settings", icon: Settings },
];

export function AgencySidebar({ user, isAdmin = false }: AgencySidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    if (isAdmin) {
      // Admin logout - call admin logout endpoint
      await fetch("/api/admin/auth/logout", { method: "POST" });
      router.push("/admin/login");
    } else {
      // Regular user logout
      signOut({ callbackUrl: "/login" });
    }
  };

  return (
    <div className="flex h-full w-64 flex-col bg-sidebar-bg text-sidebar-foreground border-r border-border">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 px-6 border-b border-sidebar-muted">
        <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
          <span className="text-lg font-bold text-white">B</span>
        </div>
        <span className="text-lg font-semibold">Basecamp</span>
        {isAdmin && (
          <span className="ml-1 px-2 py-0.5 text-xs font-medium bg-purple-600/20 text-purple-400 rounded-full border border-purple-500/30">
            Admin
          </span>
        )}
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col justify-start gap-2 px-3 py-6">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-4 py-3.5 text-base font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-white"
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
              <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-medium text-white">
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
              <Link href="/agency/settings">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
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
