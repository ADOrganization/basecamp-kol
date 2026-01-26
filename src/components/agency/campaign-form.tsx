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
import { Plus, X, Mail, Users } from "lucide-react";

interface ClientAccessUser {
  email: string;
  name?: string;
}

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
    clientUsers?: ClientAccessUser[];
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

  // Client access state
  const [clientUsers, setClientUsers] = useState<ClientAccessUser[]>(
    campaign?.clientUsers || []
  );
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientName, setNewClientName] = useState("");

  const addClientUser = () => {
    if (!newClientEmail.trim()) return;

    // Check for duplicate
    if (clientUsers.some(u => u.email.toLowerCase() === newClientEmail.toLowerCase().trim())) {
      setError("This email has already been added");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newClientEmail.trim())) {
      setError("Please enter a valid email address");
      return;
    }

    setClientUsers([...clientUsers, {
      email: newClientEmail.trim().toLowerCase(),
      name: newClientName.trim() || undefined
    }]);
    setNewClientEmail("");
    setNewClientName("");
    setError("");
  };

  const removeClientUser = (email: string) => {
    setClientUsers(clientUsers.filter(u => u.email !== email));
  };

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
        clientUsers: clientUsers.length > 0 ? clientUsers : undefined,
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

            {/* Client Portal Access */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label className="text-base font-medium">Client Portal Access</Label>
                  <p className="text-sm text-muted-foreground">
                    Generate login credentials for clients to view campaign progress
                  </p>
                </div>
              </div>

              {/* Added client users */}
              {clientUsers.length > 0 && (
                <div className="space-y-2">
                  {clientUsers.map((user) => (
                    <div
                      key={user.email}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-indigo-500/10 flex items-center justify-center">
                          <Mail className="h-4 w-4 text-indigo-600" />
                        </div>
                        <div>
                          {user.name && (
                            <p className="font-medium text-sm">{user.name}</p>
                          )}
                          <p className={user.name ? "text-xs text-muted-foreground" : "text-sm"}>
                            {user.email}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeClientUser(user.email)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new client user */}
              <div className="space-y-3 p-4 rounded-lg border border-dashed">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="client-email" className="text-xs">Email Address *</Label>
                    <Input
                      id="client-email"
                      type="email"
                      placeholder="client@company.com"
                      value={newClientEmail}
                      onChange={(e) => setNewClientEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addClientUser();
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="client-name" className="text-xs">Name (optional)</Label>
                    <Input
                      id="client-name"
                      placeholder="John Doe"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addClientUser();
                        }
                      }}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addClientUser}
                  disabled={!newClientEmail.trim()}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Client User
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                {clientUsers.length === 0
                  ? "No client users added. Add emails to generate login credentials."
                  : `${clientUsers.length} client user${clientUsers.length !== 1 ? "s" : ""} will receive magic link login credentials via email.`}
              </p>
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
