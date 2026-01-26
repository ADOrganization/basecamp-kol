import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { Megaphone, Clock, DollarSign, Wallet, ArrowRight, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export default async function KOLDashboardPage() {
  const session = await auth();

  if (!session?.user?.kolId) {
    redirect("/kol/login");
  }

  const kolId = session.user.kolId;

  // Fetch dashboard data
  const [
    activeCampaigns,
    pendingDeliverables,
    totalEarnings,
    pendingPayments,
    recentPayments,
    pendingRequests,
  ] = await Promise.all([
    // Active campaigns count
    db.campaignKOL.count({
      where: {
        kolId,
        status: { in: ["PENDING", "CONFIRMED"] },
        campaign: {
          status: { in: ["ACTIVE", "PENDING_APPROVAL"] },
        },
      },
    }),
    // Calculate pending deliverables
    db.campaignKOL.findMany({
      where: {
        kolId,
        status: { in: ["PENDING", "CONFIRMED"] },
        campaign: { status: "ACTIVE" },
      },
      include: {
        campaign: {
          include: {
            posts: {
              where: { kolId },
            },
          },
        },
      },
    }),
    // Total earnings (completed payments)
    db.payment.aggregate({
      where: {
        kolId,
        status: "COMPLETED",
      },
      _sum: { amount: true },
    }),
    // Pending payments
    db.payment.aggregate({
      where: {
        kolId,
        status: { in: ["PENDING", "PROCESSING"] },
      },
      _sum: { amount: true },
    }),
    // Recent payments
    db.payment.findMany({
      where: { kolId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        campaign: { select: { name: true } },
      },
    }),
    // Pending join requests
    db.campaignJoinRequest.findMany({
      where: {
        kolId,
        status: "PENDING",
      },
      include: {
        campaign: { select: { name: true, projectTwitterHandle: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  // Calculate pending deliverables count
  let pendingDeliverablesCount = 0;
  const campaignProgress: Array<{
    id: string;
    name: string;
    required: number;
    completed: number;
    progress: number;
  }> = [];

  for (const ck of pendingDeliverables) {
    const required =
      ck.requiredPosts + ck.requiredThreads + ck.requiredRetweets + ck.requiredSpaces;
    const completed = ck.campaign.posts.filter(
      (p) => p.status === "VERIFIED" || p.status === "POSTED"
    ).length;
    const pending = Math.max(0, required - completed);
    pendingDeliverablesCount += pending;

    if (required > 0) {
      campaignProgress.push({
        id: ck.campaignId,
        name: ck.campaign.name,
        required,
        completed,
        progress: Math.min(100, Math.round((completed / required) * 100)),
      });
    }
  }

  const stats = [
    {
      name: "Active Campaigns",
      value: activeCampaigns,
      icon: Megaphone,
      color: "text-purple-600",
      bgColor: "bg-purple-100 dark:bg-purple-900/30",
    },
    {
      name: "Pending Deliverables",
      value: pendingDeliverablesCount,
      icon: Clock,
      color: "text-amber-600",
      bgColor: "bg-amber-100 dark:bg-amber-900/30",
    },
    {
      name: "Total Earnings",
      value: formatCurrency(totalEarnings._sum.amount || 0),
      icon: DollarSign,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    },
    {
      name: "Pending Payments",
      value: formatCurrency(pendingPayments._sum.amount || 0),
      icon: Wallet,
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back, {session.user.name}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.name}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Campaign Progress */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Campaign Progress</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/kol/campaigns">
                View all <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {campaignProgress.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Megaphone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No active campaigns</p>
                <Button variant="link" asChild className="mt-2">
                  <Link href="/kol/campaigns/discover">Discover campaigns</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {campaignProgress.slice(0, 4).map((campaign) => (
                  <Link
                    key={campaign.id}
                    href={`/kol/campaigns/${campaign.id}`}
                    className="block"
                  >
                    <div className="space-y-2 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">
                          {campaign.name}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {campaign.completed}/{campaign.required}
                        </span>
                      </div>
                      <Progress value={campaign.progress} className="h-2" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Payments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Payments</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/kol/payments">
                View all <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentPayments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No payments yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                  >
                    <div>
                      <p className="font-medium">
                        {payment.campaign?.name || "General Payment"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(payment.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatCurrency(payment.amount)}
                      </p>
                      <Badge
                        variant={
                          payment.status === "COMPLETED"
                            ? "default"
                            : payment.status === "PENDING"
                            ? "secondary"
                            : "outline"
                        }
                        className="text-xs"
                      >
                        {payment.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pending Join Requests */}
      {pendingRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Pending Join Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30"
                >
                  <div>
                    <p className="font-medium">{request.campaign.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {request.campaign.projectTwitterHandle}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    <Clock className="h-3 w-3 mr-1" />
                    Pending
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
