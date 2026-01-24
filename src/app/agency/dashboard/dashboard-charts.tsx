"use client";

import { EngagementChart } from "@/components/charts/engagement-chart";
import { KolTierChart } from "@/components/charts/kol-tier-chart";
import { CampaignPerformanceChart } from "@/components/charts/campaign-performance-chart";

interface DashboardChartsProps {
  trendData: {
    date: string;
    impressions: number;
    engagement: number;
  }[];
  tierChartData: {
    name: string;
    value: number;
    color: string;
  }[];
  campaignPerformance: {
    name: string;
    budget: number;
    spent: number;
    posts: number;
  }[];
}

export function DashboardCharts({
  trendData,
  tierChartData,
  campaignPerformance,
}: DashboardChartsProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Engagement Trend Chart */}
      <div className="lg:col-span-2 rounded-xl border bg-card p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold">Engagement Trends</h2>
          <p className="text-sm text-muted-foreground">Impressions and engagement over the last 7 days</p>
        </div>
        <EngagementChart data={trendData} />
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-indigo-500" />
            <span className="text-sm text-muted-foreground">Impressions</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-teal-500" />
            <span className="text-sm text-muted-foreground">Engagement</span>
          </div>
        </div>
      </div>

      {/* KOL Tier Distribution */}
      <div className="rounded-xl border bg-card p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">KOL Distribution</h2>
          <p className="text-sm text-muted-foreground">By follower tier</p>
        </div>
        {tierChartData.length > 0 ? (
          <KolTierChart data={tierChartData} />
        ) : (
          <div className="flex items-center justify-center h-[280px] text-muted-foreground">
            No KOL data available
          </div>
        )}
      </div>

      {/* Campaign Performance */}
      {campaignPerformance.length > 0 && (
        <div className="lg:col-span-3 rounded-xl border bg-card p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold">Campaign Budget Performance</h2>
            <p className="text-sm text-muted-foreground">Budget vs. spend across active campaigns</p>
          </div>
          <CampaignPerformanceChart data={campaignPerformance} />
          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-indigo-500/30" />
              <span className="text-sm text-muted-foreground">Total Budget</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-teal-500" />
              <span className="text-sm text-muted-foreground">Amount Spent</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
