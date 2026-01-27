"use client";

import { Megaphone, Users, Calendar, AlertTriangle, CheckCircle, Clock, ArrowUpRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";

interface CampaignData {
  id: string;
  name: string;
  totalBudget: number;
  allocatedBudget: number;
  startDate: Date | null;
  endDate: Date | null;
  health: 'healthy' | 'warning' | 'critical';
  deliverables: {
    required: { posts: number; threads: number; retweets: number; spaces: number };
    completed: { posts: number; threads: number; retweets: number; spaces: number };
  };
  kolCount: number;
}

interface CampaignCommandCenterProps {
  campaigns: CampaignData[];
  totalBudget: number;
  allocatedBudget: number;
  paidOut: number;
}

function getHealthIcon(health: 'healthy' | 'warning' | 'critical') {
  switch (health) {
    case 'healthy':
      return <CheckCircle className="h-4 w-4 text-emerald-500" />;
    case 'warning':
      return <Clock className="h-4 w-4 text-amber-500" />;
    case 'critical':
      return <AlertTriangle className="h-4 w-4 text-rose-500" />;
  }
}

function getHealthLabel(health: 'healthy' | 'warning' | 'critical') {
  switch (health) {
    case 'healthy':
      return 'On Track';
    case 'warning':
      return 'Behind';
    case 'critical':
      return 'At Risk';
  }
}

function getDaysRemaining(endDate: Date | null): number | null {
  if (!endDate) return null;
  const now = new Date();
  const end = new Date(endDate);
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

function calculateOverallProgress(deliverables: CampaignData['deliverables']): number {
  const totalRequired =
    deliverables.required.posts +
    deliverables.required.threads +
    deliverables.required.retweets +
    deliverables.required.spaces;

  if (totalRequired === 0) return 0;

  const totalCompleted =
    Math.min(deliverables.completed.posts, deliverables.required.posts) +
    Math.min(deliverables.completed.threads, deliverables.required.threads) +
    Math.min(deliverables.completed.retweets, deliverables.required.retweets) +
    Math.min(deliverables.completed.spaces, deliverables.required.spaces);

  return Math.round((totalCompleted / totalRequired) * 100);
}

export function CampaignCommandCenter({
  campaigns,
  totalBudget,
  allocatedBudget,
  paidOut,
}: CampaignCommandCenterProps) {
  const upcomingDeadlines = campaigns
    .filter(c => c.endDate && getDaysRemaining(c.endDate)! <= 7 && getDaysRemaining(c.endDate)! > 0)
    .sort((a, b) => new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-purple-500" />
            Campaign Command Center
          </h2>
          <p className="text-sm text-muted-foreground">{campaigns.length} active campaigns</p>
        </div>
        <Link
          href="/agency/campaigns"
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          View all
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Budget Overview Bar */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">Budget Overview</span>
          <span className="text-sm text-muted-foreground">
            {formatCurrency(paidOut)} paid of {formatCurrency(allocatedBudget)} allocated
          </span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden flex">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${allocatedBudget > 0 ? (paidOut / allocatedBudget) * 100 : 0}%` }}
            title={`Paid: ${formatCurrency(paidOut)}`}
          />
          <div
            className="h-full bg-amber-500/50 transition-all duration-500"
            style={{ width: `${totalBudget > 0 ? ((allocatedBudget - paidOut) / totalBudget) * 100 : 0}%` }}
            title={`Allocated (unpaid): ${formatCurrency(allocatedBudget - paidOut)}`}
          />
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Paid Out
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500/50" />
            Allocated (Unpaid)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-muted" />
            Unallocated
          </span>
        </div>
      </div>

      {/* Upcoming Deadlines Alert */}
      {upcomingDeadlines.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
              Upcoming Deadlines
            </span>
          </div>
          <div className="space-y-1">
            {upcomingDeadlines.slice(0, 3).map(campaign => {
              const days = getDaysRemaining(campaign.endDate);
              return (
                <Link
                  key={campaign.id}
                  href={`/agency/campaigns/${campaign.id}`}
                  className="flex items-center justify-between text-sm hover:underline"
                >
                  <span>{campaign.name}</span>
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    {days === 1 ? '1 day left' : `${days} days left`}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Campaign List */}
      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border bg-card">
          <Megaphone className="h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No active campaigns</p>
          <Link
            href="/agency/campaigns?action=new"
            className="mt-3 text-sm text-primary hover:underline"
          >
            Create your first campaign
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {campaigns.slice(0, 4).map((campaign) => {
            const progress = calculateOverallProgress(campaign.deliverables);
            const daysRemaining = getDaysRemaining(campaign.endDate);
            const budgetProgress = campaign.totalBudget > 0
              ? Math.round((campaign.allocatedBudget / campaign.totalBudget) * 100)
              : 0;

            return (
              <Link
                key={campaign.id}
                href={`/agency/campaigns/${campaign.id}`}
                className="block rounded-xl border bg-card p-4 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{campaign.name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {campaign.kolCount} KOLs
                      </span>
                      {daysRemaining !== null && daysRemaining > 0 && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {daysRemaining}d left
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-medium" title={getHealthLabel(campaign.health)}>
                    {getHealthIcon(campaign.health)}
                    <span className={
                      campaign.health === 'healthy' ? 'text-emerald-600' :
                      campaign.health === 'warning' ? 'text-amber-600' : 'text-rose-600'
                    }>
                      {getHealthLabel(campaign.health)}
                    </span>
                  </div>
                </div>

                {/* Deliverables Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Deliverables</span>
                    <span className="font-medium">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />

                  {/* Mini deliverables breakdown */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {campaign.deliverables.required.posts > 0 && (
                      <span className={campaign.deliverables.completed.posts >= campaign.deliverables.required.posts ? 'text-emerald-600' : ''}>
                        Posts: {campaign.deliverables.completed.posts}/{campaign.deliverables.required.posts}
                      </span>
                    )}
                    {campaign.deliverables.required.threads > 0 && (
                      <span className={campaign.deliverables.completed.threads >= campaign.deliverables.required.threads ? 'text-emerald-600' : ''}>
                        Threads: {campaign.deliverables.completed.threads}/{campaign.deliverables.required.threads}
                      </span>
                    )}
                    {campaign.deliverables.required.retweets > 0 && (
                      <span className={campaign.deliverables.completed.retweets >= campaign.deliverables.required.retweets ? 'text-emerald-600' : ''}>
                        RTs: {campaign.deliverables.completed.retweets}/{campaign.deliverables.required.retweets}
                      </span>
                    )}
                  </div>
                </div>

                {/* Budget bar */}
                <div className="mt-3 pt-3 border-t">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Budget</span>
                    <span>{formatCurrency(campaign.allocatedBudget)} / {formatCurrency(campaign.totalBudget)}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                      style={{ width: `${budgetProgress}%` }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
