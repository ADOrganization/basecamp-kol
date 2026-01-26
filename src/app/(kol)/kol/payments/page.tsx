import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PaymentHistory } from "@/components/kol/payment-history";
import { DollarSign, Clock, CheckCircle, Wallet, ArrowRight } from "lucide-react";

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export default async function KOLPaymentsPage() {
  const session = await auth();

  if (!session?.user?.kolId) {
    redirect("/kol/login");
  }

  const kolId = session.user.kolId;

  // Fetch payment stats
  const [payments, completedSum, pendingSum, processingSum, walletCount] =
    await Promise.all([
      db.payment.findMany({
        where: { kolId },
        include: {
          campaign: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      db.payment.aggregate({
        where: { kolId, status: "COMPLETED" },
        _sum: { amount: true },
      }),
      db.payment.aggregate({
        where: { kolId, status: "PENDING" },
        _sum: { amount: true },
      }),
      db.payment.aggregate({
        where: { kolId, status: "PROCESSING" },
        _sum: { amount: true },
      }),
      db.kOLWallet.count({ where: { kolId } }),
    ]);

  const stats = [
    {
      name: "Total Received",
      value: formatCurrency(completedSum._sum.amount || 0),
      icon: CheckCircle,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    },
    {
      name: "Pending",
      value: formatCurrency(pendingSum._sum.amount || 0),
      icon: Clock,
      color: "text-amber-600",
      bgColor: "bg-amber-100 dark:bg-amber-900/30",
    },
    {
      name: "Processing",
      value: formatCurrency(processingSum._sum.amount || 0),
      icon: DollarSign,
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
    },
    {
      name: "Saved Wallets",
      value: walletCount,
      icon: Wallet,
      color: "text-purple-600",
      bgColor: "bg-purple-100 dark:bg-purple-900/30",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Payments</h1>
          <p className="text-muted-foreground mt-1">
            Track your earnings and manage wallets
          </p>
        </div>
        <Button asChild className="bg-purple-600 hover:bg-purple-700">
          <Link href="/kol/payments/wallets">
            <Wallet className="mr-2 h-4 w-4" />
            Manage Wallets
          </Link>
        </Button>
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

      {/* Wallet Warning */}
      {walletCount === 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-900/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Wallet className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-400">
                    No wallets configured
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-500">
                    Add a crypto wallet to receive payments
                  </p>
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/kol/payments/wallets">
                  Add Wallet <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentHistory payments={payments} />
        </CardContent>
      </Card>
    </div>
  );
}
