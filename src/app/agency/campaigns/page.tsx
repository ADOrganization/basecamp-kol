"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { CampaignCard } from "@/components/agency/campaign-card";
import { CampaignForm } from "@/components/agency/campaign-form";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import {
  Plus,
  Megaphone,
  DollarSign,
  Users,
  FileText,
  Sparkles,
  Filter,
  LayoutGrid,
  List,
  Search,
} from "lucide-react";

interface Campaign {
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
}

interface TelegramChat {
  id: string;
  telegramChatId: string;
  title: string | null;
}

const STATUS_FILTERS = [
  { value: "all", label: "All", color: "bg-muted text-foreground" },
  { value: "ACTIVE", label: "Active", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  { value: "DRAFT", label: "Draft", color: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
  { value: "PENDING_APPROVAL", label: "Pending", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  { value: "PAUSED", label: "Paused", color: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
  { value: "COMPLETED", label: "Completed", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  { value: "CANCELLED", label: "Cancelled", color: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
];

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [telegramChats, setTelegramChats] = useState<TelegramChat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    fetchCampaigns();
    fetchTelegramChats();
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

  const fetchTelegramChats = async () => {
    try {
      const response = await fetch("/api/telegram/chats");
      if (response.ok) {
        const data = await response.json();
        setTelegramChats(data.chats || []);
      }
    } catch (error) {
      console.error("Failed to fetch telegram chats:", error);
    }
  };

  // Calculate summary stats
  const stats = useMemo(() => {
    const totalBudget = campaigns.reduce((sum, c) => sum + c.totalBudget, 0);
    const totalAllocated = campaigns.reduce((sum, c) => sum + c.spentBudget, 0);
    const totalKols = campaigns.reduce((sum, c) => sum + c._count.campaignKols, 0);
    const totalPosts = campaigns.reduce((sum, c) => sum + c._count.posts, 0);
    const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE").length;

    return { totalBudget, totalAllocated, totalKols, totalPosts, activeCampaigns };
  }, [campaigns]);

  // Filter campaigns by status and search
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((campaign) => {
      const matchesStatus = statusFilter === "all" || campaign.status === statusFilter;
      const matchesSearch =
        searchQuery === "" ||
        campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        campaign.projectTwitterHandle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        campaign.client?.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [campaigns, statusFilter, searchQuery]);

  // Count by status for filter badges
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: campaigns.length };
    campaigns.forEach((c) => {
      counts[c.status] = (counts[c.status] || 0) + 1;
    });
    return counts;
  }, [campaigns]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-muted animate-pulse rounded-lg" />
            <div className="h-4 w-72 bg-muted animate-pulse rounded" />
          </div>
          <div className="h-10 w-36 bg-muted animate-pulse rounded-lg" />
        </div>
        {/* Stats skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
        {/* Cards skeleton */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-80 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Megaphone className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Campaigns</h1>
          </div>
          <p className="text-muted-foreground">
            Manage influencer campaigns and track performance metrics.
          </p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg shadow-indigo-500/25"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Campaign
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Megaphone className="h-4 w-4 text-indigo-500" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Total</span>
          </div>
          <p className="text-2xl font-bold">{campaigns.length}</p>
          <p className="text-xs text-muted-foreground">campaigns</p>
        </div>

        <div className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-emerald-500" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Active</span>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{stats.activeCampaigns}</p>
          <p className="text-xs text-muted-foreground">running now</p>
        </div>

        <div className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-blue-500" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Budget</span>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(stats.totalBudget)}</p>
          <p className="text-xs text-muted-foreground">total allocated</p>
        </div>

        <div className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-purple-500" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">KOLs</span>
          </div>
          <p className="text-2xl font-bold">{stats.totalKols}</p>
          <p className="text-xs text-muted-foreground">assigned</p>
        </div>

        <div className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <FileText className="h-4 w-4 text-amber-500" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Posts</span>
          </div>
          <p className="text-2xl font-bold">{stats.totalPosts}</p>
          <p className="text-xs text-muted-foreground">delivered</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          {/* Status Filters */}
          <div className="flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            {STATUS_FILTERS.map((status) => (
              <button
                key={status.value}
                onClick={() => setStatusFilter(status.value)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-full border transition-all whitespace-nowrap",
                  statusFilter === status.value
                    ? status.color + " border-current"
                    : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                )}
              >
                {status.label}
                {statusCounts[status.value] > 0 && (
                  <span className="ml-1.5 opacity-70">
                    {statusCounts[status.value]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 border rounded-lg p-1 ml-auto md:ml-0">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-1.5 rounded transition-colors",
                viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "p-1.5 rounded transition-colors",
                viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Campaigns Grid/List */}
      {filteredCampaigns.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center mb-4">
            <Megaphone className="h-8 w-8 text-indigo-500" />
          </div>
          <h3 className="font-semibold text-lg">
            {campaigns.length === 0 ? "No campaigns yet" : "No matching campaigns"}
          </h3>
          <p className="text-muted-foreground mt-1 max-w-md mx-auto">
            {campaigns.length === 0
              ? "Create your first campaign to start managing influencer collaborations."
              : "Try adjusting your search or filter to find what you're looking for."}
          </p>
          {campaigns.length === 0 && (
            <Button
              className="mt-6 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
              onClick={() => setShowForm(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Campaign
            </Button>
          )}
          {campaigns.length > 0 && searchQuery && (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>
      ) : (
        <div
          className={cn(
            viewMode === "grid"
              ? "grid gap-6 md:grid-cols-2 lg:grid-cols-3"
              : "flex flex-col gap-4"
          )}
        >
          {filteredCampaigns.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} viewMode={viewMode} />
          ))}
        </div>
      )}

      <CampaignForm
        telegramChats={telegramChats}
        open={showForm}
        onClose={() => {
          setShowForm(false);
          fetchCampaigns();
        }}
      />
    </div>
  );
}
