import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import {
  Calendar,
  Users,
  FileText,
  DollarSign,
  Clock,
  ArrowRight,
  Timer,
} from "lucide-react";

interface CampaignCardProps {
  campaign: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    totalBudget: number;
    spentBudget: number;
    startDate: string | null;
    endDate: string | null;
    projectTwitterHandle: string | null;
    projectAvatarUrl: string | null;
    projectBannerUrl: string | null;
    client: { id: string; name: string } | null;
    _count: {
      campaignKols: number;
      posts: number;
    };
  };
  viewMode?: "grid" | "list";
}

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  ACTIVE: { bg: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-500/30" },
  DRAFT: { bg: "bg-slate-500/10", text: "text-slate-600", border: "border-slate-500/30" },
  PENDING_APPROVAL: { bg: "bg-amber-500/10", text: "text-amber-600", border: "border-amber-500/30" },
  PAUSED: { bg: "bg-orange-500/10", text: "text-orange-600", border: "border-orange-500/30" },
  COMPLETED: { bg: "bg-blue-500/10", text: "text-blue-600", border: "border-blue-500/30" },
  CANCELLED: { bg: "bg-rose-500/10", text: "text-rose-600", border: "border-rose-500/30" },
};

function getTimeRemaining(endDate: string | null): string | null {
  if (!endDate) return null;
  const end = new Date(endDate);
  const now = new Date();
  const diff = end.getTime() - now.getTime();

  if (diff < 0) return "Ended";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days > 30) return `${Math.floor(days / 30)}mo left`;
  if (days > 0) return `${days}d left`;

  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours > 0) return `${hours}h left`;

  return "Ending soon";
}

export function CampaignCard({ campaign, viewMode = "grid" }: CampaignCardProps) {
  const budgetProgress = campaign.totalBudget > 0
    ? (campaign.spentBudget / campaign.totalBudget) * 100
    : 0;

  const statusStyle = STATUS_STYLES[campaign.status] || STATUS_STYLES.DRAFT;
  const timeRemaining = campaign.status === "ACTIVE" ? getTimeRemaining(campaign.endDate) : null;

  // List view
  if (viewMode === "list") {
    return (
      <Link
        href={`/agency/campaigns/${campaign.id}`}
        className="group flex items-center gap-4 rounded-xl border bg-card p-4 hover:shadow-md hover:border-primary/30 transition-all"
      >
        {/* Avatar */}
        <div className="flex-shrink-0">
          {campaign.projectAvatarUrl ? (
            <img
              src={campaign.projectAvatarUrl}
              alt={campaign.name}
              className="h-14 w-14 rounded-xl object-cover ring-2 ring-border"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                if (fallback) fallback.classList.remove('hidden');
              }}
            />
          ) : null}
          <div className={cn(
            campaign.projectAvatarUrl ? 'hidden' : '',
            "h-14 w-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg"
          )}>
            {campaign.name.charAt(0).toUpperCase()}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{campaign.name}</h3>
            <Badge className={cn(statusStyle.bg, statusStyle.text, statusStyle.border, "text-xs border")}>
              {campaign.status.replace("_", " ")}
            </Badge>
            {timeRemaining && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Timer className="h-3 w-3" />
                {timeRemaining}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            {campaign.projectTwitterHandle && (
              <span>@{campaign.projectTwitterHandle.replace('@', '')}</span>
            )}
            {campaign.client && (
              <span className="text-xs">Client: {campaign.client.name}</span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="hidden md:flex items-center gap-6 text-sm">
          <div className="text-center">
            <p className="font-semibold">{campaign._count.campaignKols}</p>
            <p className="text-xs text-muted-foreground">KOLs</p>
          </div>
          <div className="text-center">
            <p className="font-semibold">{campaign._count.posts}</p>
            <p className="text-xs text-muted-foreground">Posts</p>
          </div>
          <div className="text-center">
            <p className="font-semibold">{formatCurrency(campaign.totalBudget)}</p>
            <p className="text-xs text-muted-foreground">Budget</p>
          </div>
        </div>

        {/* Progress */}
        <div className="hidden lg:block w-32">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Allocated</span>
            <span className="font-medium">{Math.round(budgetProgress)}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                budgetProgress > 90 ? "bg-rose-500" : budgetProgress > 70 ? "bg-amber-500" : "bg-emerald-500"
              )}
              style={{ width: `${Math.min(budgetProgress, 100)}%` }}
            />
          </div>
        </div>

        {/* Arrow */}
        <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
      </Link>
    );
  }

  // Grid view (default)
  return (
    <Link
      href={`/agency/campaigns/${campaign.id}`}
      className="group block rounded-xl border bg-card overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all h-full flex flex-col"
    >
      {/* Banner Section */}
      <div className="relative h-28 bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-pink-500/5 flex-shrink-0">
        {campaign.projectBannerUrl && (
          <img
            src={campaign.projectBannerUrl}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />

        {/* Status Badge */}
        <div className="absolute top-3 right-3">
          <Badge className={cn(statusStyle.bg, statusStyle.text, statusStyle.border, "border shadow-sm")}>
            {campaign.status.replace("_", " ")}
          </Badge>
        </div>

        {/* Time Remaining Badge */}
        {timeRemaining && (
          <div className="absolute top-3 left-3">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-background/80 backdrop-blur-sm text-xs font-medium">
              <Timer className="h-3 w-3 text-amber-500" />
              {timeRemaining}
            </span>
          </div>
        )}

        {/* Avatar */}
        <div className="absolute left-4 -bottom-7 z-10">
          {campaign.projectAvatarUrl ? (
            <img
              src={campaign.projectAvatarUrl}
              alt={campaign.name}
              className="h-14 w-14 rounded-xl border-4 border-card object-cover shadow-lg bg-card ring-1 ring-border"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                if (fallback) fallback.classList.remove('hidden');
              }}
            />
          ) : null}
          <div className={cn(
            campaign.projectAvatarUrl ? 'hidden' : '',
            "h-14 w-14 rounded-xl border-4 border-card bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg"
          )}>
            {campaign.name.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="px-4 pt-9 pb-4 flex flex-col flex-grow">
        {/* Header */}
        <div className="min-h-[52px]">
          <h3 className="font-semibold text-base truncate group-hover:text-primary transition-colors">
            {campaign.name}
          </h3>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-sm text-muted-foreground truncate">
              {campaign.projectTwitterHandle
                ? `@${campaign.projectTwitterHandle.replace('@', '')}`
                : <span className="text-muted-foreground/50 italic text-xs">No handle</span>
              }
            </p>
            {campaign.client && (
              <>
                <span className="text-muted-foreground/30">•</span>
                <span className="text-xs text-muted-foreground truncate">{campaign.client.name}</span>
              </>
            )}
          </div>
        </div>

        {/* Description */}
        {campaign.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
            {campaign.description}
          </p>
        )}

        {/* Stats Row */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t">
          <div className="flex items-center gap-1.5">
            <div className="h-7 w-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Users className="h-3.5 w-3.5 text-purple-500" />
            </div>
            <div>
              <p className="text-sm font-semibold">{campaign._count.campaignKols}</p>
              <p className="text-[10px] text-muted-foreground leading-none">KOLs</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <FileText className="h-3.5 w-3.5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-semibold">{campaign._count.posts}</p>
              <p className="text-[10px] text-muted-foreground leading-none">Posts</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <div className="text-right">
              <p className="text-sm font-semibold">{formatCurrency(campaign.totalBudget)}</p>
              <p className="text-[10px] text-muted-foreground leading-none">Budget</p>
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{campaign.startDate ? formatDate(campaign.startDate) : "No start"}</span>
          </div>
          <span>→</span>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{campaign.endDate ? formatDate(campaign.endDate) : "No end"}</span>
          </div>
        </div>

        {/* Budget Progress */}
        <div className="mt-auto pt-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">Budget Allocated</span>
            <span className="font-medium">
              {formatCurrency(campaign.spentBudget)} ({Math.round(budgetProgress)}%)
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                budgetProgress > 90 ? "bg-rose-500" : budgetProgress > 70 ? "bg-amber-500" : "bg-gradient-to-r from-indigo-500 to-purple-500"
              )}
              style={{ width: `${Math.min(budgetProgress, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
