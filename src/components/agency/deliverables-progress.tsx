"use client";

import { FileText, MessageSquare, Repeat2, Radio, CheckCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface DeliverableItem {
  type: "POST" | "THREAD" | "RETWEET" | "SPACE";
  required: number;
  completed: number;
}

interface DeliverablesProgressProps {
  deliverables: DeliverableItem[];
  compact?: boolean;
  className?: string;
}

const deliverableConfig = {
  POST: { label: "Posts", icon: FileText, color: "text-blue-600", bg: "bg-blue-100" },
  THREAD: { label: "Threads", icon: MessageSquare, color: "text-violet-600", bg: "bg-violet-100" },
  RETWEET: { label: "Retweets", icon: Repeat2, color: "text-teal-600", bg: "bg-teal-100" },
  SPACE: { label: "Spaces", icon: Radio, color: "text-amber-600", bg: "bg-amber-100" },
};

export function DeliverablesProgress({ deliverables, compact = false, className }: DeliverablesProgressProps) {
  // Filter out deliverables with 0 required
  const activeDeliverables = deliverables.filter(d => d.required > 0);

  if (activeDeliverables.length === 0) {
    return <span className="text-sm text-muted-foreground">No deliverables set</span>;
  }

  // Calculate overall progress
  const totalRequired = activeDeliverables.reduce((sum, d) => sum + d.required, 0);
  const totalCompleted = activeDeliverables.reduce((sum, d) => sum + Math.min(d.completed, d.required), 0);
  const overallProgress = totalRequired > 0 ? Math.round((totalCompleted / totalRequired) * 100) : 0;

  if (compact) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        {activeDeliverables.map((d) => {
          const config = deliverableConfig[d.type];
          const Icon = config.icon;
          const isComplete = d.completed >= d.required;

          return (
            <div
              key={d.type}
              className={cn(
                "flex items-center gap-1.5 text-sm",
                isComplete ? "text-green-600" : "text-muted-foreground"
              )}
              title={`${config.label}: ${d.completed}/${d.required}`}
            >
              <Icon className="h-4 w-4" />
              <span className="font-medium">
                {d.completed}/{d.required}
              </span>
              {isComplete && <CheckCircle className="h-3.5 w-3.5" />}
            </div>
          );
        })}
        <span className={cn(
          "text-sm font-medium",
          overallProgress === 100 ? "text-green-600" : "text-muted-foreground"
        )}>
          ({overallProgress}%)
        </span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Overall Progress */}
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="text-muted-foreground">Overall Progress</span>
        <span className={cn(
          "font-medium",
          overallProgress === 100 ? "text-green-600" : ""
        )}>
          {overallProgress}%
        </span>
      </div>
      <Progress value={overallProgress} className="h-2" />

      {/* Individual Deliverables */}
      <div className="grid gap-2 pt-2">
        {activeDeliverables.map((d) => {
          const config = deliverableConfig[d.type];
          const Icon = config.icon;
          const progress = Math.round((Math.min(d.completed, d.required) / d.required) * 100);
          const isComplete = d.completed >= d.required;

          return (
            <div key={d.type} className="flex items-center gap-3">
              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", config.bg)}>
                <Icon className={cn("h-4 w-4", config.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{config.label}</span>
                  <span className={cn(
                    "flex items-center gap-1",
                    isComplete ? "text-green-600" : "text-muted-foreground"
                  )}>
                    {d.completed}/{d.required}
                    {isComplete && <CheckCircle className="h-3.5 w-3.5" />}
                  </span>
                </div>
                <Progress value={progress} className="h-1.5 mt-1" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Helper to calculate deliverables from posts
export function calculateDeliverables(
  posts: { type: string | null; status: string | null }[],
  required: { posts: number; threads: number; retweets: number; spaces: number }
): DeliverableItem[] {
  // Only count posts that are POSTED or VERIFIED
  const countedStatuses = ["POSTED", "VERIFIED"];

  const counts = {
    POST: posts.filter(p => p.type === "POST" && p.status && countedStatuses.includes(p.status)).length,
    THREAD: posts.filter(p => p.type === "THREAD" && p.status && countedStatuses.includes(p.status)).length,
    RETWEET: posts.filter(p => p.type === "RETWEET" && p.status && countedStatuses.includes(p.status)).length,
    SPACE: posts.filter(p => p.type === "SPACE" && p.status && countedStatuses.includes(p.status)).length,
  };

  return [
    { type: "POST", required: required.posts, completed: counts.POST },
    { type: "THREAD", required: required.threads, completed: counts.THREAD },
    { type: "RETWEET", required: required.retweets, completed: counts.RETWEET },
    { type: "SPACE", required: required.spaces, completed: counts.SPACE },
  ];
}
