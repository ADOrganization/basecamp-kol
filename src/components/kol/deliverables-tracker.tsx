"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Circle, FileText, MessageSquare, Repeat2, Radio } from "lucide-react";

interface DeliverablesTrackerProps {
  deliverables: {
    requiredPosts: number;
    requiredThreads: number;
    requiredRetweets: number;
    requiredSpaces: number;
    completedPosts: number;
    completedThreads: number;
    completedRetweets: number;
    completedSpaces: number;
  };
}

export function DeliverablesTracker({ deliverables }: DeliverablesTrackerProps) {
  const items = [
    {
      label: "Posts",
      icon: FileText,
      required: deliverables.requiredPosts,
      completed: deliverables.completedPosts,
      color: "purple",
    },
    {
      label: "Threads",
      icon: MessageSquare,
      required: deliverables.requiredThreads,
      completed: deliverables.completedThreads,
      color: "blue",
    },
    {
      label: "Reposts",
      icon: Repeat2,
      required: deliverables.requiredRetweets,
      completed: deliverables.completedRetweets,
      color: "emerald",
    },
    {
      label: "Spaces",
      icon: Radio,
      required: deliverables.requiredSpaces,
      completed: deliverables.completedSpaces,
      color: "amber",
    },
  ].filter((item) => item.required > 0);

  const totalRequired =
    deliverables.requiredPosts +
    deliverables.requiredThreads +
    deliverables.requiredRetweets +
    deliverables.requiredSpaces;

  const totalCompleted =
    deliverables.completedPosts +
    deliverables.completedThreads +
    deliverables.completedRetweets +
    deliverables.completedSpaces;

  const overallProgress =
    totalRequired > 0 ? Math.min(100, Math.round((totalCompleted / totalRequired) * 100)) : 0;

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Deliverables</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            No deliverables assigned for this campaign
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Deliverables</CardTitle>
          <Badge
            variant={overallProgress === 100 ? "default" : "secondary"}
            className={overallProgress === 100 ? "bg-emerald-600" : ""}
          >
            {overallProgress}% Complete
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium">
              {totalCompleted}/{totalRequired}
            </span>
          </div>
          <Progress value={overallProgress} className="h-3" />
        </div>

        {/* Individual Deliverables */}
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => {
            const progress =
              item.required > 0
                ? Math.min(100, Math.round((item.completed / item.required) * 100))
                : 0;
            const isComplete = item.completed >= item.required;

            return (
              <div
                key={item.label}
                className={`p-4 rounded-lg border ${
                  isComplete
                    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-900/10"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`p-2 rounded-lg ${
                      isComplete
                        ? "bg-emerald-100 dark:bg-emerald-900/30"
                        : `bg-${item.color}-100 dark:bg-${item.color}-900/30`
                    }`}
                  >
                    <item.icon
                      className={`h-5 w-5 ${
                        isComplete ? "text-emerald-600" : `text-${item.color}-600`
                      }`}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{item.label}</span>
                      <span className="text-sm text-muted-foreground">
                        {item.completed}/{item.required}
                      </span>
                    </div>
                  </div>
                </div>
                <Progress value={progress} className="h-2" />

                {/* Completion indicators */}
                <div className="flex gap-1 mt-3 flex-wrap">
                  {Array.from({ length: item.required }).map((_, index) => (
                    <div key={index}>
                      {index < item.completed ? (
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground/30" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
