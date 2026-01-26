"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, MoreHorizontal, UserX, UserCheck, Mail, Trash2, Clock, RefreshCw } from "lucide-react";

interface Member {
  id: string;
  userId: string;
  role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
  user: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl?: string | null;
    isDisabled?: boolean;
    lastLoginAt?: string | null;
  };
}

interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  invitedBy: string;
  expiresAt: string;
  createdAt: string;
}

interface TeamManagementProps {
  members: Member[];
  currentUserId: string;
  variant?: "agency" | "client";
  hideInvite?: boolean;
}

export function TeamManagement({ members: initialMembers, currentUserId, variant = "agency", hideInvite = false }: TeamManagementProps) {
  const router = useRouter();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [members, setMembers] = useState(initialMembers);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [inviteData, setInviteData] = useState({
    email: "",
    role: "MEMBER" as "ADMIN" | "MEMBER" | "VIEWER",
  });

  // Fetch users and invitations from admin API
  useEffect(() => {
    const fetchUsersAndInvitations = async () => {
      try {
        const response = await fetch("/api/admin/users");
        if (response.ok) {
          const data = await response.json();
          setInvitations(data.invitations || []);
        }
      } catch (err) {
        console.error("Failed to fetch invitations:", err);
      }
    };

    if (!hideInvite) {
      fetchUsersAndInvitations();
    }
  }, [hideInvite]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInviting(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send invitation");
      }

      setSuccess(`Invitation sent to ${inviteData.email}`);
      setInviteData({ email: "", role: "MEMBER" });
      setIsInviteOpen(false);

      // Refresh invitations
      const inviteResponse = await fetch("/api/admin/users");
      if (inviteResponse.ok) {
        const inviteData = await inviteResponse.json();
        setInvitations(inviteData.invitations || []);
      }

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setIsInviting(false);
    }
  };

  const handleDisableUser = async (userId: string, disable: boolean) => {
    setActionLoading(userId);
    setError(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}/disable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disable }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update user");
      }

      // Update local state
      setMembers(members.map(m =>
        m.userId === userId
          ? { ...m, user: { ...m.user, isDisabled: disable } }
          : m
      ));

      setSuccess(disable ? "User access disabled" : "User access enabled");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveUser = async (userId: string, userName: string) => {
    setActionLoading(userId);
    setError(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to remove user");
      }

      setMembers(members.filter(m => m.userId !== userId));
      setSuccess(`${userName} has been removed from the team`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove user");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    setActionLoading(invitationId);
    setError(null);

    try {
      const response = await fetch(`/api/admin/invitations/${invitationId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to revoke invitation");
      }

      setInvitations(invitations.filter(inv => inv.id !== invitationId));
      setSuccess("Invitation revoked");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke invitation");
    } finally {
      setActionLoading(null);
    }
  };

  const handleResendInvitation = async (invitationId: string, email: string) => {
    setActionLoading(invitationId);
    setError(null);

    try {
      const response = await fetch(`/api/admin/invitations/${invitationId}`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to resend invitation");
      }

      // Refresh invitations
      const inviteResponse = await fetch("/api/admin/users");
      if (inviteResponse.ok) {
        const inviteData = await inviteResponse.json();
        setInvitations(inviteData.invitations || []);
      }

      setSuccess(`Invitation resent to ${email}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend invitation");
    } finally {
      setActionLoading(null);
    }
  };

  const avatarBgClass = variant === "client" ? "bg-teal-100 text-teal-600" : "bg-indigo-100 text-indigo-600";
  const buttonClass = variant === "client" ? "bg-teal-600 hover:bg-teal-700" : "";

  const currentUserRole = members.find(m => m.userId === currentUserId)?.role;
  const canManageUsers = currentUserRole === "OWNER" || currentUserRole === "ADMIN";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                Manage who has access to your organization
              </CardDescription>
            </div>
            {!hideInvite && canManageUsers && (
              <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                <DialogTrigger asChild>
                  <Button className={buttonClass}>
                    <Mail className="h-4 w-4 mr-2" />
                    Invite Member
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleInvite}>
                    <DialogHeader>
                      <DialogTitle>Invite Team Member</DialogTitle>
                      <DialogDescription>
                        They will receive a secure sign-in link via email to join your organization.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="invite-email">Email Address</Label>
                        <Input
                          id="invite-email"
                          type="email"
                          value={inviteData.email}
                          onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                          placeholder="colleague@example.com"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="invite-role">Role</Label>
                        <Select
                          value={inviteData.role}
                          onValueChange={(value: "ADMIN" | "MEMBER" | "VIEWER") => setInviteData({ ...inviteData, role: value })}
                        >
                          <SelectTrigger id="invite-role">
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="VIEWER">Viewer (Read-only)</SelectItem>
                            <SelectItem value="MEMBER">Member</SelectItem>
                            <SelectItem value="ADMIN">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Admins can manage team members and settings. Members can create and edit content. Viewers have read-only access.
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsInviteOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isInviting} className={buttonClass}>
                        {isInviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isInviting ? "Sending..." : "Send Invitation"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="p-3 mb-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 mb-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-md text-sm">
              {success}
            </div>
          )}

          <div className="divide-y">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <Avatar className={member.user.isDisabled ? "opacity-50" : ""}>
                    {member.user.avatarUrl && <AvatarImage src={member.user.avatarUrl} alt={member.user.name || "Member"} />}
                    <AvatarFallback className={avatarBgClass}>
                      {member.user.name?.charAt(0) || member.user.email.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className={member.user.isDisabled ? "opacity-50" : ""}>
                    <p className="font-medium">{member.user.name || member.user.email}</p>
                    <p className="text-sm text-muted-foreground">{member.user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={member.role === "OWNER" ? "default" : "secondary"}>
                    {member.role}
                  </Badge>
                  {member.user.isDisabled && (
                    <Badge variant="destructive">Disabled</Badge>
                  )}
                  {canManageUsers && member.userId !== currentUserId && member.role !== "OWNER" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={actionLoading === member.userId}>
                          {actionLoading === member.userId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MoreHorizontal className="h-4 w-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {member.user.isDisabled ? (
                          <DropdownMenuItem onClick={() => handleDisableUser(member.userId, false)}>
                            <UserCheck className="h-4 w-4 mr-2" />
                            Enable Access
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleDisableUser(member.userId, true)}>
                            <UserX className="h-4 w-4 mr-2" />
                            Disable Access
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem
                              className="text-red-600 dark:text-red-400"
                              onSelect={(e) => e.preventDefault()}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remove from Team
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove {member.user.name || member.user.email} from the team?
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleRemoveUser(member.userId, member.user.name || member.user.email)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {!hideInvite && invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pending Invitations
            </CardTitle>
            <CardDescription>
              Invitations that have been sent but not yet accepted
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {invitations.map((invitation) => (
                <div key={invitation.id} className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-medium">{invitation.email}</p>
                    <p className="text-sm text-muted-foreground">
                      Invited by {invitation.invitedBy} &middot; Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{invitation.role}</Badge>
                    {canManageUsers && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={actionLoading === invitation.id}>
                            {actionLoading === invitation.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleResendInvitation(invitation.id, invitation.email)}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Resend Invitation
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 dark:text-red-400"
                            onClick={() => handleRevokeInvitation(invitation.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Revoke Invitation
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
