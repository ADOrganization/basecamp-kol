"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Building2,
  User,
  Mail,
  Copy,
  Check,
  Pencil,
  Trash2,
  MoreVertical,
  Megaphone,
  Search,
  Sparkles,
  Shield,
  Send,
  Clock,
  CheckCircle2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  ACTIVE: { bg: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-500/30" },
  COMPLETED: { bg: "bg-blue-500/10", text: "text-blue-600", border: "border-blue-500/30" },
  DRAFT: { bg: "bg-slate-500/10", text: "text-slate-600", border: "border-slate-500/30" },
  PENDING_APPROVAL: { bg: "bg-amber-500/10", text: "text-amber-600", border: "border-amber-500/30" },
  PAUSED: { bg: "bg-orange-500/10", text: "text-orange-600", border: "border-orange-500/30" },
  CANCELLED: { bg: "bg-rose-500/10", text: "text-rose-600", border: "border-rose-500/30" },
};

interface Campaign {
  id: string;
  name: string;
  status: string;
  clientId?: string | null;
  client?: { id: string; name: string } | null;
}

interface ClientUser {
  id: string;
  email: string;
  name: string | null;
  emailVerified: string | null;
  lastLoginAt: string | null;
}

interface ClientMember {
  user: ClientUser;
}

interface Client {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  members: ClientMember[];
  clientCampaigns: Campaign[];
}

export default function ClientAccountsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [createdClient, setCreatedClient] = useState<{
    email: string;
    organizationName: string;
    campaignName: string;
    emailSent: boolean;
  } | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    organizationName: "",
    campaignId: "",
  });

  // All campaigns (for creating clients - including those with existing clients)
  const [allCampaigns, setAllCampaigns] = useState<Campaign[]>([]);

  // Add Member dialog state
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [addMemberClientId, setAddMemberClientId] = useState<string | null>(null);
  const [addMemberFormData, setAddMemberFormData] = useState({
    name: "",
    email: "",
  });
  const [addingMember, setAddingMember] = useState(false);

  // Edit state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editFormData, setEditFormData] = useState({
    organizationName: "",
    userName: "",
    userEmail: "",
  });
  const [updating, setUpdating] = useState(false);

  // Delete state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Resend state
  const [resendingClientId, setResendingClientId] = useState<string | null>(null);

  useEffect(() => {
    fetchClients();
    fetchCampaigns();
    fetchAllCampaigns();
  }, []);

  const fetchClients = async () => {
    try {
      const response = await fetch("/api/clients");
      if (response.ok) {
        const data = await response.json();
        setClients(data);
      }
    } catch (error) {
      console.error("Failed to fetch clients:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const response = await fetch("/api/campaigns");
      if (response.ok) {
        const data = await response.json();
        // Filter to campaigns without a client assigned (for stats display)
        setCampaigns(data.filter((c: Campaign & { clientId?: string | null }) => !c.clientId));
      }
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
    }
  };

  const fetchAllCampaigns = async () => {
    try {
      const response = await fetch("/api/campaigns");
      if (response.ok) {
        const data = await response.json();
        setAllCampaigns(data);
      }
    } catch (error) {
      console.error("Failed to fetch all campaigns:", error);
    }
  };

  const handleResendLoginLink = async (clientId: string) => {
    setResendingClientId(clientId);
    try {
      const response = await fetch(`/api/clients/${clientId}/resend`, {
        method: "POST",
      });

      const data = await response.json();

      if (response.ok) {
        alert(`Login link sent to ${data.email}`);
      } else {
        alert(data.error || "Failed to send login link");
      }
    } catch (error) {
      console.error("Failed to resend login link:", error);
      alert("Failed to send login link");
    } finally {
      setResendingClientId(null);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setCreating(true);

    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create client");
        setCreating(false);
        return;
      }

      // Store created client info to show in dialog
      setCreatedClient({
        email: formData.email,
        organizationName: formData.organizationName,
        campaignName: data.campaign.name,
        emailSent: data.emailSent,
      });

      // Reset form
      setFormData({
        name: "",
        email: "",
        organizationName: "",
        campaignId: "",
      });

      setShowCreateDialog(false);
      setShowSuccessDialog(true);

      // Refresh data
      fetchClients();
      fetchCampaigns();
      router.refresh();
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleEditClick = (client: Client) => {
    setEditingClient(client);
    setEditFormData({
      organizationName: client.name,
      userName: client.members[0]?.user.name || "",
      userEmail: client.members[0]?.user.email || "",
    });
    setShowEditDialog(true);
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;

    setError("");
    setUpdating(true);

    try {
      const response = await fetch(`/api/clients/${editingClient.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFormData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to update client");
        setUpdating(false);
        return;
      }

      setShowEditDialog(false);
      setEditingClient(null);
      fetchClients();
      router.refresh();
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteClick = (client: Client) => {
    setDeletingClient(client);
    setShowDeleteDialog(true);
  };

  const handleDeleteClient = async () => {
    if (!deletingClient) return;

    setDeleting(true);

    try {
      const response = await fetch(`/api/clients/${deletingClient.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setShowDeleteDialog(false);
        setDeletingClient(null);
        fetchClients();
        fetchCampaigns();
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to delete client:", error);
    } finally {
      setDeleting(false);
    }
  };

  const handleAddMemberClick = (client: Client) => {
    setAddMemberClientId(client.id);
    setAddMemberFormData({ name: "", email: "" });
    setShowAddMemberDialog(true);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addMemberClientId) return;

    setError("");
    setAddingMember(true);

    try {
      const response = await fetch(`/api/clients/${addMemberClientId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addMemberFormData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to add member");
        setAddingMember(false);
        return;
      }

      setShowAddMemberDialog(false);
      setAddMemberClientId(null);
      setAddMemberFormData({ name: "", email: "" });
      fetchClients();
      router.refresh();

      // Show success message
      alert(data.emailSent
        ? `Member added. Login link sent to ${addMemberFormData.email}`
        : `Member added. Email could not be sent - they can request a login link at the login page.`
      );
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setAddingMember(false);
    }
  };

  const [searchQuery, setSearchQuery] = useState("");

  // Filter clients by search
  const filteredClients = useMemo(() => {
    if (!searchQuery) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.members[0]?.user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.members[0]?.user.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [clients, searchQuery]);

  // Calculate stats
  const stats = useMemo(() => {
    const activeCampaigns = clients.filter((c) =>
      c.clientCampaigns.some((campaign) => campaign.status === "ACTIVE")
    ).length;
    return { total: clients.length, active: activeCampaigns };
  }, [clients]);

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-40 bg-muted animate-pulse rounded-lg" />
            <div className="h-4 w-64 bg-muted animate-pulse rounded" />
          </div>
          <div className="h-10 w-44 bg-muted animate-pulse rounded-lg" />
        </div>
        {/* Stats skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
        {/* Cards skeleton */}
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Client Accounts</h1>
          </div>
          <p className="text-muted-foreground">
            Manage client portal access and campaign assignments.
          </p>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 shadow-lg shadow-blue-500/25"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Client Account
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-blue-500" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Total Clients</span>
          </div>
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-muted-foreground">accounts created</p>
        </div>

        <div className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-emerald-500" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Active</span>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{stats.active}</p>
          <p className="text-xs text-muted-foreground">with active campaigns</p>
        </div>

        <div className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Megaphone className="h-4 w-4 text-purple-500" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Available</span>
          </div>
          <p className="text-2xl font-bold">{campaigns.length}</p>
          <p className="text-xs text-muted-foreground">unassigned campaigns</p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="rounded-xl border bg-gradient-to-r from-blue-500/5 to-cyan-500/5 p-4">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
            <Shield className="h-4 w-4 text-blue-500" />
          </div>
          <div>
            <p className="text-sm font-medium">Client Portal Access</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Client accounts provide secure access to the client portal where they can view their campaign&apos;s progress, posts, and analytics. Each client can only see their assigned campaign.
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      {clients.length > 0 && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
          />
        </div>
      )}

      {/* Clients List */}
      {clients.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-xl border">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center mb-4">
            <Building2 className="h-8 w-8 text-blue-500" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Client Accounts</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Create your first client account to give them secure access to their campaign dashboard.
          </p>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Client Account
          </Button>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border">
          <p className="text-muted-foreground">No clients match your search.</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setSearchQuery("")}
          >
            Clear Search
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredClients.map((client) => {
            const activeCampaign = client.clientCampaigns.find((c) => c.status === "ACTIVE");

            return (
              <div
                key={client.id}
                className="group bg-card rounded-xl border p-5 hover:shadow-lg hover:border-primary/30 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white font-bold text-lg shadow-lg flex-shrink-0">
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-lg truncate group-hover:text-primary transition-colors">
                        {client.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                        {client.members[0] && (
                          <>
                            <span className="flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5" />
                              {client.members[0].user.name || "No name"}
                              {client.members.length > 1 && (
                                <span className="text-xs text-muted-foreground">
                                  +{client.members.length - 1} more
                                </span>
                              )}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Mail className="h-3.5 w-3.5" />
                              {client.members[0].user.email}
                            </span>
                            {client.members[0].user.emailVerified ? (
                              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 border text-xs gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Active
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30 border text-xs gap-1">
                                <Clock className="h-3 w-3" />
                                Onboarding
                              </Badge>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {client.clientCampaigns.length > 0 ? (
                      <div className="text-right">
                        {client.clientCampaigns.map((campaign) => {
                          const statusStyle = STATUS_STYLES[campaign.status] || STATUS_STYLES.DRAFT;
                          return (
                            <div key={campaign.id} className="flex items-center gap-2">
                              <span className="font-medium text-sm">{campaign.name}</span>
                              <Badge className={cn(statusStyle.bg, statusStyle.text, statusStyle.border, "border text-xs")}>
                                {campaign.status.replace("_", " ")}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground italic">No campaign assigned</span>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleAddMemberClick(client)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Member
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleResendLoginLink(client.id)}
                          disabled={resendingClientId === client.id}
                        >
                          <Send className="h-4 w-4 mr-2" />
                          {resendingClientId === client.id ? "Sending..." : "Resend Login Link"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditClick(client)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(client)}
                          className="text-rose-600 focus:text-rose-600 focus:bg-rose-500/10"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Client Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Client Account</DialogTitle>
            <DialogDescription>
              Set up a new client account with access to a specific campaign.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateClient} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="organizationName">Company/Organization Name *</Label>
              <Input
                id="organizationName"
                value={formData.organizationName}
                onChange={(e) =>
                  setFormData({ ...formData, organizationName: e.target.value })
                }
                placeholder="Acme Corp"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Contact Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="John Doe"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Login Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="client@company.com"
                required
              />
              <p className="text-xs text-muted-foreground">
                A magic link login email will be sent to this address.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="campaignId">Assign to Campaign *</Label>
              {allCampaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No campaigns available. Create a campaign first.
                </p>
              ) : (
                <>
                  <Select
                    value={formData.campaignId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, campaignId: value })
                    }
                  >
                    <SelectTrigger id="campaignId">
                      <SelectValue placeholder="Select a campaign" />
                    </SelectTrigger>
                    <SelectContent>
                      {allCampaigns.map((campaign) => (
                        <SelectItem key={campaign.id} value={campaign.id}>
                          <span className="flex items-center gap-2">
                            {campaign.name}
                            {campaign.client && (
                              <span className="text-xs text-muted-foreground">
                                ({campaign.client.name})
                              </span>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.campaignId && allCampaigns.find(c => c.id === formData.campaignId)?.client && (
                    <p className="text-xs text-muted-foreground">
                      This client will be added alongside the existing client(s) for this campaign.
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creating || allCampaigns.length === 0}
              >
                {creating ? "Creating..." : "Create Account"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Client Account Created</DialogTitle>
            <DialogDescription>
              {createdClient?.emailSent
                ? "A login link has been sent to the client's email."
                : "The account was created but the email could not be sent. You may need to send the login link manually."}
            </DialogDescription>
          </DialogHeader>

          {createdClient && (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Organization</p>
                  <p className="font-medium">{createdClient.organizationName}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Campaign</p>
                  <p className="font-medium">{createdClient.campaignName}</p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{createdClient.email}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(createdClient.email, "email")}
                  >
                    {copiedField === "email" ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {createdClient.emailSent ? (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
                  <p className="text-sm text-emerald-800 dark:text-emerald-200">
                    The client will receive a magic link via email to access their dashboard. No password needed.
                  </p>
                </div>
              ) : (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    Email sending failed. Check RESEND_API_KEY configuration. The client can request a login link at the login page.
                  </p>
                </div>
              )}

              <Button
                className="w-full"
                onClick={() => setShowSuccessDialog(false)}
              >
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Client Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Client Account</DialogTitle>
            <DialogDescription>
              Update client details. Clients use magic link authentication (no passwords).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateClient} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="editOrgName">Company/Organization Name</Label>
              <Input
                id="editOrgName"
                value={editFormData.organizationName}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, organizationName: e.target.value })
                }
                placeholder="Acme Corp"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editUserName">Contact Name</Label>
              <Input
                id="editUserName"
                value={editFormData.userName}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, userName: e.target.value })
                }
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editUserEmail">Login Email</Label>
              <Input
                id="editUserEmail"
                type="email"
                value={editFormData.userEmail}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, userEmail: e.target.value })
                }
                placeholder="client@company.com"
              />
              <p className="text-xs text-muted-foreground">
                The client will use this email to request magic link logins.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditDialog(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updating}>
                {updating ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deletingClient?.name}? This will remove their access
              to the platform. The associated campaign will not be deleted but will become unassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteClient}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Member Dialog */}
      <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>
              Add a new user to this client organization. They will have access to the same campaigns.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddMember} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="memberName">Name *</Label>
              <Input
                id="memberName"
                value={addMemberFormData.name}
                onChange={(e) =>
                  setAddMemberFormData({ ...addMemberFormData, name: e.target.value })
                }
                placeholder="Jane Doe"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="memberEmail">Email *</Label>
              <Input
                id="memberEmail"
                type="email"
                value={addMemberFormData.email}
                onChange={(e) =>
                  setAddMemberFormData({ ...addMemberFormData, email: e.target.value })
                }
                placeholder="jane@company.com"
                required
              />
              <p className="text-xs text-muted-foreground">
                A magic link login email will be sent to this address.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddMemberDialog(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={addingMember}>
                {addingMember ? "Adding..." : "Add Member"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
