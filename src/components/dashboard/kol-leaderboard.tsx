"use client";

import { useState } from "react";
import { Users, TrendingUp, Clock, AlertCircle, ArrowUpRight } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface KOLData {
  id: string;
  name: string;
  twitterHandle: string;
  avatarUrl: string | null;
  followersCount: number;
  avgEngagementRate: number;
  tier: string;
}

interface PendingDeliverable {
  kolId: string;
  kolName: string;
  kolHandle: string;
  kolAvatar: string | null;
  campaignName: string;
  campaignId: string;
  pending: {
    posts: number;
    threads: number;
    retweets: number;
    spaces: number;
  };
}

interface FollowerGrowthKOL {
  id: string;
  name: string;
  twitterHandle: string;
  avatarUrl: string | null;
  followersGrowth: number;
  currentFollowers: number;
}

interface KOLLeaderboardProps {
  topPerformers: KOLData[];
  pendingDeliverables: PendingDeliverable[];
  inactiveKols: KOLData[];
  followerGrowthLeaders: FollowerGrowthKOL[];
}

function getTierColor(tier: string): string {
  const colors: Record<string, string> = {
    MACRO: 'bg-amber-500/10 text-amber-600',
    MEGA: 'bg-amber-500/10 text-amber-600',
    LARGE: 'bg-purple-500/10 text-purple-600',
    RISING: 'bg-purple-500/10 text-purple-600',
    MID: 'bg-blue-500/10 text-blue-600',
    MICRO: 'bg-blue-500/10 text-blue-600',
    SMALL: 'bg-teal-500/10 text-teal-600',
    NANO: 'bg-teal-500/10 text-teal-600',
  };
  return colors[tier] || 'bg-gray-500/10 text-gray-600';
}

export function KOLLeaderboard({
  topPerformers,
  pendingDeliverables,
  inactiveKols,
  followerGrowthLeaders,
}: KOLLeaderboardProps) {
  const [activeTab, setActiveTab] = useState("performers");

  const totalPendingDeliverables = pendingDeliverables.reduce((acc, kol) => {
    return acc + kol.pending.posts + kol.pending.threads + kol.pending.retweets + kol.pending.spaces;
  }, 0);

  return (
    <div className="rounded-xl border bg-card">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-500" />
              KOL Leaderboard
            </h2>
            <p className="text-sm text-muted-foreground">Operational insights for your network</p>
          </div>
          <Link
            href="/agency/kols"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            View all
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="p-6">
        <TabsList className="grid w-full grid-cols-4 mb-4">
          <TabsTrigger value="performers" className="text-xs">
            <TrendingUp className="h-3 w-3 mr-1" />
            Top Performers
          </TabsTrigger>
          <TabsTrigger value="deliverables" className="text-xs relative">
            <Clock className="h-3 w-3 mr-1" />
            Pending
            {totalPendingDeliverables > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-amber-500 text-[10px] text-white flex items-center justify-center">
                {totalPendingDeliverables > 9 ? '9+' : totalPendingDeliverables}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="inactive" className="text-xs">
            <AlertCircle className="h-3 w-3 mr-1" />
            Inactive
          </TabsTrigger>
          <TabsTrigger value="growth" className="text-xs">
            <TrendingUp className="h-3 w-3 mr-1" />
            Growth
          </TabsTrigger>
        </TabsList>

        {/* Top Performers */}
        <TabsContent value="performers" className="mt-0">
          {topPerformers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No KOL performance data yet
            </div>
          ) : (
            <div className="space-y-3">
              {topPerformers.map((kol, index) => (
                <Link
                  key={kol.id}
                  href={`/agency/kols/${kol.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <span className="text-sm font-medium text-muted-foreground w-5">
                    {index + 1}
                  </span>
                  <Avatar className="h-10 w-10 border">
                    {kol.avatarUrl && <AvatarImage src={kol.avatarUrl} />}
                    <AvatarFallback>{kol.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{kol.name}</p>
                    <p className="text-sm text-muted-foreground">@{kol.twitterHandle}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-emerald-600">{kol.avgEngagementRate.toFixed(2)}%</p>
                    <p className="text-xs text-muted-foreground">engagement rate</p>
                  </div>
                  <Badge variant="secondary" className={`text-xs ${getTierColor(kol.tier)}`}>
                    {kol.tier}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Pending Deliverables */}
        <TabsContent value="deliverables" className="mt-0">
          {pendingDeliverables.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              All deliverables completed
            </div>
          ) : (
            <div className="space-y-3">
              {pendingDeliverables.map((item) => (
                <Link
                  key={`${item.kolId}-${item.campaignId}`}
                  href={`/agency/campaigns/${item.campaignId}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <Avatar className="h-10 w-10 border">
                    {item.kolAvatar && <AvatarImage src={item.kolAvatar} />}
                    <AvatarFallback>{item.kolName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.kolName}</p>
                    <p className="text-sm text-muted-foreground truncate">{item.campaignName}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 text-xs">
                      {item.pending.posts > 0 && (
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600">
                          {item.pending.posts} posts
                        </span>
                      )}
                      {item.pending.threads > 0 && (
                        <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-600">
                          {item.pending.threads} threads
                        </span>
                      )}
                      {item.pending.retweets > 0 && (
                        <span className="px-2 py-0.5 rounded bg-teal-500/10 text-teal-600">
                          {item.pending.retweets} reposts
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Inactive KOLs */}
        <TabsContent value="inactive" className="mt-0">
          {inactiveKols.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              All KOLs are active
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground mb-2">
                No posts in the last 14 days
              </p>
              {inactiveKols.map((kol) => (
                <Link
                  key={kol.id}
                  href={`/agency/kols/${kol.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors border border-amber-500/20 bg-amber-500/5"
                >
                  <Avatar className="h-10 w-10 border">
                    {kol.avatarUrl && <AvatarImage src={kol.avatarUrl} />}
                    <AvatarFallback>{kol.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{kol.name}</p>
                    <p className="text-sm text-muted-foreground">@{kol.twitterHandle}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatNumber(kol.followersCount)}</p>
                    <p className="text-xs text-muted-foreground">followers</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Follower Growth */}
        <TabsContent value="growth" className="mt-0">
          {followerGrowthLeaders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No follower growth data available
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground mb-2">
                Last 30 days follower change
              </p>
              {followerGrowthLeaders.map((kol, index) => (
                <Link
                  key={kol.id}
                  href={`/agency/kols/${kol.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <span className="text-sm font-medium text-muted-foreground w-5">
                    {index + 1}
                  </span>
                  <Avatar className="h-10 w-10 border">
                    {kol.avatarUrl && <AvatarImage src={kol.avatarUrl} />}
                    <AvatarFallback>{kol.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{kol.name}</p>
                    <p className="text-sm text-muted-foreground">@{kol.twitterHandle}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${kol.followersGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {kol.followersGrowth >= 0 ? '+' : ''}{formatNumber(kol.followersGrowth)}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatNumber(kol.currentFollowers)} total</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
