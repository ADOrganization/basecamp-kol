"use client";

import { FileText, DollarSign, Clock, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface PostActivity {
  type: 'post';
  id: string;
  content: string | null;
  tweetUrl: string | null;
  createdAt: Date;
  status: string;
  kol: {
    name: string;
    avatarUrl: string | null;
  };
  campaign: {
    name: string;
    id: string;
  };
}

interface PaymentActivity {
  type: 'payment';
  id: string;
  amount: number;
  paidAt: Date | null;
  kol: {
    name: string;
    avatarUrl: string | null;
  };
}

type Activity = PostActivity | PaymentActivity;

interface ActivityFeedProps {
  activities: Activity[];
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    POSTED: 'text-emerald-600 bg-emerald-500/10',
    VERIFIED: 'text-emerald-600 bg-emerald-500/10',
    PENDING_APPROVAL: 'text-amber-600 bg-amber-500/10',
    APPROVED: 'text-blue-600 bg-blue-500/10',
    REJECTED: 'text-rose-600 bg-rose-500/10',
    DRAFT: 'text-gray-600 bg-gray-500/10',
  };
  return colors[status] || 'text-gray-600 bg-gray-500/10';
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <div className="rounded-xl border bg-card">
        <div className="px-5 py-4 border-b">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Recent Activity
          </h2>
        </div>
        <div className="text-center py-8 text-muted-foreground text-sm">
          No recent activity
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="px-5 py-4 border-b">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Recent Activity
        </h2>
      </div>

      <div className="divide-y">
        {activities.slice(0, 6).map((activity) => (
          <div key={`${activity.type}-${activity.id}`} className="px-5 py-3 hover:bg-muted/50 transition-colors">
            {activity.type === 'post' ? (
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 rounded-md bg-blue-500/10 mt-0.5">
                  <FileText className="h-3.5 w-3.5 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Avatar className="h-4 w-4 border">
                      {activity.kol.avatarUrl && <AvatarImage src={activity.kol.avatarUrl} />}
                      <AvatarFallback className="text-[8px]">{activity.kol.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-xs">{activity.kol.name}</span>
                    <span className="text-muted-foreground text-xs">posted</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${getStatusColor(activity.status)}`}>
                      {activity.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {activity.content?.slice(0, 60) || 'No content'}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                    <Link
                      href={`/campaigns/${activity.campaign.id}`}
                      className="hover:underline"
                    >
                      {activity.campaign.name}
                    </Link>
                    <span>{formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}</span>
                    {activity.tweetUrl && (
                      <a
                        href={activity.tweetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-0.5"
                      >
                        <ExternalLink className="h-2.5 w-2.5" />
                        View
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 rounded-md bg-emerald-500/10 mt-0.5">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Avatar className="h-4 w-4 border">
                      {activity.kol.avatarUrl && <AvatarImage src={activity.kol.avatarUrl} />}
                      <AvatarFallback className="text-[8px]">{activity.kol.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-xs">{activity.kol.name}</span>
                    <span className="text-muted-foreground text-xs">paid</span>
                    <span className="font-semibold text-xs text-emerald-600">{formatCurrency(activity.amount)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                    <span>Payment completed</span>
                    {activity.paidAt && (
                      <span>{formatDistanceToNow(new Date(activity.paidAt), { addSuffix: true })}</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
