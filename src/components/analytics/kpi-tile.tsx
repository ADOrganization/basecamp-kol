"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KPITileProps {
  label: string;
  value: string | number;
  delta?: number | null;
  format?: "number" | "percentage" | "compact";
  className?: string;
}

export function KPITile({ label, value, delta, format = "number", className }: KPITileProps) {
  const formattedValue = formatValue(value, format);

  const getDeltaColor = (delta: number) => {
    if (delta > 0) return "text-emerald-500";
    if (delta < 0) return "text-rose-500";
    return "text-muted-foreground";
  };

  const getDeltaIcon = (delta: number) => {
    if (delta > 0) return <TrendingUp className="h-3 w-3" />;
    if (delta < 0) return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  return (
    <div className={cn("rounded-lg bg-muted/50 p-4", className)}>
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold">{formattedValue}</p>
      {delta !== undefined && delta !== null && (
        <div className={cn("flex items-center gap-1 mt-1 text-sm", getDeltaColor(delta))}>
          {getDeltaIcon(delta)}
          <span>{delta > 0 ? "+" : ""}{delta.toFixed(1)}%</span>
          <span className="text-muted-foreground text-xs">vs prev</span>
        </div>
      )}
    </div>
  );
}

function formatValue(value: string | number, format: "number" | "percentage" | "compact"): string {
  if (typeof value === "string") return value;

  switch (format) {
    case "percentage":
      return `${value.toFixed(1)}%`;
    case "compact":
      return formatCompact(value);
    case "number":
    default:
      return value.toLocaleString();
  }
}

function formatCompact(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}
