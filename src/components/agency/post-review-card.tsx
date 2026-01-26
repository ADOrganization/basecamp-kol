"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CheckCircle,
  XCircle,
  ExternalLink,
  Heart,
  Loader2,
  Send,
  Edit3,
  Eye,
  Repeat2,
  MessageCircle,
  Bookmark,
  RefreshCw,
  EyeOff,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Post {
  id: string;
  content: string | null;
  type: string;
  status: string;
  tweetUrl: string | null;
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  bookmarks: number;
  kol: {
    name: string;
    twitterHandle: string;
    avatarUrl?: string | null;
  };
  campaign: {
    name: string;
  };
}

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  DRAFT: { bg: "bg-slate-500/10", text: "text-slate-600", border: "border-slate-500/30" },
  PENDING_APPROVAL: { bg: "bg-amber-500/10", text: "text-amber-600", border: "border-amber-500/30" },
  CHANGES_REQUESTED: { bg: "bg-orange-500/10", text: "text-orange-600", border: "border-orange-500/30" },
  APPROVED: { bg: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-500/30" },
  REJECTED: { bg: "bg-rose-500/10", text: "text-rose-600", border: "border-rose-500/30" },
  SCHEDULED: { bg: "bg-blue-500/10", text: "text-blue-600", border: "border-blue-500/30" },
  POSTED: { bg: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-500/30" },
  VERIFIED: { bg: "bg-indigo-500/10", text: "text-indigo-600", border: "border-indigo-500/30" },
};

interface PostReviewCardProps {
  post: Post;
  showActions?: boolean;
  onStatusChange?: (postId: string, newStatus: string) => void;
}

export function PostReviewCard({ post, showActions = false, onStatusChange }: PostReviewCardProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "reject" | "changes" | "refresh" | "hide" | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showChangesDialog, setShowChangesDialog] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");
  const [changesNotes, setChangesNotes] = useState("");
  const [currentStatus, setCurrentStatus] = useState(post.status);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState({
    impressions: post.impressions,
    likes: post.likes,
    retweets: post.retweets,
    replies: post.replies,
    bookmarks: post.bookmarks,
  });

  const handleApprove = async () => {
    setIsLoading(true);
    setActionType("approve");
    setError(null);
    try {
      const response = await fetch(`/api/posts/${post.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" }),
      });
      if (response.ok) {
        setCurrentStatus("APPROVED");
        onStatusChange?.(post.id, "APPROVED");
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.error || "Failed to approve post");
      }
    } catch (err) {
      console.error("Failed to approve post:", err);
      setError("Failed to approve post. Please try again.");
    } finally {
      setIsLoading(false);
      setActionType(null);
    }
  };

  const handleReject = async () => {
    setIsLoading(true);
    setActionType("reject");
    setError(null);
    try {
      const response = await fetch(`/api/posts/${post.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "REJECTED",
          clientNotes: rejectNotes || undefined,
        }),
      });
      if (response.ok) {
        setCurrentStatus("REJECTED");
        setShowRejectDialog(false);
        setRejectNotes("");
        onStatusChange?.(post.id, "REJECTED");
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.error || "Failed to reject post");
      }
    } catch (err) {
      console.error("Failed to reject post:", err);
      setError("Failed to reject post. Please try again.");
    } finally {
      setIsLoading(false);
      setActionType(null);
    }
  };

  const handleMarkPosted = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/posts/${post.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "POSTED",
          postedAt: new Date().toISOString(),
        }),
      });
      if (response.ok) {
        setCurrentStatus("POSTED");
        onStatusChange?.(post.id, "POSTED");
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.error || "Failed to mark as posted");
      }
    } catch (err) {
      console.error("Failed to mark as posted:", err);
      setError("Failed to mark as posted. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestChanges = async () => {
    setIsLoading(true);
    setActionType("changes");
    setError(null);
    try {
      const response = await fetch(`/api/posts/${post.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "CHANGES_REQUESTED",
          clientNotes: changesNotes || undefined,
        }),
      });
      if (response.ok) {
        setCurrentStatus("CHANGES_REQUESTED");
        setShowChangesDialog(false);
        setChangesNotes("");
        onStatusChange?.(post.id, "CHANGES_REQUESTED");
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.error || "Failed to request changes");
      }
    } catch (err) {
      console.error("Failed to request changes:", err);
      setError("Failed to request changes. Please try again.");
    } finally {
      setIsLoading(false);
      setActionType(null);
    }
  };

  const handleRefreshMetrics = async () => {
    if (!post.tweetUrl) {
      setError("No tweet URL to refresh metrics from");
      return;
    }
    setIsLoading(true);
    setActionType("refresh");
    setError(null);
    try {
      const response = await fetch(`/api/posts/${post.id}/refresh-metrics`, {
        method: "POST",
      });
      const data = await response.json();
      if (response.ok) {
        setMetrics({
          impressions: data.metrics.impressions,
          likes: data.metrics.likes,
          retweets: data.metrics.retweets,
          replies: data.metrics.replies,
          bookmarks: data.metrics.bookmarks,
        });
      } else {
        setError(data.error || "Failed to refresh metrics");
      }
    } catch (err) {
      console.error("Failed to refresh metrics:", err);
      setError("Failed to refresh metrics. Please try again.");
    } finally {
      setIsLoading(false);
      setActionType(null);
    }
  };

  const handleHideFromReview = async () => {
    setIsLoading(true);
    setActionType("hide");
    setError(null);
    try {
      const response = await fetch(`/api/posts/${post.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hiddenFromReview: true }),
      });
      if (response.ok) {
        router.refresh();
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.error || "Failed to hide post");
      }
    } catch (err) {
      console.error("Failed to hide post:", err);
      setError("Failed to hide post. Please try again.");
    } finally {
      setIsLoading(false);
      setActionType(null);
    }
  };

  // Show actions for DRAFT and PENDING_APPROVAL statuses
  const needsReview = currentStatus === "PENDING_APPROVAL" || currentStatus === "DRAFT";
  const isApproved = currentStatus === "APPROVED";
  const isPosted = currentStatus === "POSTED" || currentStatus === "VERIFIED";

  const statusStyle = STATUS_STYLES[currentStatus] || STATUS_STYLES.DRAFT;

  return (
    <>
      <div className={cn(
        "group rounded-xl border bg-card p-5 hover:shadow-lg transition-all",
        needsReview ? "border-amber-500/30 bg-amber-500/5" : ""
      )}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1">
            {post.kol.avatarUrl ? (
              <img
                src={post.kol.avatarUrl}
                alt={post.kol.name}
                className="h-11 w-11 rounded-xl object-cover shadow-lg flex-shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                  if (fallback) fallback.classList.remove('hidden');
                }}
              />
            ) : null}
            <div className={cn(
              "h-11 w-11 rounded-xl flex items-center justify-center font-semibold text-white shadow-lg flex-shrink-0",
              "bg-gradient-to-br from-indigo-500 to-purple-600",
              post.kol.avatarUrl ? "hidden" : ""
            )}>
              {post.kol.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 space-y-2 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">{post.kol.name}</span>
                <a
                  href={`https://x.com/${post.kol.twitterHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-primary flex items-center gap-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  @{post.kol.twitterHandle}
                  <ArrowUpRight className="h-3 w-3" />
                </a>
                <Badge className={cn(statusStyle.bg, statusStyle.text, statusStyle.border, "border text-xs")}>
                  {currentStatus.replace("_", " ")}
                </Badge>
                <Badge variant="outline" className="text-xs">{post.type}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Campaign: <span className="font-medium text-foreground">{post.campaign.name}</span>
              </p>
              {showActions && post.content && (
                <div className="bg-muted/50 p-4 rounded-lg mt-2 border">
                  <p className="text-sm whitespace-pre-wrap">{post.content}</p>
                </div>
              )}
              {!showActions && post.content && (
                <p className="text-sm mt-2 line-clamp-2 text-muted-foreground">{post.content}</p>
              )}
              {/* Metrics */}
              <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md" title="Views">
                  <Eye className="h-3.5 w-3.5" />
                  {(metrics.impressions ?? 0).toLocaleString()}
                </span>
                <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md" title="Reposts">
                  <Repeat2 className="h-3.5 w-3.5" />
                  {(metrics.retweets ?? 0).toLocaleString()}
                </span>
                <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md" title="Comments">
                  <MessageCircle className="h-3.5 w-3.5" />
                  {(metrics.replies ?? 0).toLocaleString()}
                </span>
                <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md" title="Bookmarks">
                  <Bookmark className="h-3.5 w-3.5" />
                  {(metrics.bookmarks ?? 0).toLocaleString()}
                </span>
                <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md" title="Likes">
                  <Heart className="h-3.5 w-3.5" />
                  {(metrics.likes ?? 0).toLocaleString()}
                </span>
              </div>
              {error && (
                <div className="mt-2 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm">
                  {error}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 items-center flex-wrap justify-end">
            {showActions && needsReview && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 border-rose-500/30"
                  onClick={() => setShowRejectDialog(true)}
                  disabled={isLoading}
                >
                  {isLoading && actionType === "reject" ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-1" />
                  )}
                  Reject
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 border-amber-500/30"
                  onClick={() => setShowChangesDialog(true)}
                  disabled={isLoading}
                >
                  {isLoading && actionType === "changes" ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Edit3 className="h-4 w-4 mr-1" />
                  )}
                  Changes
                </Button>
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/25"
                  onClick={handleApprove}
                  disabled={isLoading}
                >
                  {isLoading && actionType === "approve" ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-1" />
                  )}
                  Approve
                </Button>
              </>
            )}
            {showActions && isApproved && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleMarkPosted}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-1" />
                )}
                Mark Posted
              </Button>
            )}
            {post.tweetUrl && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRefreshMetrics}
                  disabled={isLoading}
                  title="Refresh metrics from X"
                  className="opacity-70 group-hover:opacity-100 transition-opacity"
                >
                  {isLoading && actionType === "refresh" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href={post.tweetUrl} target="_blank">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    View
                  </Link>
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleHideFromReview}
              disabled={isLoading}
              title="Hide from review"
              className="opacity-70 group-hover:opacity-100 transition-opacity"
            >
              {isLoading && actionType === "hide" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Post</DialogTitle>
            <DialogDescription>
              Provide feedback to the KOL about why this post is being rejected.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reject-notes">Feedback (optional)</Label>
              <Textarea
                id="reject-notes"
                placeholder="Enter feedback for the KOL..."
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Reject Post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showChangesDialog} onOpenChange={setShowChangesDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Changes</DialogTitle>
            <DialogDescription>
              Provide feedback to the KOL about what changes are needed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="changes-notes">Feedback</Label>
              <Textarea
                id="changes-notes"
                placeholder="Describe the changes needed..."
                value={changesNotes}
                onChange={(e) => setChangesNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChangesDialog(false)}>
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              onClick={handleRequestChanges}
              disabled={isLoading || !changesNotes.trim()}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Request Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}
