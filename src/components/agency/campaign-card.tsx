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
      className="block rounded-lg border bg-card p-6 hover:border-primary/50 transition-colors"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-lg">{campaign.name}</h3>
          {campaign.client && (
            <p className="text-sm text-muted-foreground mt-1">
              Client: {campaign.client.name}
            </p>
          )}
        </div>
        <Badge className={getStatusColor(campaign.status)} variant="secondary">
          {campaign.status.replace("_", " ")}
        </Badge>
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
    </Link>
  );
}
