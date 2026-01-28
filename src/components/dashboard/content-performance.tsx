"use client";

import { FileText, Hash, ArrowUpRight, ArrowDownRight, ExternalLink, TrendingUp, Eye, Heart, Repeat, MessageCircle, Quote, Bookmark } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface TopPost {
  id: string;
  content: string | null;
  tweetUrl: string | null;
  engagementRate: number;
  impressions: number;
  likes: number;
  retweets: number;
  kol: {
    name: string;
    twitterHandle: string;
    avatarUrl: string | null;
  };
  campaign: {
    name: string;
  };
}

interface ContentTypeData {
  name: string;
  value: number;
  color: string;
}

interface PerformanceMetrics {
  totalImpressions: number;
  totalLikes: number;
  totalRetweets: number;
  totalReplies: number;
  totalQuotes: number;
  totalBookmarks: number;
  totalEngagements: number;
  avgEngagementRate: number;
}

interface ContentPerformanceProps {
  postsThisMonth: number;
  postsLastMonth: number;
  topPosts: TopPost[];
  contentTypeData: ContentTypeData[];
  keywordMatchRate: number;
  totalPosts: number;
  metrics?: PerformanceMetrics;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#14b8a6', '#f59e0b'];

// Custom tooltip component
const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: ContentTypeData }> }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2">
        <p className="text-sm font-medium" style={{ color: data.payload.color }}>
          {data.name}
        </p>
        <p className="text-lg font-bold">{data.value} posts</p>
      </div>
    );
  }
  return null;
};

export function ContentPerformance({
  postsThisMonth,
  postsLastMonth,
  topPosts,
  contentTypeData,
  keywordMatchRate,
  totalPosts,
  metrics,
}: ContentPerformanceProps) {
  const postsDelta = postsLastMonth > 0
    ? ((postsThisMonth - postsLastMonth) / postsLastMonth) * 100
    : postsThisMonth > 0 ? 100 : 0;

  // Calculate total for percentage
  const totalContentPosts = contentTypeData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="rounded-xl border bg-card">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              Content Performance
            </h2>
            <p className="text-sm text-muted-foreground">Metrics that drive decisions</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4">
          {/* Posts This Month */}
          <div className="rounded-lg bg-muted/50 p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Posts This Month</span>
              {postsDelta !== 0 && (
                <span className={`flex items-center text-xs ${postsDelta > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {postsDelta > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(postsDelta).toFixed(0)}%
                </span>
              )}
            </div>
            <p className="text-2xl font-bold">{postsThisMonth}</p>
            <p className="text-xs text-muted-foreground">vs {postsLastMonth} last month</p>
          </div>

          {/* Keyword Match Rate */}
          <div className="rounded-lg bg-muted/50 p-4">
            <div className="flex items-center gap-1 mb-1">
              <Hash className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Keyword Match Rate</span>
            </div>
            <p className="text-2xl font-bold">{keywordMatchRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">of posts match keywords</p>
          </div>

          {/* Total Posts */}
          <div className="rounded-lg bg-muted/50 p-4">
            <div className="flex items-center gap-1 mb-1">
              <TrendingUp className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total Posts</span>
            </div>
            <p className="text-2xl font-bold">{formatNumber(totalPosts)}</p>
            <p className="text-xs text-muted-foreground">all time</p>
          </div>
        </div>

        {/* Diversified Performance Metrics */}
        {metrics && (
          <div>
            <h3 className="text-sm font-medium mb-3">Performance Metrics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Impressions */}
              <div className="rounded-lg bg-blue-500/10 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Eye className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-xs text-muted-foreground">Impressions</span>
                </div>
                <p className="text-lg font-bold text-blue-600">{formatNumber(metrics.totalImpressions)}</p>
              </div>

              {/* Engagements */}
              <div className="rounded-lg bg-emerald-500/10 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-xs text-muted-foreground">Engagements</span>
                </div>
                <p className="text-lg font-bold text-emerald-600">{formatNumber(metrics.totalEngagements)}</p>
              </div>

              {/* Likes */}
              <div className="rounded-lg bg-rose-500/10 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Heart className="h-3.5 w-3.5 text-rose-500" />
                  <span className="text-xs text-muted-foreground">Likes</span>
                </div>
                <p className="text-lg font-bold text-rose-600">{formatNumber(metrics.totalLikes)}</p>
              </div>

              {/* Retweets */}
              <div className="rounded-lg bg-teal-500/10 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Repeat className="h-3.5 w-3.5 text-teal-500" />
                  <span className="text-xs text-muted-foreground">Retweets</span>
                </div>
                <p className="text-lg font-bold text-teal-600">{formatNumber(metrics.totalRetweets)}</p>
              </div>

              {/* Replies */}
              <div className="rounded-lg bg-violet-500/10 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <MessageCircle className="h-3.5 w-3.5 text-violet-500" />
                  <span className="text-xs text-muted-foreground">Replies</span>
                </div>
                <p className="text-lg font-bold text-violet-600">{formatNumber(metrics.totalReplies)}</p>
              </div>

              {/* Quotes */}
              <div className="rounded-lg bg-amber-500/10 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Quote className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs text-muted-foreground">Quotes</span>
                </div>
                <p className="text-lg font-bold text-amber-600">{formatNumber(metrics.totalQuotes)}</p>
              </div>

              {/* Bookmarks */}
              <div className="rounded-lg bg-indigo-500/10 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Bookmark className="h-3.5 w-3.5 text-indigo-500" />
                  <span className="text-xs text-muted-foreground">Bookmarks</span>
                </div>
                <p className="text-lg font-bold text-indigo-600">{formatNumber(metrics.totalBookmarks)}</p>
              </div>

              {/* Avg Engagement Rate */}
              <div className="rounded-lg bg-purple-500/10 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="h-3.5 w-3.5 text-purple-500" />
                  <span className="text-xs text-muted-foreground">Avg ER</span>
                </div>
                <p className="text-lg font-bold text-purple-600">{metrics.avgEngagementRate.toFixed(2)}%</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Content Type Breakdown */}
          <div>
            <h3 className="text-sm font-medium mb-3">Content Type Breakdown</h3>
            {contentTypeData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                No content data yet
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="h-[160px] w-[160px] flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={contentTypeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {contentTypeData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color || COLORS[index % COLORS.length]}
                            className="transition-opacity hover:opacity-80"
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Legend */}
                <div className="flex-1 space-y-2">
                  {contentTypeData.map((item, index) => {
                    const percentage = totalContentPosts > 0
                      ? ((item.value / totalContentPosts) * 100).toFixed(0)
                      : 0;
                    return (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: item.color || COLORS[index % COLORS.length] }}
                          />
                          <span className="text-sm">{item.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-medium">{item.value}</span>
                          <span className="text-xs text-muted-foreground ml-1">({percentage}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Top Performing Posts */}
          <div>
            <h3 className="text-sm font-medium mb-3">Top Performing Posts</h3>
            {topPosts.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                No posts with engagement data yet
              </div>
            ) : (
              <div className="space-y-3">
                {topPosts.slice(0, 3).map((post, index) => (
                  <div key={post.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <span className="text-sm font-medium text-muted-foreground w-4 pt-1">
                      {index + 1}
                    </span>
                    <Avatar className="h-8 w-8 border">
                      {post.kol.avatarUrl && <AvatarImage src={post.kol.avatarUrl} />}
                      <AvatarFallback className="text-xs">
                        {post.kol.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">@{post.kol.twitterHandle}</span>
                        <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-600 border-0">
                          {post.engagementRate.toFixed(2)}% ER
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {post.content?.slice(0, 50) || 'No content'}...
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{formatNumber(post.impressions)} views</span>
                        <span>{formatNumber(post.likes)} likes</span>
                        {post.tweetUrl && (
                          <a
                            href={post.tweetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-0.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
