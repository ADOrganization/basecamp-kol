"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatNumber,
  getStatusColor,
} from "@/lib/utils";
import {
  Eye,
  Heart,
  Repeat2,
  MessageCircle,
  Quote,
  Bookmark,
  ExternalLink,
  Calendar,
  RefreshCw,
  Loader2,
} from "lucide-react";

interface Post {
  id: string;
  type: string | null;
  status: string | null;
  content: string | null;
  tweetUrl: string | null;
  matchedKeywords: string[] | null;
  hasKeywordMatch: boolean | null;
  impressions: number | null;
  likes: number | null;
  retweets: number | null;
  replies: number | null;
  quotes: number | null;
  bookmarks: number | null;
  postedAt: string | null;
  createdAt: string;
  kol: {
    id: string;
    name: string;
    twitterHandle: string;
    avatarUrl?: string | null;
  } | null;
}

interface PostDetailModalProps {
  post: Post | null;
  open: boolean;
  onClose: () => void;
  onRefresh?: () => Promise<void>;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "Unknown";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function calculateEngagementRate(post: Post): string {
  const impressions = post.impressions || 0;
  if (impressions === 0) return "0.00";

  const engagement =
    (post.likes || 0) +
    (post.retweets || 0) +
    (post.replies || 0) +
    (post.quotes || 0) +
    (post.bookmarks || 0);

  return ((engagement / impressions) * 100).toFixed(2);
}

export function PostDetailModal({ post, open, onClose, onRefresh }: PostDetailModalProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!post || !onRefresh) return;
    setIsRefreshing(true);
    try {
      // Call the individual post refresh endpoint
      const response = await fetch(`/api/posts/${post.id}/refresh-metrics`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to refresh");
      }
      // Call the parent's refresh to update all data
      await onRefresh();
    } catch (error) {
      console.error("Failed to refresh:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!post) return null;

  const metrics = [
    { label: "Impressions", value: post.impressions || 0, icon: Eye },
    { label: "Likes", value: post.likes || 0, icon: Heart },
    { label: "Reposts", value: post.retweets || 0, icon: Repeat2 },
    { label: "Replies", value: post.replies || 0, icon: MessageCircle },
    { label: "Quotes", value: post.quotes || 0, icon: Quote },
    { label: "Bookmarks", value: post.bookmarks || 0, icon: Bookmark },
  ];

  const engagementRate = calculateEngagementRate(post);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-medium">
                {post.kol?.name?.charAt(0) || "?"}
              </div>
              <div>
                <DialogTitle className="text-left">
                  {post.kol?.name || "Unknown KOL"}
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  @{post.kol?.twitterHandle || "unknown"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onRefresh && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  title="Refresh metrics"
                >
                  {isRefreshing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              )}
              <Badge className={getStatusColor(post.status || "POSTED")} variant="secondary">
                {(post.status || "POSTED").replace("_", " ")}
              </Badge>
              <Badge variant="outline">
                {post.type || "POST"}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Posted Date */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Posted on {formatDate(post.postedAt || post.createdAt)}</span>
          </div>

          {/* Post Content */}
          {post.content && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {post.content}
              </p>
            </div>
          )}

          {/* Matched Keywords */}
          {post.matchedKeywords && post.matchedKeywords.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Matched Keywords</p>
              <div className="flex flex-wrap gap-1">
                {post.matchedKeywords.map((kw) => (
                  <Badge key={kw} variant="secondary" className="bg-green-100 text-green-700">
                    {kw}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Performance Metrics */}
          <div>
            <p className="text-sm font-medium mb-3">Performance Metrics</p>
            <div className="grid grid-cols-3 gap-3">
              {metrics.map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="rounded-lg border bg-card p-3 text-center"
                >
                  <Icon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-lg font-semibold">{formatNumber(value)}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Engagement Rate */}
          <div className="rounded-lg border bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 p-4 flex items-center justify-between">
            <span className="font-medium">Engagement Rate</span>
            <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {engagementRate}%
            </span>
          </div>

          {/* View on X Button */}
          {post.tweetUrl && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.open(post.tweetUrl!, "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View on X
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
