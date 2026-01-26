"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  UserPlus,
  Shield,
  ShieldCheck,
  Eye,
  Loader2,
  MoreVertical,
  Copy,
  Check,
  UserX,
  Pencil,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: "SUPER_ADMIN" | "ADMIN" | "VIEWER";
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  twoFactorEnabled: boolean;
}

interface AdminTeamManagementProps {
  currentAdminId: string;
  currentAdminRole: string;
}

const ROLE_LABELS: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  SUPER_ADMIN: { label: "Super Admin", icon: ShieldCheck, color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  ADMIN: { label: "Admin", icon: Shield, color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  VIEWER: { label: "Viewer", icon: Eye, color: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
};

export function AdminTeamManagement({ currentAdminId, currentAdminRole }: AdminTeamManagementProps) {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Invite dialog state
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("ADMIN");
  const [isInviting, setIsInviting] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);

  // Edit dialog state
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete confirmation state
  const [deletingAdmin, setDeletingAdmin] = useState<AdminUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const canManageTeam = currentAdminRole === "SUPER_ADMIN";

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      const response = await fetch("/api/admin/team");
      if (response.ok) {
        const data = await response.json();
        setAdmins(data.admins);
      }
    } catch (err) {
      console.error("Failed to fetch admins:", err);
      setError("Failed to load team members");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail) return;

    setIsInviting(true);
    setError("");
    try {
      const response = await fetch("/api/admin/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          name: inviteName || undefined,
          role: inviteRole,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to invite admin");
      }

      setTempPassword(data.tempPassword);
      await fetchAdmins();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite admin");
    } finally {
      setIsInviting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingAdmin) return;

    setIsUpdating(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/team/${editingAdmin.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          role: editRole,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update admin");
      }

      setEditingAdmin(null);
      await fetchAdmins();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update admin");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingAdmin) return;

    setIsDeleting(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/team/${deletingAdmin.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to remove admin");
      }

      setDeletingAdmin(null);
      await fetchAdmins();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove admin");
    } finally {
      setIsDeleting(false);
    }
  };

  const copyPassword = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    }
  };

  const closeInviteDialog = () => {
    setShowInviteDialog(false);
    setInviteEmail("");
    setInviteName("");
    setInviteRole("ADMIN");
    setTempPassword(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Team Members</h3>
          <p className="text-sm text-muted-foreground">
            {admins.filter(a => a.isActive).length} active member{admins.filter(a => a.isActive).length !== 1 ? "s" : ""}
          </p>
        </div>
        {canManageTeam && (
          <Button onClick={() => setShowInviteDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Member
          </Button>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm">
          {error}
        </div>
      )}

      {/* Team List */}
      <div className="divide-y rounded-lg border">
        {admins.map((admin) => {
          const roleInfo = ROLE_LABELS[admin.role] || ROLE_LABELS.VIEWER;
          const RoleIcon = roleInfo.icon;
          const isCurrentUser = admin.id === currentAdminId;

          return (
            <div
              key={admin.id}
              className={`flex items-center justify-between p-4 ${!admin.isActive ? "opacity-50" : ""}`}
            >
              <div className="flex items-center gap-4">
                <Avatar className="h-10 w-10">
                  {admin.avatarUrl && <AvatarImage src={admin.avatarUrl} />}
                  <AvatarFallback className="bg-indigo-100 text-indigo-600">
                    {admin.name?.charAt(0) || admin.email.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">
                      {admin.name || admin.email}
                      {isCurrentUser && (
                        <span className="text-xs text-muted-foreground ml-2">(You)</span>
                      )}
                    </p>
                    {!admin.isActive && (
                      <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/20">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{admin.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Badge variant="outline" className={roleInfo.color}>
                  <RoleIcon className="h-3 w-3 mr-1" />
                  {roleInfo.label}
                </Badge>
                {admin.twoFactorEnabled && (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                    2FA
                  </Badge>
                )}
                {canManageTeam && !isCurrentUser && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditingAdmin(admin);
                          setEditName(admin.name || "");
                          setEditRole(admin.role);
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeletingAdmin(admin)}
                        className="text-rose-600"
                      >
                        <UserX className="h-4 w-4 mr-2" />
                        {admin.isActive ? "Deactivate" : "Remove"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={closeInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {tempPassword ? "Invitation Created" : "Invite Team Member"}
            </DialogTitle>
            <DialogDescription>
              {tempPassword
                ? "Share these credentials securely with the new team member."
                : "Add a new admin to your team. They will receive login credentials."}
            </DialogDescription>
          </DialogHeader>

          {tempPassword ? (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <p className="font-mono text-sm">{inviteEmail}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Temporary Password</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-2 bg-background rounded font-mono text-sm">
                      {tempPassword}
                    </code>
                    <Button variant="outline" size="sm" onClick={copyPassword}>
                      {copiedPassword ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                This password will not be shown again. Make sure to share it securely.
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="admin@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-name">Name (optional)</Label>
                <Input
                  id="invite-name"
                  placeholder="John Doe"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SUPER_ADMIN">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-purple-600" />
                        Super Admin - Full access, can manage team
                      </div>
                    </SelectItem>
                    <SelectItem value="ADMIN">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-blue-600" />
                        Admin - Full access to data
                      </div>
                    </SelectItem>
                    <SelectItem value="VIEWER">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-slate-600" />
                        Viewer - Read-only access
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {error && (
                <p className="text-sm text-rose-500">{error}</p>
              )}
            </div>
          )}

          <DialogFooter>
            {tempPassword ? (
              <Button onClick={closeInviteDialog}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={closeInviteDialog}>
                  Cancel
                </Button>
                <Button onClick={handleInvite} disabled={!inviteEmail || isInviting}>
                  {isInviting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Send Invitation
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingAdmin} onOpenChange={() => setEditingAdmin(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team Member</DialogTitle>
            <DialogDescription>
              Update {editingAdmin?.name || editingAdmin?.email}&apos;s information.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="VIEWER">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAdmin(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isUpdating}>
              {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingAdmin} onOpenChange={() => setDeletingAdmin(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Team Member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will prevent {deletingAdmin?.name || deletingAdmin?.email} from accessing the admin portal.
              This action can be reversed by reactivating the account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
