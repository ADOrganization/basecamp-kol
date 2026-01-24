import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: "increase" | "decrease" | "neutral";
  };
  icon?: LucideIcon;
  className?: string;
}

export function MetricCard({
  title,
  value,
  change,
  icon: Icon,
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-6 shadow-sm",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {Icon && (
          <Icon className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-2xl font-bold">{value}</p>
        {change && (
          <span
            className={cn(
              "text-sm font-medium",
              change.type === "increase" && "text-teal-600",
              change.type === "decrease" && "text-rose-600",
              change.type === "neutral" && "text-muted-foreground"
            )}
          >
            {change.type === "increase" && "+"}
            {change.type === "decrease" && "-"}
            {Math.abs(change.value)}%
          </span>
        )}
      </div>
    </div>
  );
}
