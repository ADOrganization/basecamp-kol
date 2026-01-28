"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle2, Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeliverableKOL {
  name: string;
  twitterHandle: string;
  avatarUrl: string | null;
  requiredPosts: number;
  deliveredPosts: number;
}

interface DeliverablesProgressProps {
  deliverables: DeliverableKOL[];
}

export function ClientContentPerformance({ deliverables }: DeliverablesProgressProps) {
  const totalRequired = deliverables.reduce((sum, d) => sum + d.requiredPosts, 0);
  const totalDelivered = deliverables.reduce((sum, d) => sum + d.deliveredPosts, 0);
  const overallPercent = totalRequired > 0 ? Math.min(100, Math.round((totalDelivered / totalRequired) * 100)) : 0;

  const sorted = [...deliverables]
    .filter(d => d.requiredPosts > 0)
    .sort((a, b) => {
      const pctA = a.requiredPosts > 0 ? a.deliveredPosts / a.requiredPosts : 0;
      const pctB = b.requiredPosts > 0 ? b.deliveredPosts / b.requiredPosts : 0;
      return pctB - pctA;
    });

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-4 w-4 text-emerald-500" />
          Deliverables Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        {totalRequired > 0 ? (
          <div className="space-y-4">
            {/* Overall summary */}
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={cn(
                    "h-4 w-4",
                    overallPercent >= 100 ? "text-emerald-500" : "text-muted-foreground"
                  )} />
                  <span className="text-sm font-medium">Overall Delivery</span>
                </div>
                <span className="text-sm font-bold">{totalDelivered} / {totalRequired}</span>
              </div>
              <Progress value={overallPercent} className="h-3" />
              <p className="text-xs text-muted-foreground mt-1.5">
                {overallPercent}% complete
              </p>
            </div>

            {/* Per-KOL breakdown */}
            <div className="space-y-3">
              {sorted.map((d, i) => {
                const pct = d.requiredPosts > 0 ? Math.min(100, Math.round((d.deliveredPosts / d.requiredPosts) * 100)) : 0;
                const isComplete = pct >= 100;
                return (
                  <div key={`${d.twitterHandle}-${i}`} className="flex items-center gap-3">
                    <Avatar className="h-7 w-7 flex-shrink-0">
                      <AvatarImage src={d.avatarUrl || undefined} />
                      <AvatarFallback className="text-xs">{d.name?.charAt(0) || "K"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium truncate">@{d.twitterHandle}</span>
                        <span className={cn(
                          "text-xs flex-shrink-0 ml-2",
                          isComplete ? "text-emerald-600 font-medium" : "text-muted-foreground"
                        )}>
                          {d.deliveredPosts}/{d.requiredPosts}
                        </span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm">No deliverable requirements set</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
