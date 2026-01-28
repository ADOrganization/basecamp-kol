"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CampaignCard } from "@/components/client/campaign-card";
import {
  Megaphone,
  Clock,
  FileText,
  Filter,
  Search,
  LayoutGrid,
  List,
  Eye,
  Heart,
} from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: string;
  totalBudget: number;
  spentBudget: number;
  projectAvatarUrl: string | null;
  projectBannerUrl: string | null;
  projectTwitterHandle: string | null;
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
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

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

  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesFilter = filter === "all" || campaign.status === filter;
    const matchesSearch = campaign.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE").length;
  const draftCampaigns = campaigns.filter((c) => c.status === "DRAFT").length;
  const completedCampaigns = campaigns.filter((c) => c.status === "COMPLETED").length;
  const totalPosts = campaigns.reduce((sum, c) => sum + c.posts.length, 0);
  const publishedPosts = campaigns.reduce(
    (sum, c) => sum + c.posts.filter((p) => p.status === "POSTED" || p.status === "VERIFIED").length,
    0
  );
  const pendingApprovals = campaigns.reduce(
    (sum, c) => sum + c.posts.filter((p) => p.status === "PENDING_APPROVAL").length,
    0
  );
  const totalImpressions = campaigns.reduce(
    (sum, c) => sum + c.posts.reduce((s, p) => s + p.impressions, 0),
    0
  );
  const totalEngagement = campaigns.reduce(
    (sum, c) => sum + c.posts.reduce((s, p) => s + p.likes + p.retweets + p.replies, 0),
    0
  );

  const filterOptions = [
    { value: "all", label: "All", count: campaigns.length },
    { value: "ACTIVE", label: "Active", count: activeCampaigns },
    { value: "DRAFT", label: "Draft", count: draftCampaigns },
    { value: "COMPLETED", label: "Completed", count: completedCampaigns },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Stats Skeleton */}
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-muted animate-pulse" />
                  <div>
                    <div className="h-6 w-16 bg-muted rounded animate-pulse mb-1" />
                    <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Cards Skeleton */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="overflow-hidden">
              <div className="h-24 bg-muted animate-pulse" />
              <CardContent className="p-4">
                <div className="h-14 w-14 rounded-xl bg-muted animate-pulse -mt-8 mb-3" />
                <div className="h-5 w-3/4 bg-muted rounded animate-pulse mb-2" />
                <div className="h-4 w-full bg-muted rounded animate-pulse mb-4" />
                <div className="h-1.5 w-full bg-muted rounded animate-pulse mb-4" />
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="h-12 bg-muted rounded animate-pulse" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Megaphone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeCampaigns}</p>
                <p className="text-xs text-muted-foreground">Active Campaigns</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
                <Eye className="h-5 w-5 text-sky-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(totalImpressions)}</p>
                <p className="text-xs text-muted-foreground">Total Impressions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{publishedPosts}<span className="text-sm font-normal text-muted-foreground">/{totalPosts}</span></p>
                <p className="text-xs text-muted-foreground">Published Posts</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-10 w-10 rounded-lg flex items-center justify-center",
                pendingApprovals > 0 ? "bg-amber-500/10" : "bg-rose-500/10"
              )}>
                {pendingApprovals > 0
                  ? <Clock className="h-5 w-5 text-amber-500" />
                  : <Heart className="h-5 w-5 text-rose-500" />
                }
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {pendingApprovals > 0 ? pendingApprovals : formatNumber(totalEngagement)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {pendingApprovals > 0 ? "Pending Approvals" : "Total Engagement"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & View Toggle */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-4">
          {/* Status Filters */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <div className="flex gap-1">
              {filterOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={filter === option.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter(option.value)}
                  className={cn(
                    "gap-1.5",
                    filter === option.value ? "bg-primary" : ""
                  )}
                >
                  {option.label}
                  <Badge
                    variant="secondary"
                    className={cn(
                      "h-5 min-w-5 px-1.5 text-xs",
                      filter === option.value
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    {option.count}
                  </Badge>
                </Button>
              ))}
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex items-center border rounded-lg p-1">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 w-8 p-0",
                viewMode === "grid" && "bg-muted"
              )}
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 w-8 p-0",
                viewMode === "list" && "bg-muted"
              )}
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Campaigns */}
      {filteredCampaigns.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Megaphone className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">
              {searchQuery || filter !== "all"
                ? "No campaigns match your filters"
                : "No campaigns yet"}
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              {searchQuery || filter !== "all"
                ? "Try adjusting your search or filter criteria."
                : "Campaigns assigned to your organization will appear here."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div
          className={cn(
            viewMode === "grid"
              ? "grid gap-6 md:grid-cols-2 lg:grid-cols-3"
              : "space-y-3"
          )}
        >
          {filteredCampaigns.map((campaign) => {
            const published = campaign.posts.filter(
              (p) => p.status === "POSTED" || p.status === "VERIFIED"
            );
            const campImpressions = published.reduce(
              (sum, p) => sum + p.impressions, 0
            );
            const campEngagement = published.reduce(
              (sum, p) => sum + p.likes + p.retweets + p.replies, 0
            );
            const pendingApproval = campaign.posts.filter(
              (p) => p.status === "PENDING_APPROVAL"
            ).length;
            const engagementRate =
              campImpressions > 0
                ? ((campEngagement / campImpressions) * 100).toFixed(2)
                : "0.00";

            return (
              <CampaignCard
                key={campaign.id}
                id={campaign.id}
                name={campaign.name}
                description={campaign.description}
                status={campaign.status}
                projectAvatarUrl={campaign.projectAvatarUrl}
                projectBannerUrl={campaign.projectBannerUrl}
                projectTwitterHandle={campaign.projectTwitterHandle}
                totalImpressions={campImpressions}
                totalEngagement={campEngagement}
                kolCount={campaign.campaignKols.length}
                totalPosts={campaign.posts.length}
                publishedPosts={published.length}
                pendingApproval={pendingApproval}
                engagementRate={engagementRate}
                totalBudget={campaign.totalBudget}
                spentBudget={campaign.spentBudget}
                viewMode={viewMode}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
