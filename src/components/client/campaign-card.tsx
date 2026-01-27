"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatNumber, getStatusColor, cn } from "@/lib/utils";
import {
  Eye,
  Heart,
  Users,
  FileText,
  Clock,
  TrendingUp,
  ArrowRight,
  DollarSign,
} from "lucide-react";

export interface CampaignCardProps {
  id: string;
  name: string;
  description: string | null;
  status: string;
  projectAvatarUrl?: string | null;
  projectBannerUrl?: string | null;
  projectTwitterHandle?: string | null;
  totalImpressions: number;
  totalEngagement: number;
  kolCount: number;
  totalPosts: number;
  publishedPosts: number;
  pendingApproval: number;
  engagementRate: string;
  totalBudget?: number;
  spentBudget?: number;
  viewMode?: "grid" | "list";
}

export function CampaignCard({
  id,
  name,
  description,
  status,
  projectAvatarUrl,
  projectBannerUrl,
  projectTwitterHandle,
  totalImpressions,
  totalEngagement,
  kolCount,
  totalPosts,
  publishedPosts,
  pendingApproval,
  engagementRate,
  totalBudget = 0,
  spentBudget = 0,
  viewMode = "grid",
}: CampaignCardProps) {
  const progressPercent = totalPosts > 0 ? (publishedPosts / totalPosts) * 100 : 0;
  const budgetPercent = totalBudget > 0 ? (spentBudget / totalBudget) * 100 : 0;

  // Format budget as currency (stored in cents)
  const formatBudget = (cents: number) => {
    const dollars = cents / 100;
    if (dollars >= 1000000) return `$${(dollars / 1000000).toFixed(1)}M`;
    if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}K`;
    return `$${dollars.toLocaleString()}`;
  };

  if (viewMode === "list") {
    return (
      <Link href={`/client/campaigns/${id}`} className="block group">
        <motion.div
          whileHover={{ scale: 1.01 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          <Card className="hover:border-primary/50 hover:shadow-lg transition-all">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <Avatar className="h-12 w-12 rounded-lg ring-2 ring-border">
                  <AvatarImage src={projectAvatarUrl || undefined} />
                  <AvatarFallback className="rounded-lg bg-primary/10">
                    {name.charAt(0)}
                  </AvatarFallback>
                </Avatar>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold group-hover:text-primary transition-colors truncate">
                      {name}
                    </h3>
                    <Badge className={`${getStatusColor(status)} shrink-0`} variant="secondary">
                      {status.replace("_", " ")}
                    </Badge>
                    {pendingApproval > 0 && (
                      <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30 shrink-0">
                        <Clock className="h-3 w-3 mr-1" />
                        {pendingApproval} pending
                      </Badge>
                    )}
                  </div>
                  {description && (
                    <p className="text-sm text-muted-foreground truncate">
                      {description}
                    </p>
                  )}
                </div>

                {/* Stats */}
                <div className="hidden md:flex items-center gap-6 text-sm">
                  {totalBudget > 0 && (
                    <div className="text-center">
                      <p className="font-semibold text-emerald-600 dark:text-emerald-400">{formatBudget(totalBudget)}</p>
                      <p className="text-xs text-muted-foreground">Budget</p>
                    </div>
                  )}
                  <div className="text-center">
                    <p className="font-semibold">{formatNumber(totalImpressions)}</p>
                    <p className="text-xs text-muted-foreground">Impressions</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold">{formatNumber(totalEngagement)}</p>
                    <p className="text-xs text-muted-foreground">Engagement</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold">{kolCount}</p>
                    <p className="text-xs text-muted-foreground">KOLs</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold">{publishedPosts}/{totalPosts}</p>
                    <p className="text-xs text-muted-foreground">Posts</p>
                  </div>
                </div>

                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </Link>
    );
  }

  // Grid view (default)
  return (
    <Link href={`/client/campaigns/${id}`} className="block group">
      <motion.div
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
      >
        <Card className="h-full overflow-hidden hover:border-primary/50 hover:shadow-lg transition-all">
          {/* Banner */}
          <div className="relative h-24 bg-gradient-to-br from-primary/20 to-primary/5">
            {projectBannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={projectBannerUrl}
                alt={`${name} banner`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-primary/20 to-transparent" />
            )}
            {/* Status badge */}
            <Badge
              className={cn(
                "absolute top-3 right-3",
                getStatusColor(status)
              )}
              variant="secondary"
            >
              {status.replace("_", " ")}
            </Badge>
          </div>

          <CardContent className="p-4 pt-0">
            {/* Avatar overlapping banner */}
            <div className="relative -mt-8 mb-3 flex items-end justify-between">
              <Avatar className="h-14 w-14 ring-4 ring-background rounded-xl">
                <AvatarImage src={projectAvatarUrl || undefined} className="rounded-xl" />
                <AvatarFallback className="rounded-xl bg-primary text-primary-foreground text-lg">
                  {name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              {projectTwitterHandle && (
                <span className="text-xs text-muted-foreground">
                  @{projectTwitterHandle}
                </span>
              )}
            </div>

            {/* Title & Description */}
            <div className="mb-3">
              <h3 className="font-semibold text-lg group-hover:text-primary transition-colors line-clamp-1">
                {name}
              </h3>
              {description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                  {description}
                </p>
              )}
            </div>

            {/* Pending Alert */}
            {pendingApproval > 0 && (
              <div className="flex items-center gap-2 p-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-lg mb-3 border border-amber-200 dark:border-amber-800">
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                  {pendingApproval} post{pendingApproval !== 1 ? "s" : ""} pending approval
                </span>
              </div>
            )}

            {/* Budget */}
            {totalBudget > 0 && (
              <div className="mb-3 p-3 bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20 rounded-lg border border-emerald-200/50 dark:border-emerald-800/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Budget</span>
                  </div>
                  <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {formatBudget(totalBudget)}
                  </span>
                </div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-emerald-600/70 dark:text-emerald-400/70">Allocated</span>
                  <span className="font-medium text-emerald-700 dark:text-emerald-300">
                    {formatBudget(spentBudget)} ({budgetPercent.toFixed(0)}%)
                  </span>
                </div>
                <div className="h-1.5 bg-emerald-200/50 dark:bg-emerald-800/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${Math.min(budgetPercent, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Content Progress */}
            <div className="mb-4">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">Content Progress</span>
                <span className="font-medium">{publishedPosts}/{totalPosts}</span>
              </div>
              <Progress value={progressPercent} className="h-1.5" />
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-4 gap-2">
              <div className="text-center p-2 bg-muted/50 rounded-lg">
                <Eye className="h-4 w-4 mx-auto text-sky-500 mb-1" />
                <p className="font-semibold text-xs">{formatNumber(totalImpressions)}</p>
              </div>
              <div className="text-center p-2 bg-muted/50 rounded-lg">
                <Heart className="h-4 w-4 mx-auto text-rose-500 mb-1" />
                <p className="font-semibold text-xs">{formatNumber(totalEngagement)}</p>
              </div>
              <div className="text-center p-2 bg-muted/50 rounded-lg">
                <Users className="h-4 w-4 mx-auto text-indigo-500 mb-1" />
                <p className="font-semibold text-xs">{kolCount}</p>
              </div>
              <div className="text-center p-2 bg-muted/50 rounded-lg">
                <FileText className="h-4 w-4 mx-auto text-emerald-500 mb-1" />
                <p className="font-semibold text-xs">{totalPosts}</p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span>{engagementRate}% ER</span>
              </div>
              <div className="flex items-center gap-1 text-primary text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                View Details
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </Link>
  );
}
