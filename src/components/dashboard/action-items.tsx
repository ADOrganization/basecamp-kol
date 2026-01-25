"use client";

import Link from "next/link";
import {
  FileText,
  AlertTriangle,
  Clock,
  CheckCircle,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ActionItem {
  type: "review_posts" | "campaign_ending" | "low_budget" | "milestone";
  title: string;
  count?: number;
  link: string;
  urgency: "high" | "medium" | "low";
}

interface ActionItemsProps {
  items: ActionItem[];
}

const itemConfig = {
  review_posts: {
    icon: FileText,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    borderColor: "border-amber-500/30"
  },
  campaign_ending: {
    icon: Clock,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    borderColor: "border-purple-500/30"
  },
  low_budget: {
    icon: AlertTriangle,
    color: "text-rose-500",
    bg: "bg-rose-500/10",
    borderColor: "border-rose-500/30"
  },
  milestone: {
    icon: CheckCircle,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30"
  },
};

const urgencyColors = {
  high: "border-l-rose-500",
  medium: "border-l-amber-500",
  low: "border-l-slate-400",
};

export function ActionItems({ items }: ActionItemsProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <CheckCircle className="h-10 w-10 text-emerald-500 mb-3" />
        <p className="text-sm font-medium text-emerald-600">All caught up!</p>
        <p className="text-xs text-muted-foreground mt-1">No pending actions</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => {
        const config = itemConfig[item.type];
        const Icon = config.icon;

        return (
          <Link
            key={index}
            href={item.link}
            className={`
              group flex items-center gap-3 p-3 rounded-lg border-l-4 bg-muted/30
              hover:bg-muted/60 transition-all
              ${urgencyColors[item.urgency]}
            `}
          >
            <div className={`p-2 rounded-lg ${config.bg}`}>
              <Icon className={`h-4 w-4 ${config.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{item.title}</p>
              {item.count && (
                <p className="text-xs text-muted-foreground">
                  {item.count} item{item.count !== 1 ? "s" : ""} need attention
                </p>
              )}
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        );
      })}
    </div>
  );
}
