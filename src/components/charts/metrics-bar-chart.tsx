"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface DataPoint {
  date: string;
  [key: string]: string | number;
}

interface MetricsBarChartProps {
  data: DataPoint[];
  primaryMetric: string;
  secondaryMetric?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

const METRIC_LABELS: Record<string, string> = {
  impressions: "Impressions",
  likes: "Likes",
  retweets: "Reposts",
  replies: "Replies",
  quotes: "Quotes",
  bookmarks: "Bookmarks",
  engagementRate: "Engagement Rate",
  followersCount: "Followers",
  followersChange: "Follower Change",
};

export function MetricsBarChart({
  data,
  primaryMetric,
  secondaryMetric,
  primaryColor = "#6366f1",
  secondaryColor = "#10b981",
}: MetricsBarChartProps) {
  // Format date for display
  const formattedData = data.map((d) => ({
    ...d,
    displayDate: formatDate(d.date),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={formattedData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="displayDate"
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          className="text-muted-foreground"
        />
        <YAxis
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatYAxisValue}
          className="text-muted-foreground"
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ fill: "rgba(99, 102, 241, 0.1)" }}
        />
        {secondaryMetric && (
          <Legend
            wrapperStyle={{ paddingTop: 20 }}
            formatter={(value) => METRIC_LABELS[value] || value}
          />
        )}
        <Bar
          dataKey={primaryMetric}
          fill={primaryColor}
          radius={[4, 4, 0, 0]}
          name={primaryMetric}
        />
        {secondaryMetric && (
          <Bar
            dataKey={secondaryMetric}
            fill={secondaryColor}
            radius={[4, 4, 0, 0]}
            name={secondaryMetric}
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatYAxisValue(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toString();
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-popover border rounded-lg shadow-lg p-3">
      <p className="text-sm font-medium mb-2">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">
            {METRIC_LABELS[entry.name] || entry.name}:
          </span>
          <span className="font-medium">{entry.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
