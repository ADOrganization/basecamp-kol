"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface DataPoint {
  date: string;
  impressions: number;
  engagement: number;
}

interface EngagementTrendsProps {
  data: DataPoint[];
  weekOverWeekChange?: {
    impressions: number;
    engagement: number;
  };
}

export function ClientEngagementTrends({
  data,
  weekOverWeekChange,
}: EngagementTrendsProps) {
  const formatYAxis = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };

  const getTrendIcon = (change?: number) => {
    if (change === undefined) return <Minus className="h-3 w-3" />;
    if (change > 0) return <TrendingUp className="h-3 w-3" />;
    if (change < 0) return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  const getTrendColor = (change?: number) => {
    if (change === undefined) return "text-muted-foreground";
    if (change > 0) return "text-emerald-500";
    if (change < 0) return "text-rose-500";
    return "text-muted-foreground";
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Engagement Trends</CardTitle>
          {weekOverWeekChange && (
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Impressions</span>
                <span
                  className={cn(
                    "flex items-center gap-0.5 font-medium",
                    getTrendColor(weekOverWeekChange.impressions)
                  )}
                >
                  {getTrendIcon(weekOverWeekChange.impressions)}
                  {weekOverWeekChange.impressions > 0 ? "+" : ""}
                  {weekOverWeekChange.impressions}%
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Engagement</span>
                <span
                  className={cn(
                    "flex items-center gap-0.5 font-medium",
                    getTrendColor(weekOverWeekChange.engagement)
                  )}
                >
                  {getTrendIcon(weekOverWeekChange.engagement)}
                  {weekOverWeekChange.engagement > 0 ? "+" : ""}
                  {weekOverWeekChange.engagement}%
                </span>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No trend data available</p>
            </div>
          </div>
        ) : (
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="colorImpressions"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient
                    id="colorEngagement"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                />
                <YAxis
                  tickFormatter={formatYAxis}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value, name) => {
                    const numValue = Number(value ?? 0);
                    const strName = String(name ?? "");
                    return [
                      numValue.toLocaleString(),
                      strName.charAt(0).toUpperCase() + strName.slice(1),
                    ];
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="impressions"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorImpressions)"
                />
                <Area
                  type="monotone"
                  dataKey="engagement"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorEngagement)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-sky-500" />
            <span className="text-xs text-muted-foreground">Impressions</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-rose-500" />
            <span className="text-xs text-muted-foreground">Engagement</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
