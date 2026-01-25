import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, getStatusColor } from "@/lib/utils";
import { Calendar, Users, FileText, DollarSign, Clock } from "lucide-react";

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
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const budgetProgress = campaign.totalBudget > 0
    ? (campaign.spentBudget / campaign.totalBudget) * 100
    : 0;

  return (
    <Link
      href={`/agency/campaigns/${campaign.id}`}
      className="block rounded-lg border bg-card overflow-hidden hover:border-primary/50 transition-colors h-full flex flex-col"
    >
      {/* Banner Section - Fixed height */}
      <div className="relative h-24 bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 flex-shrink-0">
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

        {/* Status Badge - Always positioned top-right */}
        <div className="absolute top-2 right-2">
          <Badge className={`${getStatusColor(campaign.status)} shadow-sm`} variant="secondary">
            {campaign.status.replace("_", " ")}
          </Badge>
        </div>

        {/* Avatar - Always show with fallback */}
        <div className="absolute left-4 -bottom-8 z-10">
          {campaign.projectAvatarUrl ? (
            <img
              src={campaign.projectAvatarUrl}
              alt={campaign.name}
              className="h-16 w-16 rounded-full border-4 border-card object-cover shadow-lg bg-card"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                if (fallback) fallback.classList.remove('hidden');
              }}
            />
          ) : null}
          <div className={`${campaign.projectAvatarUrl ? 'hidden' : ''} h-16 w-16 rounded-full border-4 border-card bg-primary/10 flex items-center justify-center text-primary font-bold text-xl shadow-lg`}>
            {campaign.name.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      {/* Content Section - Fixed structure */}
      <div className="px-4 pt-10 pb-4 flex flex-col flex-grow">
        {/* Header: Name, Handle, Client - Fixed height section */}
        <div className="min-h-[60px]">
          <h3 className="font-semibold text-lg truncate">{campaign.name}</h3>
          <p className="text-sm text-muted-foreground truncate">
            {campaign.projectTwitterHandle
              ? `@${campaign.projectTwitterHandle.replace('@', '')}`
              : <span className="text-muted-foreground/50 italic">No handle set</span>
            }
          </p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {campaign.client
              ? `Client: ${campaign.client.name}`
              : <span className="text-muted-foreground/50 italic">No client assigned</span>
            }
          </p>
        </div>

        {/* Description - Fixed height with line clamp */}
        <div className="h-10 mt-2">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {campaign.description || <span className="italic text-muted-foreground/50">No description</span>}
          </p>
        </div>

        {/* Divider */}
        <div className="border-t my-3" />

        {/* Stats Grid - Always 4 items, consistent layout */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1.5 text-sm">
            <Users className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-muted-foreground">{campaign._count.campaignKols} KOLs</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-muted-foreground">{campaign._count.posts} posts</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span className={campaign.startDate ? "text-muted-foreground" : "text-muted-foreground/50 italic"}>
              {campaign.startDate ? formatDate(campaign.startDate) : "No start date"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span className={campaign.endDate ? "text-muted-foreground" : "text-muted-foreground/50 italic"}>
              {campaign.endDate ? formatDate(campaign.endDate) : "No end date"}
            </span>
          </div>
        </div>

        {/* Budget Section - Always at bottom, separated */}
        <div className="mt-auto pt-3">
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <DollarSign className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Budget</span>
              </div>
              <span className="text-sm font-semibold">
                {formatCurrency(campaign.totalBudget)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>Allocated</span>
              <span>{formatCurrency(campaign.spentBudget)} ({Math.round(budgetProgress)}%)</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all rounded-full"
                style={{ width: `${Math.min(budgetProgress, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
