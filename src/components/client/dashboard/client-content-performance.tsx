"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { FileText, CheckCircle2, Clock, XCircle, Edit } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContentPerformanceProps {
  published: number;
  approved: number;
  pending: number;
  rejected: number;
  draft: number;
}

const COLORS = {
  published: "#10b981", // emerald-500
  approved: "#06b6d4", // cyan-500
  pending: "#f59e0b", // amber-500
  rejected: "#ef4444", // red-500
  draft: "#6b7280", // gray-500
};

export function ClientContentPerformance({
  published,
  approved,
  pending,
  rejected,
  draft,
}: ContentPerformanceProps) {
  const total = published + approved + pending + rejected + draft;

  const data = [
    { name: "Published", value: published, color: COLORS.published },
    { name: "Approved", value: approved, color: COLORS.approved },
    { name: "Pending", value: pending, color: COLORS.pending },
    { name: "Rejected", value: rejected, color: COLORS.rejected },
    { name: "Draft", value: draft, color: COLORS.draft },
  ].filter((item) => item.value > 0);

  const statItems = [
    {
      label: "Published",
      value: published,
      icon: CheckCircle2,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500",
    },
    {
      label: "Approved",
      value: approved,
      icon: FileText,
      color: "text-cyan-500",
      bgColor: "bg-cyan-500",
    },
    {
      label: "Pending",
      value: pending,
      icon: Clock,
      color: "text-amber-500",
      bgColor: "bg-amber-500",
    },
    {
      label: "Rejected",
      value: rejected,
      icon: XCircle,
      color: "text-red-500",
      bgColor: "bg-red-500",
    },
    {
      label: "Draft",
      value: draft,
      icon: Edit,
      color: "text-gray-500",
      bgColor: "bg-gray-500",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Content Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          {/* Pie Chart */}
          <div className="relative h-40 w-40 flex-shrink-0">
            {total > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [value ?? 0, "Posts"]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full rounded-full border-4 border-dashed border-muted flex items-center justify-center">
                <span className="text-sm text-muted-foreground">No data</span>
              </div>
            )}
            {total > 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-2xl font-bold">{total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-2">
            {statItems.map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <div className={cn("h-2.5 w-2.5 rounded-full", item.bgColor)} />
                <div className="flex-1 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {item.label}
                  </span>
                  <span className="text-sm font-medium">{item.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
