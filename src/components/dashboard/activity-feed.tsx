"use client";

import { formatDistanceToNow } from "@/lib/utils";
import {
  CheckCircle,
  MessageSquare,
  UserPlus,
  Megaphone,
  TrendingUp,
  Clock,
  AlertCircle
} from "lucide-react";

interface Activity {
  id: string;
  type: "post_approved" | "post_pending" | "kol_added" | "campaign_started" | "milestone" | "alert";
  title: string;
  description: string;
  timestamp: Date;
  meta?: string;
}

interface ActivityFeedProps {
  activities: Activity[];
}

const activityIcons = {
  post_approved: { icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  post_pending: { icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
  kol_added: { icon: UserPlus, color: "text-indigo-500", bg: "bg-indigo-500/10" },
  campaign_started: { icon: Megaphone, color: "text-purple-500", bg: "bg-purple-500/10" },
  milestone: { icon: TrendingUp, color: "text-teal-500", bg: "bg-teal-500/10" },
  alert: { icon: AlertCircle, color: "text-rose-500", bg: "bg-rose-500/10" },
};

export function ActivityFeed({ activities }: ActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <MessageSquare className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {activities.map((activity, index) => {
        const { icon: Icon, color, bg } = activityIcons[activity.type];
        return (
          <div
            key={activity.id}
            className="group flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className={`p-2 rounded-lg ${bg} shrink-0`}>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-tight">{activity.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {activity.description}
              </p>
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatDistanceToNow(activity.timestamp)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
