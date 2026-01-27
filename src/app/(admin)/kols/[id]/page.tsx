"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KOLForm } from "@/components/agency/kol-form";
import {
  formatNumber,
  formatCurrency,
  formatDate,
  getTierColor,
  getStatusColor,
} from "@/lib/utils";
import {
  ArrowLeft,
  Edit,
  ExternalLink,
  Mail,
  Wallet,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  Download,
} from "lucide-react";
import { XIcon } from "@/components/ui/x-icon";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TelegramChat {
  id: string;
  telegramChatId: string;
  title: string | null;
}

interface KOLDetails {
  id: string;
  name: string;
  twitterHandle: string;
  twitterId: string | null;
  avatarUrl: string | null;
  telegramUsername: string | null;
  telegramGroupId: string | null;
  email: string | null;
  tier: string;
  status: string;
  ratePerPost: number | null;
  ratePerThread: number | null;
  ratePerRetweet: number | null;
  ratePerSpace: number | null;
  walletAddress: string | null;
  paymentNotes: string | null;
  followersCount: number;
  followingCount: number;
  avgEngagementRate: number;
  avgLikes: number;
  avgRetweets: number;
  avgReplies: number;
  lastMetricsUpdate: string | null;
  notes: string | null;
  createdAt: string;
  tags: { id: string; name: string; color: string }[];
  campaignKols: {
    id: string;
    status: string;
    assignedBudget: number;
    campaign: {
      id: string;
      name: string;
      status: string;
    };
  }[];
  posts: {
    id: string;
    type: string;
    status: string;
    impressions: number;
    likes: number;
    postedAt: string | null;
  }[];
  payments: {
    id: string;
    amount: number;
    status: string;
    paidAt: string | null;
    createdAt: string;
  }[];
  paymentReceipts?: {
    id: string;
    amount: number;
    proofUrl: string;
    telegramUsername: string | null;
    createdAt: string;
    campaign: {
      id: string;
      name: string;
    } | null;
  }[];
}

export default function KOLDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [kol, setKol] = useState<KOLDetails | null>(null);
  const [telegramChats, setTelegramChats] = useState<TelegramChat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Receipt form state
  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<NonNullable<KOLDetails["paymentReceipts"]>[0] | null>(null);
  const [receiptFormData, setReceiptFormData] = useState({
    amount: "",
    proofUrl: "",
    campaignId: "",
  });
  const [isSubmittingReceipt, setIsSubmittingReceipt] = useState(false);
  const [deletingReceiptId, setDeletingReceiptId] = useState<string | null>(null);

  const fetchTelegramChats = async () => {
    try {
      const response = await fetch("/api/telegram/chats");
      if (response.ok) {
        const data = await response.json();
        setTelegramChats(data.chats || []);
      }
    } catch (error) {
      console.error("Failed to fetch telegram chats:", error);
    }
  };

  const fetchKol = async () => {
    try {
      const response = await fetch(`/api/kols/${id}`);
      if (response.ok) {
        const data = await response.json();
        setKol(data);
        setError(null);
      } else if (response.status === 404) {
        router.push("/kols");
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.error || `Failed to load KOL (${response.status})`);
        console.error("KOL fetch error:", response.status, data);
      }
    } catch (err) {
      console.error("Failed to fetch KOL:", err);
      setError("Network error - failed to load KOL");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchKol();
    fetchTelegramChats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const refreshMetrics = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch(`/api/kols/${id}/metrics`, {
        method: "POST",
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.kol) {
          setKol((prev) => (prev ? { ...prev, ...data.kol } : prev));
        }
      }
    } catch (error) {
      console.error("Failed to refresh metrics:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const openReceiptForm = (receipt?: NonNullable<KOLDetails["paymentReceipts"]>[0]) => {
    if (receipt) {
      setEditingReceipt(receipt);
      setReceiptFormData({
        amount: (receipt.amount / 100).toString(),
        proofUrl: receipt.proofUrl,
        campaignId: receipt.campaign?.id || "",
      });
    } else {
      setEditingReceipt(null);
      setReceiptFormData({
        amount: "",
        proofUrl: "",
        campaignId: kol?.campaignKols[0]?.campaign.id || "",
      });
    }
    setShowReceiptForm(true);
  };

  const handleReceiptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kol) return;

    setIsSubmittingReceipt(true);
    try {
      const payload = {
        kolId: kol.id,
        amount: Math.round(parseFloat(receiptFormData.amount) * 100),
        proofUrl: receiptFormData.proofUrl,
        campaignId: receiptFormData.campaignId || null,
      };

      const response = await fetch(
        editingReceipt
          ? `/api/payment-receipts/${editingReceipt.id}`
          : "/api/payment-receipts",
        {
          method: editingReceipt ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (response.ok) {
        setShowReceiptForm(false);
        fetchKol();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to save receipt");
      }
    } catch (error) {
      console.error("Failed to save receipt:", error);
      alert("Failed to save receipt");
    } finally {
      setIsSubmittingReceipt(false);
    }
  };

  const handleDeleteReceipt = async (receiptId: string) => {
    if (!confirm("Are you sure you want to delete this payment receipt?")) return;

    setDeletingReceiptId(receiptId);
    try {
      const response = await fetch(`/api/payment-receipts/${receiptId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchKol();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to delete receipt");
      }
    } catch (error) {
      console.error("Failed to delete receipt:", error);
      alert("Failed to delete receipt");
    } finally {
      setDeletingReceiptId(null);
    }
  };

  const exportPaymentHistory = () => {
    if (!kol || !kol.paymentReceipts || kol.paymentReceipts.length === 0) {
      alert("No payment receipts to export");
      return;
    }

    const headers = ["Date", "Campaign", "Amount (USD)", "Proof URL", "Submitted By"];
    const rows = kol.paymentReceipts.map((receipt) => [
      new Date(receipt.createdAt).toLocaleDateString(),
      receipt.campaign?.name || "-",
      (receipt.amount / 100).toFixed(2),
      receipt.proofUrl,
      receipt.telegramUsername ? `@${receipt.telegramUsername}` : "-",
    ]);

    // Add total row
    const totalAmount = kol.paymentReceipts.reduce((sum, r) => sum + r.amount, 0);
    rows.push(["", "TOTAL", (totalAmount / 100).toFixed(2), "", ""]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${kol.name.replace(/\s+/g, "_")}_payment_history_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-destructive text-lg font-medium">{error}</div>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  if (!kol) return null;

  const totalEarnings = kol.payments
    .filter((p) => p.status === "COMPLETED")
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          {kol.avatarUrl ? (
            <img
              src={kol.avatarUrl}
              alt={kol.name}
              className="h-16 w-16 rounded-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <div className={`h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-2xl font-bold ${kol.avatarUrl ? 'hidden' : ''}`}>
            {kol.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{kol.name}</h1>
              <Badge className={getTierColor(kol.tier)} variant="secondary">
                {kol.tier}
              </Badge>
              <Badge className={getStatusColor(kol.status)} variant="secondary">
                {kol.status}
              </Badge>
            </div>
            <div className="flex items-center gap-4 mt-1 text-muted-foreground">
              <a
                href={`https://twitter.com/${kol.twitterHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-primary"
              >
                <XIcon className="h-4 w-4" />
                @{kol.twitterHandle}
                <ExternalLink className="h-3 w-3" />
              </a>
              {kol.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  {kol.email}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refreshMetrics} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Refreshing..." : "Refresh Metrics"}
          </Button>
          <Button onClick={() => setShowForm(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Followers</p>
          <p className="text-2xl font-bold">{formatNumber(kol.followersCount)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Avg Engagement</p>
          <p className="text-2xl font-bold">{kol.avgEngagementRate.toFixed(2)}%</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Campaigns</p>
          <p className="text-2xl font-bold">{kol.campaignKols.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Earnings</p>
          <p className="text-2xl font-bold">{formatCurrency(totalEarnings)}</p>
        </div>
      </div>
      {kol.lastMetricsUpdate && (
        <p className="text-sm text-muted-foreground">
          Metrics last updated: {formatDate(kol.lastMetricsUpdate)}
        </p>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns ({kol.campaignKols.length})</TabsTrigger>
          <TabsTrigger value="posts">Posts ({kol.posts.length})</TabsTrigger>
          <TabsTrigger value="payments">Payments ({kol.payments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* Rates */}
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold mb-4">Rates</h3>
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Per Post</p>
                <p className="font-medium">
                  {kol.ratePerPost ? formatCurrency(kol.ratePerPost) : "-"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Per Thread</p>
                <p className="font-medium">
                  {kol.ratePerThread ? formatCurrency(kol.ratePerThread) : "-"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Per Retweet</p>
                <p className="font-medium">
                  {kol.ratePerRetweet ? formatCurrency(kol.ratePerRetweet) : "-"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Per Space</p>
                <p className="font-medium">
                  {kol.ratePerSpace ? formatCurrency(kol.ratePerSpace) : "-"}
                </p>
              </div>
            </div>
          </div>

          {/* Payment Info */}
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold mb-4">Payment Information</h3>
            {kol.walletAddress ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <code className="text-sm bg-muted px-2 py-1 rounded">
                    {kol.walletAddress}
                  </code>
                </div>
                {kol.paymentNotes && (
                  <p className="text-sm text-muted-foreground">{kol.paymentNotes}</p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">No payment info added.</p>
            )}
          </div>

          {/* Notes */}
          {kol.notes && (
            <div className="rounded-lg border bg-card p-6">
              <h3 className="font-semibold mb-4">Notes</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{kol.notes}</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="campaigns" className="mt-6">
          <div className="rounded-lg border bg-card">
            {kol.campaignKols.length === 0 ? (
              <p className="p-6 text-muted-foreground">No campaigns assigned.</p>
            ) : (
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium text-muted-foreground">Campaign</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">Budget</th>
                  </tr>
                </thead>
                <tbody>
                  {kol.campaignKols.map((ck) => (
                    <tr key={ck.id} className="border-t">
                      <td className="p-4">
                        <Link
                          href={`/campaigns/${ck.campaign.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {ck.campaign.name}
                        </Link>
                      </td>
                      <td className="p-4">
                        <Badge className={getStatusColor(ck.status)} variant="secondary">
                          {ck.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-right">
                        {formatCurrency(ck.assignedBudget)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="posts" className="mt-6">
          <div className="rounded-lg border bg-card">
            {kol.posts.length === 0 ? (
              <p className="p-6 text-muted-foreground">No posts tracked.</p>
            ) : (
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium text-muted-foreground">Type</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">Impressions</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">Likes</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">Posted</th>
                  </tr>
                </thead>
                <tbody>
                  {kol.posts.map((post) => (
                    <tr key={post.id} className="border-t">
                      <td className="p-4">{post.type}</td>
                      <td className="p-4">
                        <Badge className={getStatusColor(post.status)} variant="secondary">
                          {post.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-right">{formatNumber(post.impressions)}</td>
                      <td className="p-4 text-right">{formatNumber(post.likes)}</td>
                      <td className="p-4 text-right">
                        {post.postedAt ? formatDate(post.postedAt) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="payments" className="mt-6 space-y-6">
          {/* Payment Receipts */}
          <div className="rounded-lg border bg-card">
            <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Payment Receipts</h3>
                <p className="text-sm text-muted-foreground">Proof of payments submitted via Telegram or manually added</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={exportPaymentHistory}>
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </Button>
                <Button size="sm" onClick={() => openReceiptForm()}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Receipt
                </Button>
              </div>
            </div>
            {(!kol.paymentReceipts || kol.paymentReceipts.length === 0) ? (
              <p className="p-6 text-muted-foreground">No receipts submitted. KOLs can submit receipts using <code className="bg-muted px-1.5 py-0.5 rounded text-xs">/payment</code> in Telegram, or you can add them manually.</p>
            ) : (
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium text-muted-foreground">Campaign</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Proof Link</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Submitted By</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">Date</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">Amount</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {kol.paymentReceipts.map((receipt) => (
                    <tr key={receipt.id} className="border-t">
                      <td className="p-4">
                        {receipt.campaign ? (
                          <Link
                            href={`/campaigns/${receipt.campaign.id}`}
                            className="font-medium hover:text-primary"
                          >
                            {receipt.campaign.name}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        <a
                          href={receipt.proofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          View Proof
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {receipt.telegramUsername ? `@${receipt.telegramUsername}` : "-"}
                      </td>
                      <td className="p-4 text-right">
                        {formatDate(receipt.createdAt)}
                      </td>
                      <td className="p-4 text-right font-medium">
                        {formatCurrency(receipt.amount)}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openReceiptForm(receipt)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteReceipt(receipt.id)}
                            disabled={deletingReceiptId === receipt.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {/* Total row */}
                  <tr className="border-t bg-muted/30 font-semibold">
                    <td className="p-4">Total</td>
                    <td className="p-4"></td>
                    <td className="p-4"></td>
                    <td className="p-4"></td>
                    <td className="p-4 text-right">
                      {formatCurrency(kol.paymentReceipts.reduce((sum, r) => sum + r.amount, 0))}
                    </td>
                    <td className="p-4"></td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <KOLForm
        kol={{
          ...kol,
          telegramGroupId: kol.telegramGroupId || null,
        }}
        telegramChats={telegramChats}
        open={showForm}
        onClose={() => {
          setShowForm(false);
          fetchKol();
        }}
      />

      {/* Receipt Form Dialog */}
      <Dialog open={showReceiptForm} onOpenChange={setShowReceiptForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingReceipt ? "Edit Payment Receipt" : "Add Payment Receipt"}
            </DialogTitle>
            <DialogDescription>
              {editingReceipt
                ? "Update the payment receipt details."
                : "Add a new payment receipt for this KOL."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleReceiptSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="receipt-campaign">Campaign</Label>
              <Select
                value={receiptFormData.campaignId}
                onValueChange={(value) =>
                  setReceiptFormData((prev) => ({ ...prev, campaignId: value }))
                }
              >
                <SelectTrigger id="receipt-campaign">
                  <SelectValue placeholder="Select campaign" />
                </SelectTrigger>
                <SelectContent>
                  {kol.campaignKols.map((ck) => (
                    <SelectItem key={ck.campaign.id} value={ck.campaign.id}>
                      {ck.campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="receipt-amount">Amount (USD)</Label>
              <Input
                id="receipt-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="500.00"
                value={receiptFormData.amount}
                onChange={(e) =>
                  setReceiptFormData((prev) => ({ ...prev, amount: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="receipt-proof">Proof URL</Label>
              <Input
                id="receipt-proof"
                type="url"
                placeholder="https://etherscan.io/tx/..."
                value={receiptFormData.proofUrl}
                onChange={(e) =>
                  setReceiptFormData((prev) => ({ ...prev, proofUrl: e.target.value }))
                }
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowReceiptForm(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmittingReceipt}>
                {isSubmittingReceipt
                  ? "Saving..."
                  : editingReceipt
                  ? "Update Receipt"
                  : "Add Receipt"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
