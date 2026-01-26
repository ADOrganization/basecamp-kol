"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  };
  campaign: {
    name: string;
  };
}

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  PENDING_APPROVAL: "outline",
  CHANGES_REQUESTED: "outline",
  APPROVED: "default",
  REJECTED: "destructive",
  SCHEDULED: "secondary",
  POSTED: "default",
  VERIFIED: "default",
};

interface PostReviewCardProps {
  post: Post;
  showActions?: boolean;
  onStatusChange?: (postId: string, newStatus: string) => void;
}

export function PostReviewCard({ post, showActions = false, onStatusChange }: PostReviewCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "reject" | "changes" | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showChangesDialog, setShowChangesDialog] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");
  const [changesNotes, setChangesNotes] = useState("");
  const [currentStatus, setCurrentStatus] = useState(post.status);
  const [error, setError] = useState<string | null>(null);

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

  // Show actions for DRAFT and PENDING_APPROVAL statuses
  const needsReview = currentStatus === "PENDING_APPROVAL" || currentStatus === "DRAFT";
  const isApproved = currentStatus === "APPROVED";
  const isPosted = currentStatus === "POSTED" || currentStatus === "VERIFIED";

  return (
    <>
      <Card className={`card-hover ${needsReview ? "border-amber-200 dark:border-amber-900" : ""}`}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 flex-1">
              <Avatar className={`h-12 w-12 ${showActions ? "" : "h-10 w-10"}`}>
                <AvatarFallback className="bg-indigo-100 text-indigo-600">
                  {post.kol.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{post.kol.name}</span>
                  <span className="text-muted-foreground">@{post.kol.twitterHandle}</span>
                  <Badge variant={statusColors[currentStatus]}>
                    {currentStatus.replace("_", " ")}
                  </Badge>
                  <Badge variant="outline">{post.type}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Campaign: {post.campaign.name}
                </p>
                {showActions && post.content && (
                  <div className="bg-muted p-4 rounded-lg mt-2">
                    <p className="text-sm whitespace-pre-wrap">{post.content}</p>
                  </div>
                )}
                {!showActions && post.content && (
                  <p className="text-sm mt-2 line-clamp-2">{post.content}</p>
                )}
                {(currentStatus === "POSTED" || currentStatus === "VERIFIED") && (
                  <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <Eye className="h-4 w-4" />
                      {(post.impressions ?? 0).toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="h-4 w-4" />
                      {(post.likes ?? 0).toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Repeat2 className="h-4 w-4" />
                      {(post.retweets ?? 0).toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-4 w-4" />
                      {(post.replies ?? 0).toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Bookmark className="h-4 w-4" />
                      {(post.bookmarks ?? 0).toLocaleString()}
                    </span>
                  </div>
                )}
                {error && (
                  <div className="mt-2 p-2 rounded bg-red-50 text-red-600 text-sm">
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
                    className="text-rose-600 hover:text-rose-700"
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
                    className="text-amber-600 hover:text-amber-700"
                    onClick={() => setShowChangesDialog(true)}
                    disabled={isLoading}
                  >
                    {isLoading && actionType === "changes" ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Edit3 className="h-4 w-4 mr-1" />
                    )}
                    Request Changes
                  </Button>
                  <Button
                    size="sm"
                    className="bg-teal-600 hover:bg-teal-700"
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
                  Mark as Posted
                </Button>
              )}
              {post.tweetUrl && (
                <Button size="sm" variant="outline" asChild>
                  <Link href={post.tweetUrl} target="_blank">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    View
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

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
