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

interface ClientSidebarProps {
  user: {
    name: string | null;
    email: string;
    organizationName: string;
  };
}

const navigation = [
  { name: "Dashboard", href: "/client/dashboard", icon: LayoutDashboard },
  { name: "Campaigns", href: "/client/campaigns", icon: Megaphone },
  { name: "Review Posts", href: "/client/review", icon: FileCheck },
  { name: "Analytics", href: "/client/analytics", icon: BarChart3 },
  { name: "Settings", href: "/client/settings", icon: Settings },
];

export function ClientSidebar({ user }: ClientSidebarProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col bg-sidebar-bg text-sidebar-foreground">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 px-6 border-b border-slate-800">
        <div className="h-8 w-8 rounded-lg bg-teal-600 flex items-center justify-center">
          <span className="text-lg font-bold text-white">B</span>
        </div>
        <span className="text-lg font-semibold">Basecamp</span>
        <span className="ml-auto text-xs bg-teal-600/20 text-teal-400 px-2 py-0.5 rounded">
          Client
        </span>
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
                  : "text-slate-400 hover:bg-sidebar-muted hover:text-white"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User Menu */}
      <div className="border-t border-slate-800 p-4">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-sidebar-muted">
            <div className="h-8 w-8 rounded-full bg-teal-600 flex items-center justify-center text-sm font-medium">
              {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-white truncate">
                {user.name || user.email}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {user.organizationName}
              </p>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-400" />
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
