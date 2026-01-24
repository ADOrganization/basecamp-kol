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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { KeywordsInput } from "./keywords-input";
import { ChevronDown, ChevronUp, UserPlus, Check, Copy, Eye, EyeOff } from "lucide-react";

interface CampaignFormProps {
  campaign?: {
    id: string;
    name: string;
    description: string | null;
    clientId: string | null;
    projectTwitterHandle: string | null;
    keywords: string[];
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

function generatePassword(length: number = 12): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export function CampaignForm({ campaign, clients = [], open, onClose }: CampaignFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    name: campaign?.name || "",
    description: campaign?.description || "",
    clientId: campaign?.clientId || "",
    projectTwitterHandle: campaign?.projectTwitterHandle || "",
    keywords: Array.isArray(campaign?.keywords) ? campaign.keywords : [],
    totalBudget: campaign?.totalBudget ? campaign.totalBudget / 100 : "",
    status: campaign?.status || "DRAFT",
    startDate: campaign?.startDate ? campaign.startDate.split("T")[0] : "",
    endDate: campaign?.endDate ? campaign.endDate.split("T")[0] : "",
    kpiImpressions: campaign?.kpis?.impressions || "",
    kpiEngagement: campaign?.kpis?.engagement || "",
    kpiClicks: campaign?.kpis?.clicks || "",
    kpiFollowers: campaign?.kpis?.followers || "",
  });

  // Client creation state
  const [showClientCreation, setShowClientCreation] = useState(false);
  const [clientData, setClientData] = useState({
    name: "",
    email: "",
    password: "",
    organizationName: "",
  });
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [clientCreated, setClientCreated] = useState(false);
  const [createdClientInfo, setCreatedClientInfo] = useState<{
    email: string;
    password: string;
    organizationName: string;
  } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleGeneratePassword = () => {
    setClientData({ ...clientData, password: generatePassword() });
  };

  const handleCopy = async (field: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const payload = {
        name: formData.name,
        description: formData.description || undefined,
        clientId: formData.clientId || undefined,
        projectTwitterHandle: formData.projectTwitterHandle || undefined,
        keywords: formData.keywords,
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

      // If client creation data is filled, create the client account
      if (!campaign && showClientCreation && clientData.email && clientData.password && clientData.organizationName) {
        setIsCreatingClient(true);
        const clientResponse = await fetch(`/api/campaigns/${data.id}/client`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(clientData),
        });

        if (clientResponse.ok) {
          setClientCreated(true);
          setCreatedClientInfo({
            email: clientData.email,
            password: clientData.password,
            organizationName: clientData.organizationName,
          });
          setIsCreatingClient(false);
          // Don't close yet - show success with credentials
          setIsLoading(false);
          return;
        } else {
          const clientError = await clientResponse.json();
          setError(clientError.error || "Failed to create client account");
          setIsCreatingClient(false);
          setIsLoading(false);
          return;
        }
      }

      onClose();
    } catch {
      setError("An error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setClientCreated(false);
    setCreatedClientInfo(null);
    setShowClientCreation(false);
    setClientData({ name: "", email: "", password: "", organizationName: "" });
    onClose();
  };

  // If client was created, show success with credentials
  if (clientCreated && createdClientInfo) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Check className="h-5 w-5" />
              Client Account Created
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The campaign and client account have been created. Share these credentials with your client:
            </p>

            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Organization</p>
                <div className="flex items-center justify-between">
                  <p className="font-medium">{createdClientInfo.organizationName}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleCopy("org", createdClientInfo.organizationName)}
                  >
                    {copiedField === "org" ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Email</p>
                <div className="flex items-center justify-between">
                  <p className="font-medium">{createdClientInfo.email}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleCopy("email", createdClientInfo.email)}
                  >
                    {copiedField === "email" ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Password</p>
                <div className="flex items-center justify-between">
                  <p className="font-mono text-sm">{createdClientInfo.password}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleCopy("password", createdClientInfo.password)}
                  >
                    {copiedField === "password" ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Make sure to save these credentials. The password cannot be retrieved after closing this dialog.
            </p>

            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

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
              <Label htmlFor="projectTwitterHandle">Project Twitter Handle</Label>
              <Input
                id="projectTwitterHandle"
                value={formData.projectTwitterHandle}
                onChange={(e) => setFormData({ ...formData, projectTwitterHandle: e.target.value })}
                placeholder="@ProjectHandle"
              />
              <p className="text-xs text-muted-foreground">
                The Twitter/X handle for the project being promoted
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="client">Client</Label>
                <Select
                  value={formData.clientId || "none"}
                  onValueChange={(value) => setFormData({ ...formData, clientId: value === "none" ? "" : value })}
                >
                  <SelectTrigger id="client">
                    <SelectValue placeholder="Select client (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No client</SelectItem>
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

          {/* Inline Client Creation (only for new campaigns) */}
          {!campaign && !formData.clientId && (
            <Collapsible open={showClientCreation} onOpenChange={setShowClientCreation}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Create New Client Account
                  </span>
                  {showClientCreation ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Create a client account that will be linked to this campaign. They can login to view campaign progress.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Client Name *</Label>
                      <Input
                        value={clientData.name}
                        onChange={(e) => setClientData({ ...clientData, name: e.target.value })}
                        placeholder="John Smith"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Organization Name *</Label>
                      <Input
                        value={clientData.organizationName}
                        onChange={(e) => setClientData({ ...clientData, organizationName: e.target.value })}
                        placeholder="Acme Inc"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email *</Label>
                      <Input
                        type="email"
                        value={clientData.email}
                        onChange={(e) => setClientData({ ...clientData, email: e.target.value })}
                        placeholder="client@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Password *</Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            type={showPassword ? "text" : "password"}
                            value={clientData.password}
                            onChange={(e) => setClientData({ ...clientData, password: e.target.value })}
                            placeholder="Min 6 characters"
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleGeneratePassword}
                        >
                          Generate
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || isCreatingClient}>
              {isLoading ? "Saving..." : isCreatingClient ? "Creating Client..." : campaign ? "Save Changes" : "Create Campaign"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
