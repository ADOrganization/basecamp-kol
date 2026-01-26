"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar, Users, DollarSign } from "lucide-react";

interface CampaignCardProps {
  campaign: {
    id: string;
    name: string;
    description: string | null;
    projectTwitterHandle: string | null;
    projectAvatarUrl: string | null;
    status: string;
    startDate: Date | null;
    endDate: Date | null;
    assignedBudget: number;
    requiredPosts: number;
    requiredThreads: number;
    requiredRetweets: number;
    requiredSpaces: number;
    completedDeliverables: number;
    kolStatus: string;
  };
}

function getStatusColor(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "PENDING_APPROVAL":
    case "PENDING":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    case "COMPLETED":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "CONFIRMED":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
  }
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const totalRequired =
    campaign.requiredPosts +
    campaign.requiredThreads +
    campaign.requiredRetweets +
    campaign.requiredSpaces;

  const progress =
    totalRequired > 0
      ? Math.min(100, Math.round((campaign.completedDeliverables / totalRequired) * 100))
      : 0;

  return (
    <Link href={`/kol/campaigns/${campaign.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            {campaign.projectAvatarUrl ? (
              <img
                src={campaign.projectAvatarUrl}
                alt={campaign.name}
                className="h-12 w-12 rounded-lg object-cover"
              />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <span className="text-lg font-bold text-purple-600">
                  {campaign.name.charAt(0)}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-foreground truncate">
                  {campaign.name}
                </h3>
                <Badge className={getStatusColor(campaign.status)}>
                  {campaign.status}
                </Badge>
                <Badge variant="outline" className={getStatusColor(campaign.kolStatus)}>
                  {campaign.kolStatus}
                </Badge>
              </div>
              {campaign.projectTwitterHandle && (
                <p className="text-sm text-muted-foreground mt-1">
                  {campaign.projectTwitterHandle}
                </p>
              )}
            </div>
          </div>

          {campaign.description && (
            <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
              {campaign.description}
            </p>
          )}

          {/* Progress */}
          {totalRequired > 0 && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Deliverables</span>
                <span className="font-medium">
                  {campaign.completedDeliverables}/{totalRequired}
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Meta info */}
          <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
            {campaign.startDate && campaign.endDate && (
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>
                  {new Date(campaign.startDate).toLocaleDateString()} -{" "}
                  {new Date(campaign.endDate).toLocaleDateString()}
                </span>
              </div>
            )}
            {campaign.assignedBudget > 0 && (
              <div className="flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                <span>{formatCurrency(campaign.assignedBudget)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
