"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Loader2, ChevronDown, ChevronUp, Hash, Eye, ThumbsUp, Repeat2, MessageCircle } from "lucide-react";

interface KOL {
  id: string;
  name: string;
  twitterHandle: string;
}

interface PostFormProps {
  campaignId: string;
  campaignKeywords?: string[];
  kols: KOL[];
  open: boolean;
  onClose: () => void;
}

// Helper to extract tweet ID from URL
function extractTweetId(url: string): string | null {
  const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
  return match ? match[1] : null;
}

// Helper to find keyword matches
function findKeywordMatches(content: string, keywords: string[]): string[] {
  if (!content || !keywords || keywords.length === 0) return [];
  const lowerContent = content.toLowerCase();
  return keywords.filter(kw => lowerContent.includes(kw.toLowerCase()));
}

export function PostForm({ campaignId, campaignKeywords = [], kols, open, onClose }: PostFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);
  const [formData, setFormData] = useState({
    kolId: "",
    type: "POST",
    content: "",
    tweetUrl: "",
    status: "DRAFT",
    scheduledFor: "",
    postedAt: "",
    // Metrics
    impressions: "",
    likes: "",
    retweets: "",
    replies: "",
    quotes: "",
    bookmarks: "",
    clicks: "",
  });

  // Calculate matched keywords
  const matchedKeywords = useMemo(() => {
    return findKeywordMatches(formData.content, campaignKeywords);
  }, [formData.content, campaignKeywords]);

  // Auto-expand metrics if tweet URL is provided
  const handleTweetUrlChange = (url: string) => {
    setFormData({ ...formData, tweetUrl: url });
    if (url && extractTweetId(url)) {
      setShowMetrics(true);
    }
  };

  const handleSubmit = async () => {
    if (!formData.kolId) return;
    setIsSubmitting(true);

    try {
      const hasMetrics = formData.impressions || formData.likes || formData.retweets;

      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          kolId: formData.kolId,
          type: formData.type,
          content: formData.content || undefined,
          tweetUrl: formData.tweetUrl || undefined,
          status: formData.tweetUrl && hasMetrics ? "POSTED" : formData.status,
          scheduledFor: formData.scheduledFor || undefined,
          postedAt: formData.postedAt || undefined,
          impressions: formData.impressions ? Number(formData.impressions) : undefined,
          likes: formData.likes ? Number(formData.likes) : undefined,
          retweets: formData.retweets ? Number(formData.retweets) : undefined,
          replies: formData.replies ? Number(formData.replies) : undefined,
          quotes: formData.quotes ? Number(formData.quotes) : undefined,
          bookmarks: formData.bookmarks ? Number(formData.bookmarks) : undefined,
          clicks: formData.clicks ? Number(formData.clicks) : undefined,
        }),
      });

      if (response.ok) {
        resetForm();
        onClose();
      }
    } catch (error) {
      console.error("Failed to create post:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      kolId: "",
      type: "POST",
      content: "",
      tweetUrl: "",
      status: "DRAFT",
      scheduledFor: "",
      postedAt: "",
      impressions: "",
      likes: "",
      retweets: "",
      replies: "",
      quotes: "",
      bookmarks: "",
      clicks: "",
    });
    setShowMetrics(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        resetForm();
        onClose();
      }
    }}>
      <DialogContent className="max-w-lg flex flex-col max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>Add Post</DialogTitle>
          <DialogDescription>
            Track a new post for this campaign. Paste the tweet URL and metrics if already posted.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="space-y-2">
            <Label>KOL *</Label>
            <Select
              value={formData.kolId}
              onValueChange={(value) => setFormData({ ...formData, kolId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select KOL" />
              </SelectTrigger>
              <SelectContent>
                {kols.map((kol) => (
                  <SelectItem key={kol.id} value={kol.id}>
                    {kol.name} (@{kol.twitterHandle})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="POST">Post</SelectItem>
                  <SelectItem value="THREAD">Thread</SelectItem>
                  <SelectItem value="RETWEET">Repost</SelectItem>
                  <SelectItem value="QUOTE">Quote Tweet</SelectItem>
                  <SelectItem value="SPACE">Space</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="PENDING_APPROVAL">Submit for Approval</SelectItem>
                  <SelectItem value="POSTED">Already Posted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tweet URL</Label>
            <Input
              value={formData.tweetUrl}
              onChange={(e) => handleTweetUrlChange(e.target.value)}
              placeholder="https://twitter.com/user/status/123..."
            />
            <p className="text-xs text-muted-foreground">
              Paste the tweet URL if already posted
            </p>
          </div>

          <div className="space-y-2">
            <Label>Content</Label>
            <Textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Enter or paste the post content..."
              rows={4}
              className="resize-none"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {formData.content.length} / 280 characters
              </p>
              {campaignKeywords.length > 0 && matchedKeywords.length > 0 && (
                <div className="flex items-center gap-1">
                  <Hash className="h-3 w-3 text-green-600" />
                  <div className="flex gap-1">
                    {matchedKeywords.map((kw) => (
                      <Badge key={kw} variant="secondary" className="text-xs bg-green-100 text-green-700">
                        {kw}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Metrics Section */}
          <Collapsible open={showMetrics} onOpenChange={setShowMetrics}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Post Metrics (if already posted)
                </span>
                {showMetrics ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Enter metrics from X Analytics or the post detail view.
                </p>

                <div className="space-y-2">
                  <Label>Date Posted</Label>
                  <Input
                    type="date"
                    value={formData.postedAt}
                    onChange={(e) => setFormData({ ...formData, postedAt: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      Impressions
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.impressions}
                      onChange={(e) => setFormData({ ...formData, impressions: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1">
                      <ThumbsUp className="h-3 w-3" />
                      Likes
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.likes}
                      onChange={(e) => setFormData({ ...formData, likes: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1">
                      <Repeat2 className="h-3 w-3" />
                      Retweets
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.retweets}
                      onChange={(e) => setFormData({ ...formData, retweets: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" />
                      Replies
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.replies}
                      onChange={(e) => setFormData({ ...formData, replies: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Quotes</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.quotes}
                      onChange={(e) => setFormData({ ...formData, quotes: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Bookmarks</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.bookmarks}
                      onChange={(e) => setFormData({ ...formData, bookmarks: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="space-y-2">
            <Label>Scheduled For (optional)</Label>
            <Input
              type="datetime-local"
              value={formData.scheduledFor}
              onChange={(e) => setFormData({ ...formData, scheduledFor: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter className="px-6 py-4 border-t shrink-0 bg-background">
          <Button variant="outline" onClick={() => {
            resetForm();
            onClose();
          }}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!formData.kolId || isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Add Post
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
