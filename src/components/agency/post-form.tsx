"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Loader2 } from "lucide-react";

interface KOL {
  id: string;
  name: string;
  twitterHandle: string;
}

interface PostFormProps {
  campaignId: string;
  kols: KOL[];
  open: boolean;
  onClose: () => void;
}

export function PostForm({ campaignId, kols, open, onClose }: PostFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    kolId: "",
    type: "POST",
    content: "",
    tweetUrl: "",
    status: "DRAFT",
    scheduledFor: "",
  });

  const handleSubmit = async () => {
    if (!formData.kolId || !formData.content) return;
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          kolId: formData.kolId,
          type: formData.type,
          content: formData.content,
          tweetUrl: formData.tweetUrl || undefined,
          status: formData.status,
          scheduledFor: formData.scheduledFor || undefined,
        }),
      });

      if (response.ok) {
        setFormData({
          kolId: "",
          type: "POST",
          content: "",
          tweetUrl: "",
          status: "DRAFT",
          scheduledFor: "",
        });
        onClose();
      }
    } catch (error) {
      console.error("Failed to create post:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Post</DialogTitle>
          <DialogDescription>
            Add a new post for this campaign. It will need approval before publishing.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
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
                  <SelectItem value="RETWEET">Retweet</SelectItem>
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
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Content *</Label>
            <Textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Enter the post content..."
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">
              {formData.content.length} / 280 characters
            </p>
          </div>

          <div className="space-y-2">
            <Label>Tweet URL (optional)</Label>
            <Input
              value={formData.tweetUrl}
              onChange={(e) => setFormData({ ...formData, tweetUrl: e.target.value })}
              placeholder="https://twitter.com/..."
            />
            <p className="text-xs text-muted-foreground">
              Add the URL if the post is already live
            </p>
          </div>

          <div className="space-y-2">
            <Label>Scheduled For (optional)</Label>
            <Input
              type="datetime-local"
              value={formData.scheduledFor}
              onChange={(e) => setFormData({ ...formData, scheduledFor: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!formData.kolId || !formData.content || isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Create Post
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
