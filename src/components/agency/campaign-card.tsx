import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, getStatusColor } from "@/lib/utils";
import { Calendar, Users, FileText, DollarSign, Twitter } from "lucide-react";

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
      className="block rounded-lg border bg-card overflow-hidden hover:border-primary/50 transition-colors"
    >
      {/* Project Banner & Avatar Header */}
      {campaign.projectAvatarUrl || campaign.projectBannerUrl ? (
        <div className="relative h-28 overflow-hidden">
          {/* Banner Background */}
          {campaign.projectBannerUrl ? (
            <img
              src={campaign.projectBannerUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5" />
          )}
          {/* Gradient overlay for better text visibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

          {/* Profile Picture */}
          {campaign.projectAvatarUrl && (
            <div className="absolute -bottom-8 left-5">
              <img
                src={campaign.projectAvatarUrl}
                alt={campaign.name}
                className="h-16 w-16 rounded-xl border-4 border-card object-cover shadow-lg"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
              <div className="hidden h-16 w-16 rounded-xl border-4 border-card bg-primary/10 items-center justify-center">
                <Twitter className="h-8 w-8 text-primary/50" />
              </div>
            </div>
          )}

          {/* Status Badge */}
          <div className="absolute top-3 right-3">
            <Badge className={`${getStatusColor(campaign.status)} shadow-sm`} variant="secondary">
              {campaign.status.replace("_", " ")}
            </Badge>
          </div>
        </div>
      ) : (
        <div className="relative h-16 bg-gradient-to-br from-muted/50 to-muted/30">
          <div className="absolute top-3 right-3">
            <Badge className={getStatusColor(campaign.status)} variant="secondary">
              {campaign.status.replace("_", " ")}
            </Badge>
          </div>
        </div>
      )}

      <div className={(campaign.projectAvatarUrl || campaign.projectBannerUrl) ? "p-6 pt-10" : "p-6 pt-2"}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-lg">{campaign.name}</h3>
            {campaign.client && (
              <p className="text-sm text-muted-foreground mt-1">
                Client: {campaign.client.name}
              </p>
            )}
            {campaign.projectTwitterHandle && (
              <p className="text-sm text-primary/70 mt-0.5">
                @{campaign.projectTwitterHandle.replace('@', '')}
              </p>
            )}
          </div>
        </div>

        {campaign.description && (
          <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
            {campaign.description}
          </p>
        )}

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{campaign._count.campaignKols} KOLs</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>{campaign._count.posts} posts</span>
          </div>
          {campaign.startDate && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(campaign.startDate)}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            <span>{formatCurrency(campaign.totalBudget)}</span>
          </div>
        </div>

        {/* Budget Progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground">Budget Allocated</span>
            <span className="font-medium">
              {formatCurrency(campaign.spentBudget)} / {formatCurrency(campaign.totalBudget)}
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
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
