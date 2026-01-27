"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Trophy, Eye, Heart, MessageCircle } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface KOL {
  id: string;
  name: string;
  twitterHandle: string;
  avatarUrl?: string | null;
  totalImpressions: number;
  totalEngagement: number;
  totalPosts: number;
}

interface KOLLeaderboardProps {
  kols: KOL[];
}

export function ClientKOLLeaderboard({ kols }: KOLLeaderboardProps) {
  const [activeTab, setActiveTab] = useState("impressions");

  const sortedByImpressions = [...kols].sort(
    (a, b) => b.totalImpressions - a.totalImpressions
  );
  const sortedByEngagement = [...kols].sort(
    (a, b) => b.totalEngagement - a.totalEngagement
  );
  const sortedByPosts = [...kols].sort((a, b) => b.totalPosts - a.totalPosts);

  const getLeaderboard = () => {
    switch (activeTab) {
      case "impressions":
        return sortedByImpressions;
      case "engagement":
        return sortedByEngagement;
      case "posts":
        return sortedByPosts;
      default:
        return sortedByImpressions;
    }
  };

  const leaderboard = getLeaderboard().slice(0, 5);

  const getRankBadge = (index: number) => {
    if (index === 0)
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600">
          <Trophy className="h-3 w-3 mr-1" />
          1st
        </Badge>
      );
    if (index === 1)
      return (
        <Badge className="bg-gray-400 hover:bg-gray-500">
          <Trophy className="h-3 w-3 mr-1" />
          2nd
        </Badge>
      );
    if (index === 2)
      return (
        <Badge className="bg-amber-700 hover:bg-amber-800">
          <Trophy className="h-3 w-3 mr-1" />
          3rd
        </Badge>
      );
    return (
      <Badge variant="outline" className="text-xs">
        #{index + 1}
      </Badge>
    );
  };

  const getValue = (kol: KOL) => {
    switch (activeTab) {
      case "impressions":
        return formatNumber(kol.totalImpressions);
      case "engagement":
        return formatNumber(kol.totalEngagement);
      case "posts":
        return kol.totalPosts.toString();
      default:
        return formatNumber(kol.totalImpressions);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          KOL Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="impressions" className="text-xs">
              <Eye className="h-3 w-3 mr-1" />
              Reach
            </TabsTrigger>
            <TabsTrigger value="engagement" className="text-xs">
              <Heart className="h-3 w-3 mr-1" />
              Engagement
            </TabsTrigger>
            <TabsTrigger value="posts" className="text-xs">
              <MessageCircle className="h-3 w-3 mr-1" />
              Posts
            </TabsTrigger>
          </TabsList>

          {["impressions", "engagement", "posts"].map((tab) => (
            <TabsContent key={tab} value={tab} className="space-y-3 mt-0">
              {leaderboard.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  No KOLs with activity yet
                </div>
              ) : (
                leaderboard.map((kol, index) => (
                  <div
                    key={kol.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg transition-colors",
                      index === 0
                        ? "bg-amber-50 dark:bg-amber-950/20"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <div className="flex-shrink-0">{getRankBadge(index)}</div>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={kol.avatarUrl || undefined} />
                      <AvatarFallback className="text-xs">
                        {kol.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{kol.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        @{kol.twitterHandle}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">{getValue(kol)}</p>
                      <p className="text-xs text-muted-foreground">
                        {activeTab === "impressions" && "impressions"}
                        {activeTab === "engagement" && "engagement"}
                        {activeTab === "posts" && "posts"}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
