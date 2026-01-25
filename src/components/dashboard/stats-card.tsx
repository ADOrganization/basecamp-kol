"use client";

import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  accentColor: "indigo" | "teal" | "purple" | "amber" | "rose" | "emerald";
  className?: string;
}

const colorMap = {
  indigo: {
    icon: "text-indigo-400",
    iconBg: "bg-indigo-500/20",
    hover: "hover:border-indigo-500/50",
    gradient: "from-indigo-500/10",
  },
  teal: {
    icon: "text-teal-400",
    iconBg: "bg-teal-500/20",
    hover: "hover:border-teal-500/50",
    gradient: "from-teal-500/10",
  },
  purple: {
    icon: "text-purple-400",
    iconBg: "bg-purple-500/20",
    hover: "hover:border-purple-500/50",
    gradient: "from-purple-500/10",
  },
  amber: {
    icon: "text-amber-400",
    iconBg: "bg-amber-500/20",
    hover: "hover:border-amber-500/50",
    gradient: "from-amber-500/10",
  },
  rose: {
    icon: "text-rose-400",
    iconBg: "bg-rose-500/20",
    hover: "hover:border-rose-500/50",
    gradient: "from-rose-500/10",
  },
  emerald: {
    icon: "text-emerald-400",
    iconBg: "bg-emerald-500/20",
    hover: "hover:border-emerald-500/50",
    gradient: "from-emerald-500/10",
  },
};

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  accentColor,
  className,
}: StatsCardProps) {
  const colors = colorMap[accentColor];

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 border border-slate-800 transition-all duration-300",
        colors.hover,
        className
      )}
    >
      {/* Hover gradient overlay */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br to-transparent opacity-0 group-hover:opacity-100 transition-opacity",
          colors.gradient
        )}
      />

      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className={cn("p-2 rounded-lg", colors.iconBg)}>
            <Icon className={cn("h-5 w-5", colors.icon)} />
          </div>
          {trend && (
            <span
              className={cn(
                "flex items-center text-xs font-medium",
                trend.value >= 0 ? "text-emerald-400" : "text-rose-400"
              )}
            >
              {trend.value >= 0 ? (
                <TrendingUp className="h-3 w-3 mr-0.5" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-0.5" />
              )}
              {trend.value >= 0 ? "+" : ""}
              {trend.value}%
            </span>
          )}
        </div>

        {/* Value */}
        <p className="text-3xl font-bold text-white mb-1 tracking-tight">
          {value}
        </p>

        {/* Title */}
        <p className="text-sm text-slate-400">{title}</p>

        {/* Subtitle */}
        {subtitle && (
          <p className="text-xs text-slate-500 mt-2">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
