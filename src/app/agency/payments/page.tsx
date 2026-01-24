"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Wallet,
  Building2,
  CreditCard,
  ExternalLink,
  Copy,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface KOL {
  id: string;
  name: string;
  twitterHandle: string;
  walletAddress: string | null;
}

interface Campaign {
  id: string;
  name: string;
}

interface Payment {
  id: string;
  amount: number;
  method: string;
  status: string;
  walletAddress: string | null;
  network: string | null;
  txHash: string | null;
  notes: string | null;
  createdAt: string;
  paidAt: string | null;
  kol: {
    id: string;
    name: string;
    twitterHandle: string;
    walletAddress: string | null;
  };
  campaign: {
    id: string;
    name: string;
  } | null;
}

const statusColors: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-teal-100 text-teal-700",
  FAILED: "bg-rose-100 text-rose-700",
  CANCELLED: "bg-slate-100 text-slate-700",
};

const methodIcons: Record<string, React.ReactNode> = {
  CRYPTO: <Wallet className="h-4 w-4" />,
  BANK_TRANSFER: <Building2 className="h-4 w-4" />,
  PAYPAL: <CreditCard className="h-4 w-4" />,
  OTHER: <DollarSign className="h-4 w-4" />,
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [kols, setKols] = useState<KOL[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  // Form state
  const [formData, setFormData] = useState({
    kolId: "",
    campaignId: "",
    amount: "",
    method: "CRYPTO",
    walletAddress: "",
    network: "",
    notes: "",
  });

  const [updateData, setUpdateData] = useState({
    status: "",
    txHash: "",
    notes: "",
  });

  useEffect(() => {
    fetchPayments();
    fetchKols();
    fetchCampaigns();
  }, []);

  const fetchPayments = async () => {
    try {
      const response = await fetch("/api/payments");
      if (response.ok) {
        const data = await response.json();
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
      const response = await fetch("/api/kols");
      if (response.ok) {
        const data = await response.json();
        setKols(data);
      }
    } catch (error) {
      console.error("Failed to fetch KOLs:", error);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const response = await fetch("/api/campaigns");
      if (response.ok) {
        const data = await response.json();
        setCampaigns(data);
      }
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
    }
  };

  const handleCreatePayment = async () => {
    if (!formData.kolId || !formData.amount) return;
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kolId: formData.kolId,
          campaignId: formData.campaignId || undefined,
          amount: Math.round(parseFloat(formData.amount) * 100),
          method: formData.method,
          walletAddress: formData.walletAddress || undefined,
          network: formData.network || undefined,
          notes: formData.notes || undefined,
        }),
      });

      if (response.ok) {
        setShowCreateDialog(false);
        setFormData({
          kolId: "",
          campaignId: "",
          amount: "",
          method: "CRYPTO",
          walletAddress: "",
          network: "",
          notes: "",
        });
        fetchPayments();
      }
    } catch (error) {
      console.error("Failed to create payment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePayment = async () => {
    if (!selectedPayment) return;
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/payments/${selectedPayment.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: updateData.status || undefined,
          txHash: updateData.txHash || undefined,
          notes: updateData.notes || undefined,
        }),
      });

      if (response.ok) {
        setShowUpdateDialog(false);
        setSelectedPayment(null);
        setUpdateData({ status: "", txHash: "", notes: "" });
        fetchPayments();
      }
    } catch (error) {
      console.error("Failed to update payment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openUpdateDialog = (payment: Payment) => {
    setSelectedPayment(payment);
    setUpdateData({
      status: payment.status,
      txHash: payment.txHash || "",
      notes: payment.notes || "",
    });
    setShowUpdateDialog(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const filteredPayments = statusFilter === "all"
    ? payments
    : payments.filter(p => p.status === statusFilter);

  const pendingPayments = payments.filter(p => p.status === "PENDING");
  const completedPayments = payments.filter(p => p.status === "COMPLETED");
  const totalPending = pendingPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalPaid = completedPayments.reduce((sum, p) => sum + p.amount, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
          <p className="text-muted-foreground mt-1">
            Manage KOL payments and track transactions
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Payment
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{payments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalPending)}</div>
            <p className="text-xs text-muted-foreground">{pendingPayments.length} payments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-teal-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalPaid)}</div>
            <p className="text-xs text-muted-foreground">{completedPayments.length} payments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <DollarSign className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                payments
                  .filter(p => {
                    const date = new Date(p.createdAt);
                    const now = new Date();
                    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                  })
                  .reduce((sum, p) => sum + p.amount, 0)
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">All ({payments.length})</TabsTrigger>
          <TabsTrigger value="PENDING">
            Pending ({payments.filter(p => p.status === "PENDING").length})
          </TabsTrigger>
          <TabsTrigger value="PROCESSING">
            Processing ({payments.filter(p => p.status === "PROCESSING").length})
          </TabsTrigger>
          <TabsTrigger value="COMPLETED">
            Completed ({payments.filter(p => p.status === "COMPLETED").length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={statusFilter} className="mt-6">
          {filteredPayments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No payments found</h3>
                <p className="text-muted-foreground mt-1">
                  {statusFilter === "all"
                    ? "Create your first payment to get started."
                    : `No ${statusFilter.toLowerCase()} payments.`}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredPayments.map((payment) => (
                <Card key={payment.id} className="hover:border-primary/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-indigo-100 text-indigo-700">
                            {payment.kol.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{payment.kol.name}</p>
                            <span className="text-sm text-muted-foreground">
                              @{payment.kol.twitterHandle}
                            </span>
                          </div>
                          {payment.campaign && (
                            <p className="text-sm text-muted-foreground">
                              Campaign: {payment.campaign.name}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={statusColors[payment.status]}>
                              {payment.status}
                            </Badge>
                            <Badge variant="outline" className="flex items-center gap-1">
                              {methodIcons[payment.method]}
                              {payment.method.replace("_", " ")}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-2xl font-bold">{formatCurrency(payment.amount)}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(payment.createdAt)}
                          </p>
                        </div>

                        {payment.method === "CRYPTO" && payment.walletAddress && (
                          <div className="text-right max-w-[200px]">
                            <p className="text-xs text-muted-foreground">Wallet</p>
                            <div className="flex items-center gap-1">
                              <p className="text-sm font-mono truncate">
                                {payment.walletAddress}
                              </p>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => copyToClipboard(payment.walletAddress!)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )}

                        {payment.txHash && (
                          <Button size="sm" variant="outline" asChild>
                            <a
                              href={`https://etherscan.io/tx/${payment.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4 mr-1" />
                              View Tx
                            </a>
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openUpdateDialog(payment)}
                        >
                          Update
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Payment Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Payment</DialogTitle>
            <DialogDescription>
              Create a new payment record for a KOL.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>KOL *</Label>
              <Select
                value={formData.kolId}
                onValueChange={(value) => {
                  setFormData({ ...formData, kolId: value });
                  const kol = kols.find(k => k.id === value);
                  if (kol?.walletAddress) {
                    setFormData(prev => ({ ...prev, kolId: value, walletAddress: kol.walletAddress || "" }));
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
              <Label>Campaign (optional)</Label>
              <Select
                value={formData.campaignId}
                onValueChange={(value) => setFormData({ ...formData, campaignId: value })}
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
                <Label>Amount (USD) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Method *</Label>
                <Select
                  value={formData.method}
                  onValueChange={(value) => setFormData({ ...formData, method: value })}
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

            {formData.method === "CRYPTO" && (
              <>
                <div className="space-y-2">
                  <Label>Wallet Address</Label>
                  <Input
                    value={formData.walletAddress}
                    onChange={(e) => setFormData({ ...formData, walletAddress: e.target.value })}
                    placeholder="0x..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Network</Label>
                  <Select
                    value={formData.network}
                    onValueChange={(value) => setFormData({ ...formData, network: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select network" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ETH">Ethereum</SelectItem>
                      <SelectItem value="BSC">BNB Chain</SelectItem>
                      <SelectItem value="POLYGON">Polygon</SelectItem>
                      <SelectItem value="ARBITRUM">Arbitrum</SelectItem>
                      <SelectItem value="SOLANA">Solana</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
              disabled={!formData.kolId || !formData.amount || isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Create Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Payment Dialog */}
      <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Payment</DialogTitle>
            <DialogDescription>
              Update the payment status and details.
            </DialogDescription>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">KOL</span>
                  <span className="font-medium">{selectedPayment.kol.name}</span>
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-medium">{formatCurrency(selectedPayment.amount)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={updateData.status}
                  onValueChange={(value) => setUpdateData({ ...updateData, status: value })}
                >
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

              {selectedPayment.method === "CRYPTO" && (
                <div className="space-y-2">
                  <Label>Transaction Hash</Label>
                  <Input
                    value={updateData.txHash}
                    onChange={(e) => setUpdateData({ ...updateData, txHash: e.target.value })}
                    placeholder="0x..."
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={updateData.notes}
                  onChange={(e) => setUpdateData({ ...updateData, notes: e.target.value })}
                  placeholder="Add notes..."
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpdateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdatePayment} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Update Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
