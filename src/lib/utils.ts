import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function getTierColor(tier: string): string {
  const colors: Record<string, string> = {
    NANO: "bg-slate-100 text-slate-700",
    MICRO: "bg-blue-100 text-blue-700",
    MID: "bg-purple-100 text-purple-700",
    MACRO: "bg-amber-100 text-amber-700",
    MEGA: "bg-rose-100 text-rose-700",
  };
  return colors[tier] || colors.MICRO;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    ACTIVE: "bg-teal-100 text-teal-700",
    INACTIVE: "bg-slate-100 text-slate-700",
    PENDING: "bg-amber-100 text-amber-700",
    BLACKLISTED: "bg-rose-100 text-rose-700",
    DRAFT: "bg-slate-100 text-slate-700",
    PENDING_APPROVAL: "bg-amber-100 text-amber-700",
    APPROVED: "bg-teal-100 text-teal-700",
    REJECTED: "bg-rose-100 text-rose-700",
    SCHEDULED: "bg-blue-100 text-blue-700",
    POSTED: "bg-indigo-100 text-indigo-700",
    VERIFIED: "bg-emerald-100 text-emerald-700",
    COMPLETED: "bg-emerald-100 text-emerald-700",
    CANCELLED: "bg-slate-100 text-slate-700",
    PAUSED: "bg-orange-100 text-orange-700",
    PROCESSING: "bg-blue-100 text-blue-700",
    FAILED: "bg-rose-100 text-rose-700",
    CONFIRMED: "bg-teal-100 text-teal-700",
    DECLINED: "bg-rose-100 text-rose-700",
  };
  return colors[status] || "bg-slate-100 text-slate-700";
}
