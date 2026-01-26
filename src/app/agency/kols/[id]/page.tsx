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
  Twitter,
  Mail,
  Wallet,
  RefreshCw,
} from "lucide-react";

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
        router.push("/agency/kols");
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
                <Twitter className="h-4 w-4" />
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
                          href={`/agency/campaigns/${ck.campaign.id}`}
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
          {/* Outgoing Payments */}
          <div className="rounded-lg border bg-card">
            <div className="p-4 border-b bg-muted/30">
              <h3 className="font-semibold">Outgoing Payments</h3>
              <p className="text-sm text-muted-foreground">Payments made to this KOL</p>
            </div>
            {kol.payments.length === 0 ? (
              <p className="p-6 text-muted-foreground">No payments recorded.</p>
            ) : (
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium text-muted-foreground">Amount</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {kol.payments.map((payment) => (
                    <tr key={payment.id} className="border-t">
                      <td className="p-4 font-medium">{formatCurrency(payment.amount)}</td>
                      <td className="p-4">
                        <Badge className={getStatusColor(payment.status)} variant="secondary">
                          {payment.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-right">
                        {formatDate(payment.paidAt || payment.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Payment Receipts */}
          <div className="rounded-lg border bg-card">
            <div className="p-4 border-b bg-muted/30">
              <h3 className="font-semibold">Payment Receipts</h3>
              <p className="text-sm text-muted-foreground">Proof of payments submitted via Telegram</p>
            </div>
            {kol.paymentReceipts?.length === 0 ? (
              <p className="p-6 text-muted-foreground">No receipts submitted. KOLs can submit receipts using <code className="bg-muted px-1.5 py-0.5 rounded text-xs">/payment</code> in Telegram.</p>
            ) : (
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium text-muted-foreground">Campaign</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Proof Link</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Submitted By</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {kol.paymentReceipts?.map((receipt) => (
                    <tr key={receipt.id} className="border-t">
                      <td className="p-4">
                        {receipt.campaign ? (
                          <Link
                            href={`/agency/campaigns/${receipt.campaign.id}`}
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
                    </tr>
                  ))}
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
    </div>
  );
}
