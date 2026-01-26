"use client";

import { FileText, DollarSign, Megaphone, Clock, ExternalLink } from "lucide-react";
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
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Recent Activity</h2>
        </div>
        <div className="text-center py-8 text-muted-foreground">
          No recent activity
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="p-6 border-b">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Recent Activity</h2>
        </div>
        <p className="text-sm text-muted-foreground mt-1">Last 24 hours</p>
      </div>

      <div className="divide-y">
        {activities.slice(0, 8).map((activity) => (
          <div key={`${activity.type}-${activity.id}`} className="p-4 hover:bg-muted/50 transition-colors">
            {activity.type === 'post' ? (
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 mt-0.5">
                  <FileText className="h-4 w-4 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Avatar className="h-5 w-5 border">
                      {activity.kol.avatarUrl && <AvatarImage src={activity.kol.avatarUrl} />}
                      <AvatarFallback className="text-[10px]">{activity.kol.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-sm">{activity.kol.name}</span>
                    <span className="text-muted-foreground text-sm">submitted a post</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(activity.status)}`}>
                      {activity.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 truncate">
                    {activity.content?.slice(0, 80) || 'No content'}...
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <Link
                      href={`/agency/campaigns/${activity.campaign.id}`}
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
                        <ExternalLink className="h-3 w-3" />
                        View post
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 mt-0.5">
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5 border">
                      {activity.kol.avatarUrl && <AvatarImage src={activity.kol.avatarUrl} />}
                      <AvatarFallback className="text-[10px]">{activity.kol.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-sm">{activity.kol.name}</span>
                    <span className="text-muted-foreground text-sm">was paid</span>
                    <span className="font-semibold text-emerald-600">{formatCurrency(activity.amount)}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
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

      {activities.length > 8 && (
        <div className="p-4 border-t text-center">
          <Link href="/agency/content/review" className="text-sm text-primary hover:underline">
            View all activity
          </Link>
        </div>
      )}
    </div>
  );
}
