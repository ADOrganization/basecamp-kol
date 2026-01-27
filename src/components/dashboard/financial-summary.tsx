"use client";

import { DollarSign, CreditCard, TrendingUp, BarChart3, ArrowUpRight } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

interface PaymentStatus {
  status: string;
  count: number;
  amount: number;
}

interface FinancialSummaryProps {
  totalAllocated: number;
  totalPaid: number;
  pendingPayments: {
    count: number;
    amount: number;
  };
  cpm: number; // Cost per 1000 impressions
  cpe: number; // Cost per engagement
  paymentsByStatus: PaymentStatus[];
  recentMonthlySpend: { month: string; amount: number }[];
}

// Custom tooltip for the chart
const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-bold text-emerald-600">
          {formatCurrency(payload[0].value)}
        </p>
      </div>
    );
  }
  return null;
};

export function FinancialSummary({
  totalAllocated,
  totalPaid,
  pendingPayments,
  cpm,
  cpe,
  paymentsByStatus,
  recentMonthlySpend,
}: FinancialSummaryProps) {
  // Calculate payment completion rate
  const paymentCompletionRate = totalAllocated > 0
    ? (totalPaid / totalAllocated) * 100
    : 0;

  // Process monthly spend for chart (convert cents to dollars)
  const chartData = recentMonthlySpend.map(item => ({
    month: item.month,
    amount: item.amount / 100,
  }));

  // Get max value for chart gradient
  const maxSpend = Math.max(...chartData.map(d => d.amount), 1);

  return (
    <div className="rounded-xl border bg-card">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-500" />
              Financial Summary
            </h2>
            <p className="text-sm text-muted-foreground">Budget and payment overview</p>
          </div>
          <Link
            href="/payments"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            View all payments
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Key Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Allocated */}
          <div className="rounded-lg bg-muted/50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total Allocated</span>
            </div>
            <p className="text-xl font-bold">{formatCurrency(totalAllocated)}</p>
          </div>

          {/* Total Paid */}
          <div className="rounded-lg bg-emerald-500/10 p-4">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Total Paid</span>
            </div>
            <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalPaid)}</p>
            <p className="text-xs text-muted-foreground">{paymentCompletionRate.toFixed(0)}% of allocated</p>
          </div>

          {/* Pending Payments */}
          <div className="rounded-lg bg-amber-500/10 p-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Pending</span>
            </div>
            <p className="text-xl font-bold text-amber-600">{formatCurrency(pendingPayments.amount)}</p>
            <p className="text-xs text-muted-foreground">{pendingPayments.count} payments</p>
          </div>

          {/* Processing */}
          <div className="rounded-lg bg-blue-500/10 p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Processing</span>
            </div>
            <p className="text-xl font-bold text-blue-600">
              {formatCurrency(paymentsByStatus.find(p => p.status === 'PROCESSING')?.amount || 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              {paymentsByStatus.find(p => p.status === 'PROCESSING')?.count || 0} payments
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Efficiency Metrics */}
          <div>
            <h3 className="text-sm font-medium mb-3">Cost Efficiency</h3>
            <div className="space-y-3">
              {/* CPM */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium">CPM</p>
                  <p className="text-xs text-muted-foreground">Cost per 1,000 impressions</p>
                </div>
                <p className="text-2xl font-bold">
                  {cpm > 0 ? `$${cpm.toFixed(2)}` : '-'}
                </p>
              </div>

              {/* CPE */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium">CPE</p>
                  <p className="text-xs text-muted-foreground">Cost per engagement</p>
                </div>
                <p className="text-2xl font-bold">
                  {cpe > 0 ? `$${cpe.toFixed(2)}` : '-'}
                </p>
              </div>

              {/* Payment Completion */}
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Payment Progress</span>
                  <span className="text-sm font-medium">{paymentCompletionRate.toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all"
                    style={{ width: `${Math.min(paymentCompletionRate, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Spend Chart */}
          <div>
            <h3 className="text-sm font-medium mb-3">Monthly Spend</h3>
            {chartData.every(d => d.amount === 0) ? (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm rounded-lg bg-muted/30">
                No spend data yet
              </div>
            ) : (
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => value > 0 ? `$${formatNumber(value)}` : '$0'}
                      width={50}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="url(#spendGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
