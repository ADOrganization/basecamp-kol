"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { KeywordsInput } from "./keywords-input";

interface CampaignFormProps {
  campaign?: {
    id: string;
    name: string;
    description: string | null;
    projectTwitterHandle: string | null;
    clientTelegramChatId: string | null;
    keywords: string[];
    totalBudget: number;
    startDate: string | null;
    endDate: string | null;
  };
  telegramChats?: { id: string; telegramChatId: string; title: string | null }[];
  open: boolean;
  onClose: () => void;
}

export function CampaignForm({ campaign, telegramChats = [], open, onClose }: CampaignFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    name: campaign?.name || "",
    description: campaign?.description || "",
    projectTwitterHandle: campaign?.projectTwitterHandle || "",
    clientTelegramChatId: campaign?.clientTelegramChatId || "",
    keywords: Array.isArray(campaign?.keywords) ? campaign.keywords : [],
    totalBudget: campaign?.totalBudget ? campaign.totalBudget / 100 : "",
    startDate: campaign?.startDate ? campaign.startDate.split("T")[0] : "",
    endDate: campaign?.endDate ? campaign.endDate.split("T")[0] : "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate required fields
    if (!formData.projectTwitterHandle.trim()) {
      setError("Project X handle is required");
      return;
    }

    if (!formData.clientTelegramChatId) {
      setError("Client Telegram group is required");
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        name: formData.name,
        description: formData.description || undefined,
        projectTwitterHandle: formData.projectTwitterHandle,
        clientTelegramChatId: formData.clientTelegramChatId,
        keywords: formData.keywords,
        totalBudget: formData.totalBudget ? Math.round(Number(formData.totalBudget) * 100) : 0,
        status: "ACTIVE", // Default to ACTIVE
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
      };

      const url = campaign ? `/api/campaigns/${campaign.id}` : "/api/campaigns";
      const method = campaign ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to save campaign");
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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{campaign ? "Edit Campaign" : "Create New Campaign"}</DialogTitle>
        </DialogHeader>

        <form id="campaign-form" onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Campaign Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Q1 Token Launch"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="projectTwitterHandle">Project X Handle *</Label>
                <Input
                  id="projectTwitterHandle"
                  value={formData.projectTwitterHandle}
                  onChange={(e) => setFormData({ ...formData, projectTwitterHandle: e.target.value })}
                  placeholder="@ProjectHandle"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  The X handle for the project being promoted
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientTelegramChatId">Client Telegram Group *</Label>
                <Select
                  value={formData.clientTelegramChatId || ""}
                  onValueChange={(value) => setFormData({ ...formData, clientTelegramChatId: value })}
                  required
                >
                  <SelectTrigger id="clientTelegramChatId">
                    <SelectValue placeholder="Select Telegram group" />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    {telegramChats.length === 0 ? (
                      <SelectItem value="" disabled>
                        No groups available - add bot to a group first
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
                  Telegram group where post notifications will be sent
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Campaign objectives and details..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Keywords for Tracking</Label>
                <KeywordsInput
                  value={formData.keywords}
                  onChange={(keywords) => setFormData({ ...formData, keywords })}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="budget">Total Budget (USD)</Label>
                  <Input
                    id="budget"
                    type="number"
                    step="0.01"
                    value={formData.totalBudget}
                    onChange={(e) => setFormData({ ...formData, totalBudget: e.target.value })}
                    placeholder="10000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
              </div>
            </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : campaign ? "Save Changes" : "Create Campaign"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
