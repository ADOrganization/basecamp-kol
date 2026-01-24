"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface CampaignPerformanceChartProps {
  data: {
    name: string;
    budget: number;
    spent: number;
    posts: number;
  }[];
}

export function CampaignPerformanceChart({ data }: CampaignPerformanceChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }} barGap={8}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis
          dataKey="name"
          stroke="#64748b"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#64748b"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `$${(value / 100000).toFixed(0)}k`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#0f172a",
            border: "1px solid #1e293b",
            borderRadius: "8px",
            color: "#f8fafc",
          }}
          formatter={(value, name) => [
            `$${(Number(value) / 100).toLocaleString()}`,
            name === "budget" ? "Budget" : "Spent",
          ]}
        />
        <Bar dataKey="budget" fill="#6366f1" radius={[4, 4, 0, 0]} name="Budget">
          {data.map((_, index) => (
            <Cell key={`budget-${index}`} fill="#6366f1" fillOpacity={0.3} />
          ))}
        </Bar>
        <Bar dataKey="spent" fill="#14b8a6" radius={[4, 4, 0, 0]} name="Spent">
          {data.map((_, index) => (
            <Cell key={`spent-${index}`} fill="#14b8a6" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
