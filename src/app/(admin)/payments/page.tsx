"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  DollarSign,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";

interface Payment {
  id: string;
  amount: number;
  currency: string;
  method: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
  txHash: string | null;
  walletAddress: string | null;
  network: string | null;
  notes: string | null;
  paidAt: string | null;
  createdAt: string;
  kol: {
    id: string;
    name: string;
    twitterHandle: string;
    avatarUrl: string | null;
    walletAddress: string | null;
  };
  campaign: {
    id: string;
    name: string;
  } | null;
}

interface KOL {
  id: string;
  name: string;
  twitterHandle: string;
  avatarUrl: string | null;
  walletAddress: string | null;
}

interface Campaign {
  id: string;
  name: string;
}

const statusConfig = {
  PENDING: { label: "Pending", icon: Clock, color: "text-amber-500 bg-amber-500/10" },
  PROCESSING: { label: "Processing", icon: Loader2, color: "text-blue-500 bg-blue-500/10" },
  COMPLETED: { label: "Completed", icon: CheckCircle2, color: "text-emerald-500 bg-emerald-500/10" },
  FAILED: { label: "Failed", icon: XCircle, color: "text-red-500 bg-red-500/10" },
  CANCELLED: { label: "Cancelled", icon: AlertCircle, color: "text-gray-500 bg-gray-500/10" },
};

export default function PaymentsPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [kols, setKols] = useState<KOL[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Create payment dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    kolId: "",
    campaignId: "",
    amount: "",
    method: "CRYPTO",
    walletAddress: "",
    network: "",
    notes: "",
  });

  // Update status dialog
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [txHash, setTxHash] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    fetchPayments();
    fetchKols();
    fetchCampaigns();
  }, [statusFilter]);

  const fetchPayments = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/payments?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPayments(data);
      }
    } catch (error) {
      console.error("Failed to fetch payments:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchKols = async () => {
    try {
      const res = await fetch("/api/kols");
      if (res.ok) {
        const result = await res.json();
        // API returns { data: [...], pagination: {...} }
        setKols(result.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch KOLs:", error);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const res = await fetch("/api/campaigns");
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data);
      }
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
    }
  };

  const handleCreatePayment = async () => {
    if (!createForm.kolId || !createForm.amount) return;

    setIsCreating(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kolId: createForm.kolId,
          campaignId: createForm.campaignId || undefined,
          amount: parseFloat(createForm.amount),
          method: createForm.method,
          walletAddress: createForm.walletAddress || undefined,
          network: createForm.network || undefined,
          notes: createForm.notes || undefined,
        }),
      });

      if (res.ok) {
        setShowCreateDialog(false);
        setCreateForm({
          kolId: "",
          campaignId: "",
          amount: "",
          method: "CRYPTO",
          walletAddress: "",
          network: "",
          notes: "",
        });
        fetchPayments();
      } else {
        const error = await res.json();
        alert(error.error || "Failed to create payment");
      }
    } catch (error) {
      console.error("Failed to create payment:", error);
      alert("Failed to create payment");
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedPayment || !newStatus) return;

    setIsUpdating(true);
    try {
      const res = await fetch(`/api/payments/${selectedPayment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          txHash: txHash || undefined,
        }),
      });

      if (res.ok) {
        setShowStatusDialog(false);
        setSelectedPayment(null);
        setNewStatus("");
        setTxHash("");
        fetchPayments();
      } else {
        const error = await res.json();
        alert(error.error || "Failed to update payment");
      }
    } catch (error) {
      console.error("Failed to update payment:", error);
      alert("Failed to update payment");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm("Are you sure you want to delete this payment?")) return;

    try {
      const res = await fetch(`/api/payments/${paymentId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchPayments();
      } else {
        const error = await res.json();
        alert(error.error || "Failed to delete payment");
      }
    } catch (error) {
      console.error("Failed to delete payment:", error);
      alert("Failed to delete payment");
    }
  };

  const openStatusDialog = (payment: Payment) => {
    setSelectedPayment(payment);
    setNewStatus(payment.status);
    setTxHash(payment.txHash || "");
    setShowStatusDialog(true);
  };

  const filteredPayments = payments.filter((payment) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      payment.kol.name.toLowerCase().includes(query) ||
      payment.kol.twitterHandle.toLowerCase().includes(query) ||
      payment.campaign?.name.toLowerCase().includes(query)
    );
  });

  // Calculate totals
  const totals = {
    pending: payments.filter(p => p.status === "PENDING").reduce((sum, p) => sum + p.amount, 0),
    processing: payments.filter(p => p.status === "PROCESSING").reduce((sum, p) => sum + p.amount, 0),
    completed: payments.filter(p => p.status === "COMPLETED").reduce((sum, p) => sum + p.amount, 0),
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-emerald-500" />
            Payments
          </h1>
          <p className="text-muted-foreground">Manage KOL payments and transactions</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Payment
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-amber-500 mb-1">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-medium">Pending</span>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(totals.pending)}</p>
          <p className="text-xs text-muted-foreground">
            {payments.filter(p => p.status === "PENDING").length} payments
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-blue-500 mb-1">
            <Loader2 className="h-4 w-4" />
            <span className="text-sm font-medium">Processing</span>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(totals.processing)}</p>
          <p className="text-xs text-muted-foreground">
            {payments.filter(p => p.status === "PROCESSING").length} payments
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-emerald-500 mb-1">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">Completed</span>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(totals.completed)}</p>
          <p className="text-xs text-muted-foreground">
            {payments.filter(p => p.status === "COMPLETED").length} payments
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search KOL or campaign..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="PROCESSING">Processing</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Payments Table */}
      <div className="rounded-lg border bg-card">
        {filteredPayments.length === 0 ? (
          <div className="p-12 text-center">
            <DollarSign className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-1">No payments found</h3>
            <p className="text-muted-foreground mb-4">
              {payments.length === 0
                ? "Create your first payment to get started"
                : "No payments match your search criteria"}
            </p>
            {payments.length === 0 && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Payment
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-4 font-medium text-muted-foreground">KOL</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Campaign</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Amount</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Method</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Date</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredPayments.map((payment) => {
                  const status = statusConfig[payment.status];
                  const StatusIcon = status.icon;
                  return (
                    <tr key={payment.id} className="hover:bg-muted/50">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {payment.kol.avatarUrl ? (
                            <img
                              src={payment.kol.avatarUrl}
                              alt={payment.kol.name}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-medium">
                                {payment.kol.name.charAt(0)}
                              </span>
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{payment.kol.name}</p>
                            <p className="text-sm text-muted-foreground">
                              @{payment.kol.twitterHandle}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-sm">
                          {payment.campaign?.name || "-"}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="font-medium">
                          {formatCurrency(payment.amount)}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm capitalize">
                          {payment.method.toLowerCase().replace("_", " ")}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">
                          {new Date(payment.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openStatusDialog(payment)}>
                              Update Status
                            </DropdownMenuItem>
                            {payment.txHash && (
                              <DropdownMenuItem asChild>
                                <a
                                  href={`https://etherscan.io/tx/${payment.txHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  View Transaction
                                </a>
                              </DropdownMenuItem>
                            )}
                            {payment.status === "PENDING" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleDeletePayment(payment.id)}
                                  className="text-red-600"
                                >
                                  Delete Payment
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Payment Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Payment</DialogTitle>
            <DialogDescription>
              Create a new payment record for a KOL
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>KOL *</Label>
              <Select
                value={createForm.kolId}
                onValueChange={(value) => {
                  setCreateForm({ ...createForm, kolId: value });
                  const kol = kols.find(k => k.id === value);
                  if (kol?.walletAddress) {
                    setCreateForm(prev => ({ ...prev, kolId: value, walletAddress: kol.walletAddress || "" }));
                  }
                }}
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

            <div className="space-y-2">
              <Label>Campaign (Optional)</Label>
              <Select
                value={createForm.campaignId}
                onValueChange={(value) => setCreateForm({ ...createForm, campaignId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select campaign" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No campaign</SelectItem>
                  {campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount ($) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={createForm.amount}
                  onChange={(e) => setCreateForm({ ...createForm, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Method</Label>
                <Select
                  value={createForm.method}
                  onValueChange={(value) => setCreateForm({ ...createForm, method: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CRYPTO">Crypto</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                    <SelectItem value="PAYPAL">PayPal</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {createForm.method === "CRYPTO" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Wallet Address</Label>
                  <Input
                    value={createForm.walletAddress}
                    onChange={(e) => setCreateForm({ ...createForm, walletAddress: e.target.value })}
                    placeholder="0x..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Network</Label>
                  <Select
                    value={createForm.network}
                    onValueChange={(value) => setCreateForm({ ...createForm, network: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ETH">Ethereum</SelectItem>
                      <SelectItem value="SOL">Solana</SelectItem>
                      <SelectItem value="MATIC">Polygon</SelectItem>
                      <SelectItem value="ARB">Arbitrum</SelectItem>
                      <SelectItem value="BASE">Base</SelectItem>
                      <SelectItem value="BSC">BSC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={createForm.notes}
                onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                placeholder="Optional notes..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreatePayment}
              disabled={isCreating || !createForm.kolId || !createForm.amount}
            >
              {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Status Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Payment Status</DialogTitle>
            <DialogDescription>
              Change the status of this payment
            </DialogDescription>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium">{selectedPayment.kol.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(selectedPayment.amount)}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="PROCESSING">Processing</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="FAILED">Failed</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(newStatus === "COMPLETED" || newStatus === "PROCESSING") && (
                <div className="space-y-2">
                  <Label>Transaction Hash (Optional)</Label>
                  <Input
                    value={txHash}
                    onChange={(e) => setTxHash(e.target.value)}
                    placeholder="0x..."
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateStatus} disabled={isUpdating}>
              {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
