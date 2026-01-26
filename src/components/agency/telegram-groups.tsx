"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Search,
  RefreshCw,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  Hash,
} from "lucide-react";
import { TelegramGroupChat } from "./telegram-group-chat";

interface TelegramChat {
  id: string;
  telegramChatId: string;
  title: string | null;
  type: string;
  username: string | null;
  status: string;
  memberCount: number;
  botJoinedAt: string;
  lastMessage: {
    content: string;
    timestamp: string;
    senderName: string | null;
  } | null;
  kolLinks: Array<{
    id: string;
    kol: {
      id: string;
      name: string;
      twitterHandle: string;
      telegramUsername: string | null;
      avatarUrl: string | null;
    };
    campaignProgress: Array<{
      campaignId: string;
      campaignName: string;
      total: number;
      completed: number;
      percentage: number;
    }>;
  }>;
}

interface Campaign {
  id: string;
  name: string;
}

interface TelegramGroupsProps {
  campaigns: Campaign[];
}

export function TelegramGroups({ campaigns }: TelegramGroupsProps) {
  const [chats, setChats] = useState<TelegramChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ACTIVE");
  const [hasKolFilter, setHasKolFilter] = useState<string>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [kpiFilter, setKpiFilter] = useState<string>("any");
  const [selectedChat, setSelectedChat] = useState<TelegramChat | null>(null);

  const fetchChats = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (hasKolFilter !== "all") params.set("hasKol", hasKolFilter);
      if (campaignFilter !== "all") params.set("campaignId", campaignFilter);
      if (kpiFilter !== "any") params.set("kpiStatus", kpiFilter);
      if (searchQuery) params.set("search", searchQuery);

      const response = await fetch(`/api/telegram/chats?${params}`);
      if (response.ok) {
        const data = await response.json();
        setChats(data.chats);
      }
    } catch (error) {
      console.error("Failed to fetch chats:", error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, hasKolFilter, campaignFilter, kpiFilter, searchQuery]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch("/api/telegram/sync", { method: "POST" });
      if (response.ok) {
        await fetchChats();
      }
    } catch (error) {
      console.error("Failed to sync:", error);
    } finally {
      setSyncing(false);
    }
  };

  const getKpiStatusBadge = (chat: TelegramChat) => {
    if (chat.kolLinks.length === 0) {
      return null;
    }

    const hasProgress = chat.kolLinks.some(
      (link) => link.campaignProgress.length > 0
    );
    if (!hasProgress) {
      return null;
    }

    const allMet = chat.kolLinks.every((link) =>
      link.campaignProgress.every((p) => p.percentage >= 100)
    );
    const anyNotMet = chat.kolLinks.some((link) =>
      link.campaignProgress.some((p) => p.percentage < 100)
    );

    if (allMet) {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle className="h-3 w-3 mr-1" />
          Met KPI
        </Badge>
      );
    }
    if (anyNotMet) {
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
          <AlertCircle className="h-3 w-3 mr-1" />
          In Progress
        </Badge>
      );
    }
    return null;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Group Chats</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncing}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`}
              />
              Sync Groups
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mt-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search groups..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="LEFT">Left</SelectItem>
                <SelectItem value="KICKED">Kicked</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>

            <Select value={hasKolFilter} onValueChange={setHasKolFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="KOL Link" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Groups</SelectItem>
                <SelectItem value="true">Has KOL</SelectItem>
                <SelectItem value="false">No KOL</SelectItem>
              </SelectContent>
            </Select>

            <Select value={campaignFilter} onValueChange={setCampaignFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Campaign" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Campaigns</SelectItem>
                {campaigns.map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {campaignFilter !== "all" && (
              <Select value={kpiFilter} onValueChange={setKpiFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="KPI Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="met">Met KPI</SelectItem>
                  <SelectItem value="not_met">Not Met</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : chats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground font-medium">No groups found</p>
              <p className="text-sm text-muted-foreground mt-1 text-center max-w-md">
                Add the bot to a Telegram group to get started. After adding the bot,
                click "Sync Groups" or have someone send a message in the group.
              </p>
              <p className="text-xs text-muted-foreground mt-2 text-center max-w-md">
                Note: Webhooks require a public HTTPS URL. If running locally, use ngrok or similar.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={handleSync}
                disabled={syncing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                Sync Groups Now
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {chats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => setSelectedChat(chat)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-muted transition-colors text-left"
                >
                  <div className="relative">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-indigo-100 text-indigo-600">
                        {chat.type === "SUPERGROUP" ? (
                          <Hash className="h-5 w-5" />
                        ) : (
                          <Users className="h-5 w-5" />
                        )}
                      </AvatarFallback>
                    </Avatar>
                    {chat.status !== "ACTIVE" && (
                      <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-red-500 border-2 border-background" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">
                        {chat.title || "Unnamed Group"}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {chat.type.toLowerCase()}
                      </Badge>
                      {getKpiStatusBadge(chat)}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                      {chat.username && (
                        <span className="truncate">@{chat.username}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {chat.memberCount}
                      </span>
                      {chat.kolLinks.length > 0 && (
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3.5 w-3.5" />
                          {chat.kolLinks.length} KOL
                          {chat.kolLinks.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Linked KOLs avatars */}
                  {chat.kolLinks.length > 0 && (
                    <div className="flex -space-x-2">
                      {chat.kolLinks.slice(0, 3).map((link) => (
                        <Avatar
                          key={link.id}
                          className="h-8 w-8 border-2 border-background"
                        >
                          <AvatarFallback className="text-xs bg-violet-100 text-violet-600">
                            {link.kol.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {chat.kolLinks.length > 3 && (
                        <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium">
                          +{chat.kolLinks.length - 3}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Last activity */}
                  {chat.lastMessage && (
                    <div className="text-right text-sm text-muted-foreground">
                      <p className="truncate max-w-[120px]">
                        {chat.lastMessage.content.substring(0, 30)}
                        {chat.lastMessage.content.length > 30 ? "..." : ""}
                      </p>
                      <p className="text-xs">
                        {new Date(chat.lastMessage.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Group Chat Modal */}
      {selectedChat && (
        <TelegramGroupChat
          chat={selectedChat}
          onClose={() => setSelectedChat(null)}
          onMessageSent={fetchChats}
        />
      )}
    </>
  );
}
