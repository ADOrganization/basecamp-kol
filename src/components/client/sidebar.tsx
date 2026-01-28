"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Megaphone,
  FileCheck,
  BarChart3,
  Settings,
  LogOut,
  ChevronDown,
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

interface ClientSidebarProps {
  user: {
    name: string | null;
    email: string;
    avatarUrl?: string | null;
    organizationName: string;
  };
  brandingName: string;
  brandingLogo: string | null;
}

const navigation = [
  {
    name: "Dashboard",
    description: "Overview & metrics",
    href: "/client/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Campaigns",
    description: "Your promotions",
    href: "/client/campaigns",
    icon: Megaphone,
  },
  {
    name: "Review Posts",
    description: "Content approval",
    href: "/client/review",
    icon: FileCheck,
  },
  {
    name: "Analytics",
    description: "Performance data",
    href: "/client/analytics",
    icon: BarChart3,
  },
];

export function ClientSidebar({ user, brandingName, brandingLogo }: ClientSidebarProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col bg-sidebar-bg text-sidebar-foreground border-r border-border">
      {/* Campaign Branding */}
      <div className="flex h-16 items-center gap-2 px-6 border-b border-sidebar-muted">
        {brandingLogo ? (
          <img
            src={brandingLogo}
            alt={brandingName}
            className="h-8 w-8 rounded-full object-cover ring-2 ring-primary/20 flex-shrink-0"
          />
        ) : (
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center ring-2 ring-primary/20 flex-shrink-0">
            <span className="text-lg font-bold text-primary-foreground">
              {brandingName.charAt(0)}
            </span>
          </div>
        )}
        <span className="text-lg font-semibold truncate flex-1">
          {brandingName}
        </span>
        <ThemeToggle />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4">
        <p className="px-3 mb-2 text-xs font-semibold text-sidebar-text-muted uppercase tracking-wider">
          Main Menu
        </p>
        <div className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link key={item.name} href={item.href}>
                <motion.div
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all group relative",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-sidebar-text-muted hover:bg-sidebar-muted hover:text-sidebar-foreground"
                  )}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <motion.div
                    className={cn(
                      "h-9 w-9 rounded-lg flex items-center justify-center transition-colors",
                      isActive
                        ? "bg-primary-foreground/20"
                        : "bg-sidebar-muted group-hover:bg-primary/10"
                    )}
                    whileHover={{ scale: 1.1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  >
                    <item.icon className="h-5 w-5" />
                  </motion.div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{item.name}</p>
                    <p
                      className={cn(
                        "text-xs truncate",
                        isActive
                          ? "text-primary-foreground/70"
                          : "text-sidebar-text-muted"
                      )}
                    >
                      {item.description}
                    </p>
                  </div>
                  {isActive && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </motion.div>
                  )}
                </motion.div>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User Menu */}
      <div className="border-t border-sidebar-muted p-4">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-sidebar-muted transition-colors">
            {user.avatarUrl ? (
              <div className="relative">
                <img
                  src={user.avatarUrl}
                  alt={user.name || "User avatar"}
                  className="h-9 w-9 rounded-full object-cover ring-2 ring-primary/20"
                />
                <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-sidebar-bg" />
              </div>
            ) : (
              <div className="relative">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-sm font-medium text-primary-foreground ring-2 ring-primary/20">
                  {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-sidebar-bg" />
              </div>
            )}
            <div className="flex-1 text-left min-w-0">
              <p className="font-medium text-sidebar-foreground truncate">
                {user.name || user.email}
              </p>
              <p className="text-xs text-sidebar-text-muted truncate">
                {user.email}
              </p>
            </div>
            <ChevronDown className="h-4 w-4 text-sidebar-text-muted flex-shrink-0" />
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
