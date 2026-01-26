"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { X, Plus, Tag } from "lucide-react";

interface KOLTag {
  id: string;
  name: string;
  color: string;
}

interface TelegramChat {
  id: string;
  telegramChatId: string;
  title: string | null;
}

interface KOLFormProps {
  kol?: {
    id: string;
    name: string;
    twitterHandle: string;
    telegramUsername: string | null;
    telegramGroupId: string | null;
    email: string | null;
    tier: string;
    status: string;
    ratePerPost: number | null;
    ratePerThread: number | null;
    ratePerRetweet: number | null;
    ratePerSpace: number | null;
    walletAddress: string | null;
    paymentNotes: string | null;
    notes: string | null;
    tags?: KOLTag[];
  };
  telegramChats?: TelegramChat[];
  open: boolean;
  onClose: () => void;
}

const TAG_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#22c55e", "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6",
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
];

export function KOLForm({ kol, telegramChats = [], open, onClose }: KOLFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [availableTags, setAvailableTags] = useState<KOLTag[]>([]);
  const [selectedTags, setSelectedTags] = useState<KOLTag[]>(kol?.tags || []);
  const [showNewTag, setShowNewTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);

  const [formData, setFormData] = useState({
    name: kol?.name || "",
    twitterHandle: kol?.twitterHandle || "",
    telegramUsername: kol?.telegramUsername || "",
    telegramGroupId: kol?.telegramGroupId || "",
    email: kol?.email || "",
    tier: kol?.tier || "SMALL",
    status: kol?.status || "ACTIVE",
    ratePerPost: kol?.ratePerPost ? kol.ratePerPost / 100 : "",
    ratePerThread: kol?.ratePerThread ? kol.ratePerThread / 100 : "",
    ratePerRetweet: kol?.ratePerRetweet ? kol.ratePerRetweet / 100 : "",
    ratePerSpace: kol?.ratePerSpace ? kol.ratePerSpace / 100 : "",
    walletAddress: kol?.walletAddress || "",
    paymentNotes: kol?.paymentNotes || "",
    notes: kol?.notes || "",
  });

  // Reset selected tags when dialog opens with new KOL data
  useEffect(() => {
    if (open) {
      const tagsToSet = kol?.tags || [];
      // Use requestAnimationFrame to defer setState
      requestAnimationFrame(() => {
        setSelectedTags(tagsToSet);
      });
    }
  }, [open, kol?.tags]);

  // Load available tags when dialog opens
  useEffect(() => {
    const loadTags = async () => {
      try {
        const response = await fetch("/api/tags");
        if (response.ok) {
          const data = await response.json();
          setAvailableTags(data);
        }
      } catch (error) {
        console.error("Failed to fetch tags:", error);
      }
    };

    if (open) {
      loadTags();
    }
  }, [open]);

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    try {
      const response = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTagName, color: newTagColor }),
      });

      if (response.ok) {
        const tag = await response.json();
        setAvailableTags([...availableTags, tag]);
        setSelectedTags([...selectedTags, tag]);
        setNewTagName("");
        setShowNewTag(false);
      }
    } catch (error) {
      console.error("Failed to create tag:", error);
    }
  };

  const toggleTag = (tag: KOLTag) => {
    if (selectedTags.find((t) => t.id === tag.id)) {
      setSelectedTags(selectedTags.filter((t) => t.id !== tag.id));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate required telegram group
    if (!formData.telegramGroupId) {
      setError("Telegram group is required");
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        ...formData,
        telegramGroupId: formData.telegramGroupId || undefined,
        ratePerPost: formData.ratePerPost ? Math.round(Number(formData.ratePerPost) * 100) : undefined,
        ratePerThread: formData.ratePerThread ? Math.round(Number(formData.ratePerThread) * 100) : undefined,
        ratePerRetweet: formData.ratePerRetweet ? Math.round(Number(formData.ratePerRetweet) * 100) : undefined,
        ratePerSpace: formData.ratePerSpace ? Math.round(Number(formData.ratePerSpace) * 100) : undefined,
        tagIds: selectedTags.map((t) => t.id),
      };

      const url = kol ? `/api/kols/${kol.id}` : "/api/kols";
      const method = kol ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to save KOL");
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
      onClose();
    } catch {
      setError("An error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{kol ? "Edit KOL" : "Add New KOL"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 overflow-y-auto flex-1 pr-2">
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-medium">Basic Information</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="twitterHandle">X Handle *</Label>
                <Input
                  id="twitterHandle"
                  value={formData.twitterHandle}
                  onChange={(e) => setFormData({ ...formData, twitterHandle: e.target.value })}
                  placeholder="@handle"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telegramUsername">Telegram Username</Label>
                <Input
                  id="telegramUsername"
                  value={formData.telegramUsername}
                  onChange={(e) => setFormData({ ...formData, telegramUsername: e.target.value })}
                  placeholder="@telegram"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telegramGroupId">Telegram Group *</Label>
                <Select
                  value={formData.telegramGroupId || ""}
                  onValueChange={(value) => setFormData({ ...formData, telegramGroupId: value })}
                >
                  <SelectTrigger id="telegramGroupId">
                    <SelectValue placeholder="Select Telegram group" />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    {telegramChats.length === 0 ? (
                      <SelectItem value="" disabled>
                        No groups available
                      </SelectItem>
                    ) : (
                      telegramChats.map((chat) => (
                        <SelectItem key={chat.id} value={chat.telegramChatId}>
                          {chat.title || `Chat ${chat.telegramChatId}`}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Group where KOL will receive review feedback
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="kol@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tier">Tier *</Label>
                <Select
                  value={formData.tier}
                  onValueChange={(value) => setFormData({ ...formData, tier: value })}
                >
                  <SelectTrigger id="tier">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SMALL">Small (1-10K)</SelectItem>
                    <SelectItem value="MID">Mid (10K-20K)</SelectItem>
                    <SelectItem value="LARGE">Large (20K-75K)</SelectItem>
                    <SelectItem value="MACRO">Macro (75K+)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="BLACKLISTED">Blacklisted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Tags</h3>
              <Popover open={showNewTag} onOpenChange={setShowNewTag}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    New Tag
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Tag Name</Label>
                      <Input
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        placeholder="e.g., DeFi Expert"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Color</Label>
                      <div className="flex flex-wrap gap-2">
                        {TAG_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            className={`w-6 h-6 rounded-full transition-transform ${
                              newTagColor === color ? "ring-2 ring-offset-2 ring-primary scale-110" : ""
                            }`}
                            style={{ backgroundColor: color }}
                            onClick={() => setNewTagColor(color)}
                          />
                        ))}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="w-full"
                      onClick={handleCreateTag}
                      disabled={!newTagName.trim()}
                    >
                      Create Tag
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Selected Tags */}
            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedTags.map((tag) => (
                  <Badge
                    key={tag.id}
                    style={{ backgroundColor: tag.color }}
                    className="text-white"
                  >
                    {tag.name}
                    <button
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className="ml-1 hover:bg-white/20 rounded-full"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Available Tags */}
            {availableTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {availableTags
                  .filter((tag) => !selectedTags.find((t) => t.id === tag.id))
                  .map((tag) => (
                    <Badge
                      key={tag.id}
                      variant="outline"
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => toggleTag(tag)}
                    >
                      <Tag className="h-3 w-3 mr-1" style={{ color: tag.color }} />
                      {tag.name}
                    </Badge>
                  ))}
              </div>
            )}
          </div>

          {/* Rates */}
          <div className="space-y-4">
            <h3 className="font-medium">Rates (USD)</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ratePerPost">Rate per Post</Label>
                <Input
                  id="ratePerPost"
                  type="number"
                  step="0.01"
                  value={formData.ratePerPost}
                  onChange={(e) => setFormData({ ...formData, ratePerPost: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ratePerThread">Rate per Thread</Label>
                <Input
                  id="ratePerThread"
                  type="number"
                  step="0.01"
                  value={formData.ratePerThread}
                  onChange={(e) => setFormData({ ...formData, ratePerThread: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ratePerRetweet">Rate per Repost</Label>
                <Input
                  id="ratePerRetweet"
                  type="number"
                  step="0.01"
                  value={formData.ratePerRetweet}
                  onChange={(e) => setFormData({ ...formData, ratePerRetweet: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ratePerSpace">Rate per Space</Label>
                <Input
                  id="ratePerSpace"
                  type="number"
                  step="0.01"
                  value={formData.ratePerSpace}
                  onChange={(e) => setFormData({ ...formData, ratePerSpace: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* Payment Info */}
          <div className="space-y-4">
            <h3 className="font-medium">Payment Information</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="walletAddress">Wallet Address</Label>
                <Input
                  id="walletAddress"
                  value={formData.walletAddress}
                  onChange={(e) => setFormData({ ...formData, walletAddress: e.target.value })}
                  placeholder="0x..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentNotes">Payment Notes</Label>
                <Textarea
                  id="paymentNotes"
                  value={formData.paymentNotes}
                  onChange={(e) => setFormData({ ...formData, paymentNotes: e.target.value })}
                  placeholder="Preferred payment method, network, etc."
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Internal Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional notes about this KOL..."
              rows={3}
            />
          </div>
        </form>

        {/* Actions - Fixed at bottom */}
        <div className="flex justify-end gap-3 pt-4 border-t flex-shrink-0 mt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} onClick={handleSubmit}>
            {isLoading ? "Saving..." : kol ? "Save Changes" : "Add KOL"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
