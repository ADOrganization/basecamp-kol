"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber, getStatusColor } from "@/lib/utils";
import { Eye, ThumbsUp, FileText } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: string;
  totalBudget: number;
  startDate: string | null;
  endDate: string | null;
  campaignKols: {
    kol: { id: string; name: string; twitterHandle: string };
  }[];
  posts: {
    id: string;
    status: string;
    impressions: number;
    likes: number;
    retweets: number;
    replies: number;
  }[];
}

export default function ClientCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const response = await fetch("/api/campaigns");
      if (response.ok) {
        const data = await response.json();
        setCampaigns(data);
      }
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Your Campaigns</h1>
        <p className="text-muted-foreground mt-1">
          View and monitor your influencer campaigns.
        </p>
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <h3 className="font-semibold text-lg">No campaigns yet</h3>
          <p className="text-muted-foreground mt-1">
            Campaigns assigned to your organization will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => {
            const totalImpressions = campaign.posts.reduce(
              (sum, p) => sum + p.impressions,
              0
            );
            const totalEngagement = campaign.posts.reduce(
              (sum, p) => sum + p.likes + p.retweets + p.replies,
              0
            );
            const pendingApproval = campaign.posts.filter(
              (p) => p.status === "PENDING_APPROVAL"
            ).length;

            return (
              <Link
                key={campaign.id}
                href={`/client/campaigns/${campaign.id}`}
                className="block rounded-lg border bg-card p-6 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{campaign.name}</h3>
                    {campaign.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {campaign.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {pendingApproval > 0 && (
                      <Badge variant="warning">
                        {pendingApproval} pending
                      </Badge>
                    )}
                    <Badge className={getStatusColor(campaign.status)} variant="secondary">
                      {campaign.status.replace("_", " ")}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">KOLs</p>
                    <p className="font-medium">{campaign.campaignKols.length}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Posts</p>
                      <p className="font-medium">{campaign.posts.length}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Impressions</p>
                      <p className="font-medium">{formatNumber(totalImpressions)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ThumbsUp className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Engagement</p>
                      <p className="font-medium">{formatNumber(totalEngagement)}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Budget: {formatCurrency(campaign.totalBudget)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
