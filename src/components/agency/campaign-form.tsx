"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

interface CampaignFormProps {
  campaign?: {
    id: string;
    name: string;
    description: string | null;
    clientId: string | null;
    totalBudget: number;
    status: string;
    startDate: string | null;
    endDate: string | null;
    kpis: {
      impressions?: number;
      engagement?: number;
      clicks?: number;
      followers?: number;
    } | null;
  };
  clients?: { id: string; name: string }[];
  open: boolean;
  onClose: () => void;
}

export function CampaignForm({ campaign, clients = [], open, onClose }: CampaignFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    name: campaign?.name || "",
    description: campaign?.description || "",
    clientId: campaign?.clientId || "",
    totalBudget: campaign?.totalBudget ? campaign.totalBudget / 100 : "",
    status: campaign?.status || "DRAFT",
    startDate: campaign?.startDate ? campaign.startDate.split("T")[0] : "",
    endDate: campaign?.endDate ? campaign.endDate.split("T")[0] : "",
    kpiImpressions: campaign?.kpis?.impressions || "",
    kpiEngagement: campaign?.kpis?.engagement || "",
    kpiClicks: campaign?.kpis?.clicks || "",
    kpiFollowers: campaign?.kpis?.followers || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const payload = {
        name: formData.name,
        description: formData.description || undefined,
        clientId: formData.clientId || undefined,
        totalBudget: formData.totalBudget ? Math.round(Number(formData.totalBudget) * 100) : 0,
        status: formData.status,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        kpis: {
          impressions: formData.kpiImpressions ? Number(formData.kpiImpressions) : undefined,
          engagement: formData.kpiEngagement ? Number(formData.kpiEngagement) : undefined,
          clicks: formData.kpiClicks ? Number(formData.kpiClicks) : undefined,
          followers: formData.kpiFollowers ? Number(formData.kpiFollowers) : undefined,
        },
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

      router.refresh();
      onClose();
    } catch {
      setError("An error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{campaign ? "Edit Campaign" : "Create New Campaign"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Basic Info */}
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
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Campaign objectives and details..."
                rows={3}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="client">Client</Label>
                <Select
                  value={formData.clientId}
                  onValueChange={(value) => setFormData({ ...formData, clientId: value })}
                >
                  <SelectTrigger id="client">
                    <SelectValue placeholder="Select client (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No client</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
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
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="PAUSED">Paused</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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

          {/* KPIs */}
          <div className="space-y-4">
            <h3 className="font-medium">Target KPIs (optional)</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="kpiImpressions">Target Impressions</Label>
                <Input
                  id="kpiImpressions"
                  type="number"
                  value={formData.kpiImpressions}
                  onChange={(e) => setFormData({ ...formData, kpiImpressions: e.target.value })}
                  placeholder="1000000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kpiEngagement">Target Engagement Rate (%)</Label>
                <Input
                  id="kpiEngagement"
                  type="number"
                  step="0.01"
                  value={formData.kpiEngagement}
                  onChange={(e) => setFormData({ ...formData, kpiEngagement: e.target.value })}
                  placeholder="5"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kpiClicks">Target Clicks</Label>
                <Input
                  id="kpiClicks"
                  type="number"
                  value={formData.kpiClicks}
                  onChange={(e) => setFormData({ ...formData, kpiClicks: e.target.value })}
                  placeholder="50000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kpiFollowers">Target New Followers</Label>
                <Input
                  id="kpiFollowers"
                  type="number"
                  value={formData.kpiFollowers}
                  onChange={(e) => setFormData({ ...formData, kpiFollowers: e.target.value })}
                  placeholder="10000"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
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
