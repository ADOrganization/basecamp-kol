"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatNumber, getStatusColor } from "@/lib/utils";
import {
  Eye,
  ThumbsUp,
  FileText,
  Megaphone,
  Clock,
  Users,
  TrendingUp,
  ArrowRight,
  Sparkles,
  Filter,
  Search,
} from "lucide-react";

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
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

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
  const totalPosts = campaigns.reduce((sum, c) => sum + c.posts.length, 0);
  const pendingApprovals = campaigns.reduce(
    (sum, c) => sum + c.posts.filter((p) => p.status === "PENDING_APPROVAL").length,
    0
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800 p-8 text-white">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.5))]" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/20 rounded-full blur-3xl -mr-32 -mt-32" />
        <div className="relative flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-teal-200 mb-2">
              <Megaphone className="h-5 w-5" />
              <span className="text-sm font-medium">Campaign Overview</span>
            </div>
            <h1 className="text-3xl font-bold mb-2">Your Campaigns</h1>
            <p className="text-teal-100 max-w-xl">
              Monitor and track all your influencer marketing campaigns in one place.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <div className="text-center px-6 py-3 bg-white/10 rounded-xl backdrop-blur-sm">
              <p className="text-3xl font-bold">{campaigns.length}</p>
              <p className="text-sm text-teal-200">Total Campaigns</p>
            </div>
            <div className="text-center px-6 py-3 bg-white/10 rounded-xl backdrop-blur-sm">
              <p className="text-3xl font-bold">{activeCampaigns}</p>
              <p className="text-sm text-teal-200">Active</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-teal-500/10 rounded-full -mr-8 -mt-8" />
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-teal-100 flex items-center justify-center">
                <Megaphone className="h-6 w-6 text-teal-600" />
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
              <div className="h-12 w-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                <FileText className="h-6 w-6 text-indigo-600" />
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
              <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingApprovals}</p>
                <p className="text-sm text-muted-foreground">Pending Approvals</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <div className="flex gap-2">
            {["all", "ACTIVE", "DRAFT", "COMPLETED"].map((status) => (
              <Button
                key={status}
                variant={filter === status ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(status)}
                className={filter === status ? "bg-teal-600 hover:bg-teal-700" : ""}
              >
                {status === "all" ? "All" : status.charAt(0) + status.slice(1).toLowerCase()}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Campaigns List */}
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
        <div className="grid gap-6 md:grid-cols-2">
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
              <Link
                key={campaign.id}
                href={`/client/campaigns/${campaign.id}`}
                className="group"
              >
                <Card className="h-full hover:border-teal-500/50 hover:shadow-lg transition-all duration-200">
                  <CardContent className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg group-hover:text-teal-600 transition-colors line-clamp-1">
                            {campaign.name}
                          </h3>
                        </div>
                        {campaign.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {campaign.description}
                          </p>
                        )}
                      </div>
                      <Badge
                        className={`${getStatusColor(campaign.status)} shrink-0`}
                        variant="secondary"
                      >
                        {campaign.status.replace("_", " ")}
                      </Badge>
                    </div>

                    {/* Pending Alert */}
                    {pendingApproval > 0 && (
                      <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg mb-4">
                        <Clock className="h-4 w-4 text-amber-600" />
                        <span className="text-sm text-amber-700 font-medium">
                          {pendingApproval} post{pendingApproval !== 1 ? "s" : ""} pending approval
                        </span>
                      </div>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Eye className="h-4 w-4" />
                          <span className="text-xs">Impressions</span>
                        </div>
                        <p className="font-semibold text-lg">{formatNumber(totalImpressions)}</p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <ThumbsUp className="h-4 w-4" />
                          <span className="text-xs">Engagement</span>
                        </div>
                        <p className="font-semibold text-lg">{formatNumber(totalEngagement)}</p>
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Content Progress</span>
                        <span className="font-medium">
                          {publishedPosts}/{campaign.posts.length} posts
                        </span>
                      </div>
                      <Progress
                        value={
                          campaign.posts.length > 0
                            ? (publishedPosts / campaign.posts.length) * 100
                            : 0
                        }
                        className="h-2"
                      />
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          <span>{campaign.campaignKols.length} KOLs</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-4 w-4" />
                          <span>{engagementRate}% ER</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-teal-600 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        View Details
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
