"use client";

import { Users, Target, FileCheck, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import Link from "next/link";

interface PortfolioHealthProps {
  networkReach: number;
  avgEngagementRate: number;
  activeKols: number;
  totalKols: number;
  pendingReviewCount: number;
  reachChange?: number; // percentage change from last period
  engagementChange?: number;
}

export function PortfolioHealth({
  networkReach,
  avgEngagementRate,
  activeKols,
  totalKols,
  pendingReviewCount,
  reachChange = 0,
  engagementChange = 0,
}: PortfolioHealthProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Network Reach */}
      <div className="group relative overflow-hidden rounded-xl bg-card p-6 border border-border hover:border-indigo-500/50 transition-all duration-300">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-indigo-500/20">
              <Users className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
            </div>
            {reachChange !== 0 && (
              <span className={`flex items-center text-xs ${reachChange > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {reachChange > 0 ? <ArrowUpRight className="h-3 w-3 mr-0.5" /> : <ArrowDownRight className="h-3 w-3 mr-0.5" />}
                {Math.abs(reachChange).toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-3xl font-bold text-foreground mb-1">
            {formatNumber(networkReach)}
          </p>
          <p className="text-sm text-muted-foreground">Network Reach</p>
          <p className="text-xs text-muted-foreground mt-1">Total followers across all KOLs</p>
        </div>
      </div>

      {/* Avg Engagement Rate */}
      <div className="group relative overflow-hidden rounded-xl bg-card p-6 border border-border hover:border-teal-500/50 transition-all duration-300">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-teal-500/20">
              <Target className="h-5 w-5 text-teal-500 dark:text-teal-400" />
            </div>
            {engagementChange !== 0 && (
              <span className={`flex items-center text-xs ${engagementChange > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {engagementChange > 0 ? <ArrowUpRight className="h-3 w-3 mr-0.5" /> : <ArrowDownRight className="h-3 w-3 mr-0.5" />}
                {Math.abs(engagementChange).toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-3xl font-bold text-foreground mb-1">
            {avgEngagementRate.toFixed(2)}%
          </p>
          <p className="text-sm text-muted-foreground">Avg Engagement Rate</p>
          <p className="text-xs text-muted-foreground mt-1">Weighted by follower count</p>
        </div>
      </div>

      {/* Active KOLs */}
      <div className="group relative overflow-hidden rounded-xl bg-card p-6 border border-border hover:border-purple-500/50 transition-all duration-300">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <TrendingUp className="h-5 w-5 text-purple-500 dark:text-purple-400" />
            </div>
            <span className="text-xs text-muted-foreground">
              {totalKols > 0 ? Math.round((activeKols / totalKols) * 100) : 0}% active
            </span>
          </div>
          <p className="text-3xl font-bold text-foreground mb-1">
            {activeKols} <span className="text-lg font-normal text-muted-foreground">/ {totalKols}</span>
          </p>
          <p className="text-sm text-muted-foreground">Active KOLs</p>
          {/* Activity bar */}
          <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all duration-500"
              style={{ width: `${totalKols > 0 ? (activeKols / totalKols) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Pending Review */}
      <Link href="/content/review" className="block">
        <div className="group relative overflow-hidden rounded-xl bg-card p-6 border border-border hover:border-amber-500/50 transition-all duration-300 h-full">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <FileCheck className="h-5 w-5 text-amber-500 dark:text-amber-400" />
              </div>
              {pendingReviewCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white animate-pulse">
                  {pendingReviewCount > 99 ? '99+' : pendingReviewCount}
                </span>
              )}
            </div>
            <p className="text-3xl font-bold text-foreground mb-1">
              {pendingReviewCount}
            </p>
            <p className="text-sm text-muted-foreground">Pending Review</p>
            <p className="text-xs text-muted-foreground mt-1">Posts awaiting approval</p>
          </div>
        </div>
      </Link>
    </div>
  );
}
