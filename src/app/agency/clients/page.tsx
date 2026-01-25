"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Target,
  Copy,
  Check,
  Pencil,
  Trash2,
  MoreVertical,
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

interface Campaign {
  id: string;
  name: string;
  status: string;
}

interface ClientUser {
  id: string;
  email: string;
  name: string | null;
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
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    password: string;
    organizationName: string;
    campaignName: string;
  } | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    organizationName: "",
    campaignId: "",
  });

  // Edit state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editFormData, setEditFormData] = useState({
    organizationName: "",
    userName: "",
    userEmail: "",
    newPassword: "",
  });
  const [updating, setUpdating] = useState(false);

  // Delete state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchClients();
    fetchCampaigns();
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
        // Filter to campaigns without a client assigned
        setCampaigns(data.filter((c: Campaign & { clientId?: string | null }) => !c.clientId));
      }
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
    }
  };

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, password });
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

      // Store credentials to show in dialog
      setCreatedCredentials({
        email: formData.email,
        password: formData.password,
        organizationName: formData.organizationName,
        campaignName: data.campaign.name,
      });

      // Reset form
      setFormData({
        name: "",
        email: "",
        password: "",
        organizationName: "",
        campaignId: "",
      });

      setShowCreateDialog(false);
      setShowCredentialsDialog(true);

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
      newPassword: "",
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
      case "COMPLETED":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "DRAFT":
        return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400";
      default:
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Client Accounts</h1>
          <p className="text-muted-foreground">
            Create and manage client portal access
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Client Account
        </Button>
      </div>

      {/* Info Banner */}
      <div className="bg-muted/50 border rounded-lg p-4">
        <p className="text-sm text-muted-foreground">
          Client accounts provide access to the client portal where they can view their assigned campaign&apos;s progress, posts, and analytics. Each client can only see their specific campaign.
        </p>
      </div>

      {/* Clients List */}
      {clients.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Client Accounts</h3>
          <p className="text-muted-foreground mb-4">
            Create your first client account to give them access to their campaign.
          </p>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Client Account
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {clients.map((client) => (
            <div
              key={client.id}
              className="bg-card rounded-lg border p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{client.name}</h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      {client.members[0] && (
                        <>
                          <span className="flex items-center gap-1">
                            <User className="h-3.5 w-3.5" />
                            {client.members[0].user.name || "No name"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Mail className="h-3.5 w-3.5" />
                            {client.members[0].user.email}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="text-right">
                    {client.clientCampaigns.map((campaign) => (
                      <div key={campaign.id} className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{campaign.name}</span>
                        <Badge className={getStatusColor(campaign.status)}>
                          {campaign.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditClick(client)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDeleteClick(client)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))}
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
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password *</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={generatePassword}
                >
                  Generate
                </Button>
              </div>
              <Input
                id="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                placeholder="Enter or generate password"
                required
                minLength={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="campaignId">Assign to Campaign *</Label>
              {campaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No unassigned campaigns available. Create a campaign first.
                </p>
              ) : (
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
                    {campaigns.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                disabled={creating || campaigns.length === 0}
              >
                {creating ? "Creating..." : "Create Account"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Credentials Dialog */}
      <Dialog open={showCredentialsDialog} onOpenChange={setShowCredentialsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Client Account Created</DialogTitle>
            <DialogDescription>
              Share these credentials with the client. The password cannot be retrieved later.
            </DialogDescription>
          </DialogHeader>

          {createdCredentials && (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Organization</p>
                    <p className="font-medium">{createdCredentials.organizationName}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Campaign</p>
                    <p className="font-medium">{createdCredentials.campaignName}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{createdCredentials.email}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(createdCredentials.email, "email")}
                  >
                    {copiedField === "email" ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Password</p>
                    <p className="font-mono font-medium">{createdCredentials.password}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(createdCredentials.password, "password")}
                  >
                    {copiedField === "password" ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Make sure to save these credentials. The password cannot be viewed again after closing this dialog.
                </p>
              </div>

              <Button
                className="w-full"
                onClick={() => setShowCredentialsDialog(false)}
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
              Update client details. Leave password blank to keep the current password.
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="editPassword">New Password (optional)</Label>
              <Input
                id="editPassword"
                type="password"
                value={editFormData.newPassword}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, newPassword: e.target.value })
                }
                placeholder="Leave blank to keep current"
              />
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
    </div>
  );
}
