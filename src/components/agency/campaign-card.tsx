import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, getStatusColor } from "@/lib/utils";
import { Calendar, Users, FileText, DollarSign } from "lucide-react";

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

  const hasMedia = campaign.projectAvatarUrl || campaign.projectBannerUrl;

  return (
    <Link
      href={`/agency/campaigns/${campaign.id}`}
      className="block rounded-lg border bg-card overflow-hidden hover:border-primary/50 transition-colors"
    >
      {/* Banner Section - Twitter-style layout */}
      {hasMedia ? (
        <div className="relative">
          {/* Banner Image */}
          <div className="h-24 w-full overflow-hidden bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5">
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
          </div>

          {/* Status Badge - positioned on banner */}
          <div className="absolute top-2 right-2">
            <Badge className={`${getStatusColor(campaign.status)} shadow-md`} variant="secondary">
              {campaign.status.replace("_", " ")}
            </Badge>
          </div>

          {/* Avatar - Twitter style: overlaps banner by ~50% */}
          {campaign.projectAvatarUrl && (
            <div className="absolute left-4 -bottom-8 z-10">
              <div className="relative">
                <img
                  src={campaign.projectAvatarUrl}
                  alt={campaign.name}
                  className="h-16 w-16 rounded-full border-4 border-card object-cover shadow-lg bg-card"
                  onError={(e) => {
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      e.currentTarget.style.display = 'none';
                      const fallback = parent.querySelector('.avatar-fallback');
                      if (fallback) fallback.classList.remove('hidden');
                    }
                  }}
                />
                <div className="avatar-fallback hidden h-16 w-16 rounded-full border-4 border-card bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                  {campaign.name.charAt(0).toUpperCase()}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* No media - simple header with status */
        <div className="relative h-12 bg-gradient-to-br from-muted/50 to-muted/30">
          <div className="absolute top-2 right-2">
            <Badge className={getStatusColor(campaign.status)} variant="secondary">
              {campaign.status.replace("_", " ")}
            </Badge>
          </div>
        </div>
      )}

      {/* Content Section */}
      <div className={hasMedia && campaign.projectAvatarUrl ? "px-4 pt-10 pb-4" : "p-4"}>
        {/* Campaign Name & Twitter Handle */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-lg truncate">{campaign.name}</h3>
            {campaign.projectTwitterHandle && (
              <p className="text-sm text-muted-foreground">
                @{campaign.projectTwitterHandle.replace('@', '')}
              </p>
            )}
            {campaign.client && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Client: {campaign.client.name}
              </p>
            )}
          </div>
        </div>

        {/* Description */}
        {campaign.description && (
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
            {campaign.description}
          </p>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>{campaign._count.campaignKols} KOLs</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            <span>{campaign._count.posts} posts</span>
          </div>
          {campaign.startDate && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>{formatDate(campaign.startDate)}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <DollarSign className="h-3.5 w-3.5" />
            <span>{formatCurrency(campaign.totalBudget)}</span>
          </div>
        </div>

        {/* Budget Progress */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Budget Allocated</span>
            <span className="font-medium">
              {formatCurrency(campaign.spentBudget)} / {formatCurrency(campaign.totalBudget)}
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.min(budgetProgress, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
