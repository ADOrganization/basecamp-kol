"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Send,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  Filter,
} from "lucide-react";

interface Campaign {
  id: string;
  name: string;
}

interface Broadcast {
  id: string;
  content: string;
  filterType: string;
  filterCampaignId: string | null;
  targetCount: number;
  sentCount: number;
  failedCount: number;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

interface TelegramBroadcastProps {
  campaigns: Campaign[];
}

export function TelegramBroadcast({ campaigns }: TelegramBroadcastProps) {
  const [message, setMessage] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [campaignId, setCampaignId] = useState<string>("");
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [targetPreview, setTargetPreview] = useState<{
    totalChats: number;
    chats: Array<{ id: string; title: string | null; linkedKols: number }>;
  } | null>(null);

  useEffect(() => {
    fetchBroadcasts();
  }, []);

  useEffect(() => {
    if (filterType === "all" || (filterType !== "all" && campaignId)) {
      fetchTargetPreview();
    } else {
      setTargetPreview(null);
    }
  }, [filterType, campaignId]);

  const fetchBroadcasts = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/telegram/broadcast");
      if (response.ok) {
        const data = await response.json();
        setBroadcasts(data.broadcasts);
      }
    } catch (error) {
      console.error("Failed to fetch broadcasts:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTargetPreview = async () => {
    try {
      const params = new URLSearchParams();
      params.set("filterType", filterType);
      if (campaignId) params.set("campaignId", campaignId);

      const response = await fetch(`/api/telegram/chats?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTargetPreview({
          totalChats: data.total,
          chats: data.chats.map(
            (c: { id: string; title: string | null; kolLinks: unknown[] }) => ({
              id: c.id,
              title: c.title,
              linkedKols: c.kolLinks?.length || 0,
            })
          ),
        });
      }
    } catch (error) {
      console.error("Failed to fetch preview:", error);
    }
  };

  const handleSendBroadcast = async () => {
    setSending(true);
    try {
      const response = await fetch("/api/telegram/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: message,
          filterType,
          filterCampaignId: campaignId || undefined,
        }),
      });

      if (response.ok) {
        setMessage("");
        setFilterType("all");
        setCampaignId("");
        await fetchBroadcasts();
      }
    } catch (error) {
      console.error("Failed to send broadcast:", error);
    } finally {
      setSending(false);
      setShowConfirm(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "sending":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700">
            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
            Sending
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  const getFilterLabel = (type: string, campaignId: string | null) => {
    const campaign = campaigns.find((c) => c.id === campaignId);
    switch (type) {
      case "all":
        return "All Groups";
      case "met_kpi":
        return `Met KPI${campaign ? ` (${campaign.name})` : ""}`;
      case "not_met_kpi":
        return `Not Met KPI${campaign ? ` (${campaign.name})` : ""}`;
      case "campaign":
        return campaign ? campaign.name : "Campaign";
      default:
        return type;
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Compose Broadcast */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Send Broadcast</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Target Audience</label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger>
                <SelectValue placeholder="Select filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Groups</SelectItem>
                <SelectItem value="met_kpi">KOLs Who Met KPI</SelectItem>
                <SelectItem value="not_met_kpi">KOLs Who Have NOT Met KPI</SelectItem>
                <SelectItem value="campaign">Specific Campaign</SelectItem>
              </SelectContent>
            </Select>

            {filterType !== "all" && (
              <Select value={campaignId} onValueChange={setCampaignId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select campaign" />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Target Preview */}
          {targetPreview && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{targetPreview.totalChats}</span>
                <span className="text-muted-foreground">
                  group{targetPreview.totalChats !== 1 ? "s" : ""} will receive
                  this message
                </span>
              </div>
              {targetPreview.totalChats > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {targetPreview.chats.slice(0, 5).map((chat) => (
                    <Badge key={chat.id} variant="secondary" className="text-xs">
                      {chat.title || "Unnamed"}
                    </Badge>
                  ))}
                  {targetPreview.totalChats > 5 && (
                    <Badge variant="secondary" className="text-xs">
                      +{targetPreview.totalChats - 5} more
                    </Badge>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Message Composer */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Message</label>
            <Textarea
              placeholder="Type your broadcast message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={4096}
            />
            <p className="text-xs text-muted-foreground text-right">
              {message.length}/4096 characters
            </p>
          </div>

          <Button
            className="w-full"
            onClick={() => setShowConfirm(true)}
            disabled={
              !message.trim() ||
              (filterType !== "all" && !campaignId) ||
              !targetPreview?.totalChats
            }
          >
            <Send className="h-4 w-4 mr-2" />
            Send Broadcast
          </Button>
        </CardContent>
      </Card>

      {/* Broadcast History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Broadcast History</CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchBroadcasts}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : broadcasts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Send className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No broadcasts sent yet</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {broadcasts.map((broadcast) => (
                <div
                  key={broadcast.id}
                  className="p-4 border rounded-lg space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm line-clamp-2">{broadcast.content}</p>
                    {getStatusBadge(broadcast.status)}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Filter className="h-3 w-3" />
                      {getFilterLabel(
                        broadcast.filterType,
                        broadcast.filterCampaignId
                      )}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {broadcast.targetCount} targets
                    </span>
                    {broadcast.status === "completed" && (
                      <>
                        <span className="text-green-600">
                          {broadcast.sentCount} sent
                        </span>
                        {broadcast.failedCount > 0 && (
                          <span className="text-red-600">
                            {broadcast.failedCount} failed
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {new Date(broadcast.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Broadcast</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to send a message to{" "}
              <strong>{targetPreview?.totalChats || 0}</strong> group
              {(targetPreview?.totalChats || 0) !== 1 ? "s" : ""}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4 p-3 bg-muted rounded-lg text-sm">
            {message}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSendBroadcast} disabled={sending}>
              {sending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Broadcast
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
