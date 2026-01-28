"use client";

import { DollarSign, CreditCard } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  Area,
  AreaChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
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
  cpm: number;
  cpe: number;
  paymentsByStatus: PaymentStatus[];
  recentMonthlySpend: { month: string; amount: number }[];
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-bold text-emerald-600">
          ${payload[0].value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>
    );
  }
  return null;
};

export function FinancialSummary({
  totalAllocated,
  totalPaid,
  cpm,
  cpe,
  recentMonthlySpend,
}: FinancialSummaryProps) {
  const paymentCompletionRate = totalAllocated > 0
    ? (totalPaid / totalAllocated) * 100
    : 0;

  const chartData = recentMonthlySpend.map(item => ({
    month: item.month,
    amount: item.amount / 100,
  }));

  return (
    <div className="rounded-xl border bg-card">
      <div className="px-5 py-4 border-b">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-emerald-500" />
          Financial Summary
        </h2>
      </div>

      <div className="p-5 space-y-4">
        {/* Key Metrics - 2 cards only */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Allocated</span>
            </div>
            <p className="text-lg font-bold">{formatCurrency(totalAllocated)}</p>
          </div>
          <div className="rounded-lg bg-emerald-500/10 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <CreditCard className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Paid Out</span>
            </div>
            <p className="text-lg font-bold text-emerald-600">{formatCurrency(totalPaid)}</p>
            <p className="text-[10px] text-muted-foreground">{paymentCompletionRate.toFixed(0)}% of allocated</p>
          </div>
        </div>

        {/* Cost Efficiency - inline row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="text-xs font-medium">CPM</p>
              <p className="text-[10px] text-muted-foreground">per 1K impressions</p>
            </div>
            <p className="text-lg font-bold">{cpm > 0 ? `$${cpm.toFixed(2)}` : '-'}</p>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="text-xs font-medium">CPE</p>
              <p className="text-[10px] text-muted-foreground">per engagement</p>
            </div>
            <p className="text-lg font-bold">{cpe > 0 ? `$${cpe.toFixed(2)}` : '-'}</p>
          </div>
        </div>

        {/* Payment Progress Bar */}
        <div className="p-3 rounded-lg bg-muted/50">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium">Payment Progress</span>
            <span className="text-xs font-medium">{paymentCompletionRate.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all"
              style={{ width: `${Math.min(paymentCompletionRate, 100)}%` }}
            />
          </div>
        </div>

        {/* Monthly Spend Chart - compact */}
        <div>
          <h3 className="text-xs font-medium mb-2">Monthly Spend</h3>
          {chartData.every(d => d.amount === 0) ? (
            <div className="h-[120px] flex items-center justify-center text-muted-foreground text-xs rounded-lg bg-muted/30">
              No spend data yet
            </div>
          ) : (
            <div className="h-[120px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => value > 0 ? `$${formatNumber(value)}` : '$0'}
                    width={45}
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
  );
}
