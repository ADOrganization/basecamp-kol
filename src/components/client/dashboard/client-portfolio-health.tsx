"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import {
  Eye,
  Heart,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Minus,
} from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface PortfolioHealthProps {
  totalImpressions: number;
  totalEngagement: number;
  engagementRate: string;
  publishedPosts: number;
  totalPosts: number;
  // Week over week comparison (optional)
  impressionsChange?: number;
  engagementChange?: number;
  rateChange?: number;
  postsChange?: number;
}

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

export function ClientPortfolioHealth({
  totalImpressions,
  totalEngagement,
  engagementRate,
  publishedPosts,
  totalPosts,
  impressionsChange,
  engagementChange,
  rateChange,
  postsChange,
}: PortfolioHealthProps) {
  const metrics = [
    {
      label: "Total Impressions",
      value: formatNumber(totalImpressions),
      change: impressionsChange,
      icon: Eye,
      color: "text-sky-500",
      bgColor: "bg-sky-500/10",
    },
    {
      label: "Total Engagement",
      value: formatNumber(totalEngagement),
      change: engagementChange,
      icon: Heart,
      color: "text-rose-500",
      bgColor: "bg-rose-500/10",
    },
    {
      label: "Engagement Rate",
      value: `${engagementRate}%`,
      change: rateChange,
      icon: TrendingUp,
      color: "text-indigo-500",
      bgColor: "bg-indigo-500/10",
    },
    {
      label: "Published Posts",
      value: `${publishedPosts}`,
      subValue: `of ${totalPosts}`,
      change: postsChange,
      icon: CheckCircle2,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric, index) => (
        <motion.div
          key={metric.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1, duration: 0.4 }}
        >
          <Card className="relative overflow-hidden hover:shadow-lg transition-shadow">
            <div
              className={cn(
                "absolute top-0 right-0 w-24 h-24 rounded-full -mr-12 -mt-12",
                metric.bgColor
              )}
            />
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div
                  className={cn(
                    "h-10 w-10 rounded-lg flex items-center justify-center",
                    metric.bgColor
                  )}
                >
                  <metric.icon className={cn("h-5 w-5", metric.color)} />
                </div>
                {metric.change !== undefined && (
                  <div
                    className={cn(
                      "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
                      metric.change > 0 ? "bg-emerald-100 text-emerald-700" : "",
                      metric.change < 0 ? "bg-rose-100 text-rose-700" : "",
                      metric.change === 0 ? "bg-gray-100 text-gray-600" : ""
                    )}
                  >
                    {getTrendIcon(metric.change)}
                    <span>
                      {metric.change > 0 ? "+" : ""}
                      {metric.change}%
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">{metric.label}</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-2xl font-bold">{metric.value}</p>
                  {metric.subValue && (
                    <span className="text-sm text-muted-foreground">
                      {metric.subValue}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
