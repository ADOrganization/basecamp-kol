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
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  const pendingApprovals = campaigns.reduce(
    (sum, c) => sum + c.posts.filter((p) => p.status === "PENDING_APPROVAL").length,
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
        {/* Header Skeleton */}
        <div className="rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 p-8 animate-pulse">
          <div className="h-6 w-40 bg-primary/10 rounded mb-4" />
          <div className="h-8 w-64 bg-primary/10 rounded mb-2" />
          <div className="h-4 w-80 bg-primary/10 rounded" />
        </div>

        {/* Stats Skeleton */}
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
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
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-8 text-primary-foreground">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.5))]" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32" />
        <div className="relative flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-primary-foreground/70 mb-2">
              <Megaphone className="h-5 w-5" />
              <span className="text-sm font-medium">Campaign Overview</span>
            </div>
            <h1 className="text-3xl font-bold mb-2">Your Campaigns</h1>
            <p className="text-primary-foreground/80 max-w-xl">
              Monitor and track all your influencer marketing campaigns in one place.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <div className="text-center px-6 py-3 bg-white/10 rounded-xl backdrop-blur-sm">
              <p className="text-3xl font-bold">{campaigns.length}</p>
              <p className="text-sm text-primary-foreground/70">Total</p>
            </div>
            <div className="text-center px-6 py-3 bg-white/10 rounded-xl backdrop-blur-sm">
              <p className="text-3xl font-bold">{activeCampaigns}</p>
              <p className="text-sm text-primary-foreground/70">Active</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-full -mr-8 -mt-8" />
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Megaphone className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeCampaigns}</p>
                <p className="text-sm text-muted-foreground">Active Campaigns</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500/10 rounded-full -mr-8 -mt-8" />
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center">
                <FileText className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalPosts}</p>
                <p className="text-sm text-muted-foreground">Total Posts</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 rounded-full -mr-8 -mt-8" />
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
                <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingApprovals}</p>
                <p className="text-sm text-muted-foreground">Pending Approvals</p>
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
            const publishedPosts = campaign.posts.filter(
              (p) => p.status === "POSTED" || p.status === "VERIFIED"
            ).length;
            const engagementRate =
              totalImpressions > 0
                ? ((totalEngagement / totalImpressions) * 100).toFixed(2)
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
                totalImpressions={totalImpressions}
                totalEngagement={totalEngagement}
                kolCount={campaign.campaignKols.length}
                totalPosts={campaign.posts.length}
                publishedPosts={publishedPosts}
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
