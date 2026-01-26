"use client";

import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";

interface Payment {
  id: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  txHash: string | null;
  walletAddress: string | null;
  network: string | null;
  notes: string | null;
  paidAt: Date | null;
  createdAt: Date;
  campaign: {
    name: string;
  } | null;
}

interface PaymentHistoryProps {
  payments: Payment[];
}

function formatCurrency(cents: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function getStatusColor(status: string): string {
  switch (status) {
    case "COMPLETED":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "PENDING":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    case "PROCESSING":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "FAILED":
    case "CANCELLED":
      return "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
  }
}

function getExplorerUrl(network: string | null, txHash: string): string | null {
  if (!network) return null;

  const explorers: Record<string, string> = {
    ETHEREUM: "https://etherscan.io/tx/",
    POLYGON: "https://polygonscan.com/tx/",
    ARBITRUM: "https://arbiscan.io/tx/",
    OPTIMISM: "https://optimistic.etherscan.io/tx/",
    BASE: "https://basescan.org/tx/",
    BSC: "https://bscscan.com/tx/",
    SOLANA: "https://solscan.io/tx/",
  };

  return explorers[network] ? `${explorers[network]}${txHash}` : null;
}

export function PaymentHistory({ payments }: PaymentHistoryProps) {
  if (payments.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No payment history yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left p-4 font-medium text-muted-foreground">Date</th>
            <th className="text-left p-4 font-medium text-muted-foreground">Campaign</th>
            <th className="text-left p-4 font-medium text-muted-foreground">Amount</th>
            <th className="text-left p-4 font-medium text-muted-foreground">Method</th>
            <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
            <th className="text-left p-4 font-medium text-muted-foreground">Transaction</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id} className="border-t">
              <td className="p-4">
                {new Date(payment.paidAt || payment.createdAt).toLocaleDateString()}
              </td>
              <td className="p-4">
                {payment.campaign?.name || "General Payment"}
              </td>
              <td className="p-4 font-medium">
                {formatCurrency(payment.amount, payment.currency)}
              </td>
              <td className="p-4">
                <div className="flex flex-col">
                  <span>{payment.method}</span>
                  {payment.network && (
                    <span className="text-xs text-muted-foreground">
                      {payment.network}
                    </span>
                  )}
                </div>
              </td>
              <td className="p-4">
                <Badge className={getStatusColor(payment.status)}>
                  {payment.status}
                </Badge>
              </td>
              <td className="p-4">
                {payment.txHash ? (
                  <a
                    href={getExplorerUrl(payment.network, payment.txHash) || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-purple-600 hover:text-purple-700 text-sm"
                  >
                    {payment.txHash.slice(0, 8)}...{payment.txHash.slice(-6)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
