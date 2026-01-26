"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JoinRequestModal } from "@/components/kol/join-request-modal";
import {
  Calendar,
  Users,
  Search,
  Compass,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  projectTwitterHandle: string | null;
  projectAvatarUrl: string | null;
  applicationDeadline: Date | null;
  maxKolCount: number | null;
  currentKolCount: number;
  keywords: string[];
  existingRequest: {
    id: string;
    status: string;
    createdAt: Date;
  } | null;
}

interface DiscoverCampaignsProps {
  campaigns: Campaign[];
}

function getRequestStatusBadge(status: string) {
  switch (status) {
    case "PENDING":
      return (
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
          <Clock className="h-3 w-3 mr-1" />
          Request Pending
        </Badge>
      );
    case "APPROVED":
      return (
        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
          <CheckCircle className="h-3 w-3 mr-1" />
          Approved
        </Badge>
      );
    case "DECLINED":
      return (
        <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400">
          <XCircle className="h-3 w-3 mr-1" />
          Declined
        </Badge>
      );
    default:
      return null;
  }
}

export function DiscoverCampaigns({ campaigns }: DiscoverCampaignsProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);

  const filteredCampaigns = campaigns.filter((c) => {
    const searchLower = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(searchLower) ||
      c.description?.toLowerCase().includes(searchLower) ||
      c.projectTwitterHandle?.toLowerCase().includes(searchLower) ||
      c.keywords.some((k) => k.toLowerCase().includes(searchLower))
    );
  });

  const handleWithdraw = async (campaignId: string) => {
    setWithdrawing(campaignId);
    try {
      const response = await fetch(`/api/kol/campaigns/${campaignId}/request`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to withdraw request:", error);
    } finally {
      setWithdrawing(null);
    }
  };

  return (
    <>
      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search campaigns..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Campaigns Grid */}
      {filteredCampaigns.length === 0 ? (
        <div className="text-center py-16 bg-muted/30 rounded-lg">
          <Compass className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold text-foreground">
            No open campaigns found
          </h3>
          <p className="text-muted-foreground mt-1">
            {search
              ? "Try adjusting your search"
              : "Check back later for new opportunities"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCampaigns.map((campaign) => (
            <Card key={campaign.id} className="flex flex-col">
              <CardContent className="p-6 flex-1 flex flex-col">
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
                    <h3 className="font-semibold text-foreground truncate">
                      {campaign.name}
                    </h3>
                    {campaign.projectTwitterHandle && (
                      <p className="text-sm text-muted-foreground">
                        {campaign.projectTwitterHandle}
                      </p>
                    )}
                  </div>
                </div>

                {campaign.description && (
                  <p className="text-sm text-muted-foreground mt-3 line-clamp-2 flex-1">
                    {campaign.description}
                  </p>
                )}

                {/* Keywords */}
                {campaign.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {campaign.keywords.slice(0, 3).map((keyword) => (
                      <Badge key={keyword} variant="secondary" className="text-xs">
                        {keyword}
                      </Badge>
                    ))}
                    {campaign.keywords.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{campaign.keywords.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Meta */}
                <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                  {campaign.applicationDeadline && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>
                        Deadline: {new Date(campaign.applicationDeadline).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {campaign.maxKolCount && (
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>
                        {campaign.currentKolCount}/{campaign.maxKolCount} spots
                      </span>
                    </div>
                  )}
                </div>

                {/* Action */}
                <div className="mt-4 pt-4 border-t">
                  {campaign.existingRequest ? (
                    <div className="flex items-center justify-between">
                      {getRequestStatusBadge(campaign.existingRequest.status)}
                      {campaign.existingRequest.status === "PENDING" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleWithdraw(campaign.id)}
                          disabled={withdrawing === campaign.id}
                          className="text-rose-600 hover:text-rose-700"
                        >
                          {withdrawing === campaign.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Withdraw"
                          )}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <Button
                      onClick={() => setSelectedCampaign(campaign)}
                      className="w-full bg-purple-600 hover:bg-purple-700"
                    >
                      Request to Join
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Join Request Modal */}
      {selectedCampaign && (
        <JoinRequestModal
          isOpen={!!selectedCampaign}
          onClose={() => setSelectedCampaign(null)}
          campaign={selectedCampaign}
        />
      )}
    </>
  );
}
