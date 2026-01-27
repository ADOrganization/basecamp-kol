"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatNumber, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Search, Plus, MoreHorizontal, ExternalLink, Trash2, Edit, RefreshCw, Loader2, CheckCircle, AlertCircle, Filter, Users, TrendingUp, ArrowUpRight } from "lucide-react";

const TIER_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  SMALL: { bg: "bg-slate-500/10", text: "text-slate-600", border: "border-slate-500/30" },
  MID: { bg: "bg-blue-500/10", text: "text-blue-600", border: "border-blue-500/30" },
  LARGE: { bg: "bg-purple-500/10", text: "text-purple-600", border: "border-purple-500/30" },
  MACRO: { bg: "bg-amber-500/10", text: "text-amber-600", border: "border-amber-500/30" },
};

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  ACTIVE: { bg: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-500/30" },
  INACTIVE: { bg: "bg-slate-500/10", text: "text-slate-600", border: "border-slate-500/30" },
  PENDING: { bg: "bg-amber-500/10", text: "text-amber-600", border: "border-amber-500/30" },
  BLACKLISTED: { bg: "bg-rose-500/10", text: "text-rose-600", border: "border-rose-500/30" },
};

interface KOL {
  id: string;
  name: string;
  twitterHandle: string;
  avatarUrl: string | null;
  tier: string;
  status: string;
  followersCount: number;
  avgLikes: number;
  avgRetweets: number;
  ratePerPost: number | null;
  totalEarnings: number;
  activeCampaigns: number;
  lastPostDate: string | null;
  tags: { id: string; name: string; color: string }[];
  _count: {
    campaignKols: number;
    posts: number;
  };
}

interface KOLTableProps {
  kols: KOL[];
  onAddNew: () => void;
  onRefresh: () => void;
}

export function KOLTable({ kols: initialKols, onAddNew, onRefresh }: KOLTableProps) {
  const router = useRouter();
  const [kols, setKols] = useState(initialKols);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  // Additional column filters
  const [followersMin, setFollowersMin] = useState<string>("");
  const [followersMax, setFollowersMax] = useState<string>("");
  const [postsMin, setPostsMin] = useState<string>("");
  const [campaignsMin, setCampaignsMin] = useState<string>("");
  const [earningsMin, setEarningsMin] = useState<string>("");
  const [earningsMax, setEarningsMax] = useState<string>("");
  const [hasRate, setHasRate] = useState<boolean>(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Get unique tags from all KOLs (safely handle missing tags)
  const allTags = Array.from(
    new Map(kols.flatMap(k => k.tags || []).map(t => [t.id, t])).values()
  );

  // Count active filters
  const activeFilterCount = [
    followersMin, followersMax, postsMin,
    campaignsMin, earningsMin, earningsMax
  ].filter(Boolean).length + (selectedTagIds.length > 0 ? 1 : 0) + (hasRate ? 1 : 0);

  const clearAllFilters = () => {
    setFollowersMin("");
    setFollowersMax("");
    setPostsMin("");
    setCampaignsMin("");
    setEarningsMin("");
    setEarningsMax("");
    setHasRate(false);
    setSelectedTagIds([]);
  };

  // Update local state when props change
  useEffect(() => {
    setKols(initialKols);
  }, [initialKols]);

  const filteredKols = kols.filter((kol) => {
    const matchesSearch =
      search === "" ||
      kol.name.toLowerCase().includes(search.toLowerCase()) ||
      kol.twitterHandle.toLowerCase().includes(search.toLowerCase());

    const matchesTier = tierFilter === "all" || kol.tier === tierFilter;
    const matchesStatus = statusFilter === "all" || kol.status === statusFilter;

    // Followers filter (safe access)
    const minFollowers = followersMin ? parseInt(followersMin) : 0;
    const maxFollowers = followersMax ? parseInt(followersMax) : Infinity;
    const followers = kol.followersCount || 0;
    const matchesFollowers = followers >= minFollowers && followers <= maxFollowers;

    // Posts filter (safe access)
    const minPosts = postsMin ? parseInt(postsMin) : 0;
    const posts = kol._count?.posts || 0;
    const matchesPosts = posts >= minPosts;

    // Campaigns filter (safe access)
    const minCampaigns = campaignsMin ? parseInt(campaignsMin) : 0;
    const campaigns = kol._count?.campaignKols || 0;
    const matchesCampaigns = campaigns >= minCampaigns;

    // Earnings filter (safe access)
    const minEarnings = earningsMin ? parseFloat(earningsMin) : 0;
    const maxEarnings = earningsMax ? parseFloat(earningsMax) : Infinity;
    const earnings = kol.totalEarnings || 0;
    const matchesEarnings = earnings >= minEarnings && earnings <= maxEarnings;

    // Rate filter
    const matchesRate = !hasRate || (kol.ratePerPost && kol.ratePerPost > 0);

    // Tags filter (safe access)
    const kolTags = kol.tags || [];
    const matchesTags = selectedTagIds.length === 0 ||
      selectedTagIds.some(tagId => kolTags.some(t => t.id === tagId));

    return matchesSearch && matchesTier && matchesStatus &&
           matchesFollowers && matchesPosts && matchesCampaigns &&
           matchesEarnings && matchesRate && matchesTags;
  });

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this KOL?")) return;

    try {
      const response = await fetch(`/api/kols/${id}`, { method: "DELETE" });
      if (response.ok) {
        setKols(kols.filter((k) => k.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete KOL:", error);
    }
  };

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    setRefreshStatus({ type: null, message: '' });
    try {
      const response = await fetch("/api/kols/refresh-metrics", { method: "POST" });
      const data = await response.json();

      if (response.ok) {
        console.log(`Refreshed ${data.updated}/${data.total} KOLs`, data);
        setRefreshStatus({
          type: 'success',
          message: `Updated ${data.updated} of ${data.total} KOLs`
        });
        // Reload the KOL list to show updated data
        await onRefresh();
      } else {
        console.error("Refresh failed:", data);
        setRefreshStatus({
          type: 'error',
          message: data.error || 'Failed to refresh metrics'
        });
      }
    } catch (error) {
      console.error("Failed to refresh metrics:", error);
      setRefreshStatus({
        type: 'error',
        message: 'Network error - please try again'
      });
    } finally {
      setIsRefreshing(false);
      // Clear status after 5 seconds
      setTimeout(() => setRefreshStatus({ type: null, message: '' }), 5000);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or handle..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-background"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Tier Filter */}
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="w-[130px] bg-background">
                <SelectValue placeholder="Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="SMALL">Small</SelectItem>
                <SelectItem value="MID">Mid</SelectItem>
                <SelectItem value="LARGE">Large</SelectItem>
                <SelectItem value="MACRO">Macro</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px] bg-background">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="BLACKLISTED">Blacklisted</SelectItem>
              </SelectContent>
            </Select>

            {/* More Filters */}
            <Popover open={showFilters} onOpenChange={setShowFilters}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="relative bg-background">
                  <Filter className="h-4 w-4 mr-2" />
                  More
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shadow-sm">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h4 className="font-semibold">Advanced Filters</h4>
                    {activeFilterCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAllFilters}
                        className="h-auto px-2 py-1 text-xs text-primary hover:text-primary"
                      >
                        Clear all
                      </Button>
                    )}
                  </div>

                  {/* Followers Range */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      Followers
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={followersMin}
                        onChange={(e) => setFollowersMin(e.target.value)}
                        className="h-8"
                      />
                      <span className="text-muted-foreground text-sm">to</span>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={followersMax}
                        onChange={(e) => setFollowersMax(e.target.value)}
                        className="h-8"
                      />
                    </div>
                  </div>

                  {/* Posts Min */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Min Posts Delivered</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 5"
                      value={postsMin}
                      onChange={(e) => setPostsMin(e.target.value)}
                      className="h-8"
                    />
                  </div>

                  {/* Has Rate */}
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <input
                      type="checkbox"
                      id="hasRate"
                      checked={hasRate}
                      onChange={(e) => setHasRate(e.target.checked)}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <Label htmlFor="hasRate" className="text-sm cursor-pointer">
                      Has rate configured
                    </Label>
                  </div>

                  {/* Campaigns Min */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Min Campaigns</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 2"
                      value={campaignsMin}
                      onChange={(e) => setCampaignsMin(e.target.value)}
                      className="h-8"
                    />
                  </div>

                  {/* Earnings Range */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Earnings ($)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="Min $"
                        value={earningsMin}
                        onChange={(e) => setEarningsMin(e.target.value)}
                        className="h-8"
                      />
                      <span className="text-muted-foreground text-sm">to</span>
                      <Input
                        type="number"
                        placeholder="Max $"
                        value={earningsMax}
                        onChange={(e) => setEarningsMax(e.target.value)}
                        className="h-8"
                      />
                    </div>
                  </div>

                  {/* Tags */}
                  {allTags.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Tags</Label>
                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1">
                        {allTags.map((tag) => (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => {
                              if (selectedTagIds.includes(tag.id)) {
                                setSelectedTagIds(selectedTagIds.filter(id => id !== tag.id));
                              } else {
                                setSelectedTagIds([...selectedTagIds, tag.id]);
                              }
                            }}
                            className={cn(
                              "text-xs px-2.5 py-1 rounded-full cursor-pointer transition-all border",
                              selectedTagIds.includes(tag.id)
                                ? "ring-2 ring-primary ring-offset-1"
                                : "opacity-70 hover:opacity-100"
                            )}
                            style={{
                              backgroundColor: tag.color + "15",
                              color: tag.color,
                              borderColor: tag.color + "30",
                            }}
                          >
                            {tag.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <div className="h-6 w-px bg-border hidden lg:block" />

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshAll}
              disabled={isRefreshing}
              className="bg-background"
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </Button>

            {/* Add KOL Button */}
            <Button
              onClick={onAddNew}
              size="sm"
              className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 shadow-lg shadow-purple-500/25"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add KOL
            </Button>
          </div>
        </div>

        {/* Active filter count */}
        {(tierFilter !== "all" || statusFilter !== "all" || search || activeFilterCount > 0) && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t">
            <span className="text-xs text-muted-foreground">
              Showing {filteredKols.length} of {kols.length} KOLs
            </span>
            {(tierFilter !== "all" || statusFilter !== "all" || search || activeFilterCount > 0) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setTierFilter("all");
                  setStatusFilter("all");
                  clearAllFilters();
                }}
                className="h-auto px-2 py-1 text-xs"
              >
                Clear all filters
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Refresh Status Message */}
      {refreshStatus.type && (
        <div className={cn(
          "flex items-center gap-2 p-3 rounded-lg border",
          refreshStatus.type === 'success'
            ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
            : 'bg-rose-500/10 text-rose-700 border-rose-500/20'
        )}>
          {refreshStatus.type === 'success' ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <span className="text-sm font-medium">{refreshStatus.message}</span>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/30 border-b">
                <th className="text-left p-4 font-medium text-xs uppercase tracking-wider text-muted-foreground">KOL</th>
                <th className="text-left p-4 font-medium text-xs uppercase tracking-wider text-muted-foreground">Tier</th>
                <th className="text-left p-4 font-medium text-xs uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="text-right p-4 font-medium text-xs uppercase tracking-wider text-muted-foreground">Followers</th>
                <th className="text-right p-4 font-medium text-xs uppercase tracking-wider text-muted-foreground">Posts</th>
                <th className="text-right p-4 font-medium text-xs uppercase tracking-wider text-muted-foreground">Active</th>
                <th className="text-right p-4 font-medium text-xs uppercase tracking-wider text-muted-foreground">Rate</th>
                <th className="text-right p-4 font-medium text-xs uppercase tracking-wider text-muted-foreground">Earned</th>
                <th className="text-center p-4 font-medium text-xs uppercase tracking-wider text-muted-foreground">Tags</th>
                <th className="w-[50px]"></th>
              </tr>
            </thead>
            <tbody>
              {filteredKols.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                        <Users className="h-8 w-8 text-purple-500" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {kols.length === 0 ? "No KOLs yet" : "No matching KOLs"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {kols.length === 0
                            ? "Add your first KOL to get started."
                            : "Try adjusting your filters."}
                        </p>
                      </div>
                      {kols.length === 0 && (
                        <Button
                          onClick={onAddNew}
                          className="mt-2 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Your First KOL
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredKols.map((kol) => {
                  const tierStyle = TIER_STYLES[kol.tier] || TIER_STYLES.SMALL;
                  const statusStyle = STATUS_STYLES[kol.status] || STATUS_STYLES.PENDING;

                  return (
                    <tr
                      key={kol.id}
                      className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors group"
                      onClick={() => router.push(`/agency/kols/${kol.id}`)}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {kol.avatarUrl ? (
                            <img
                              src={kol.avatarUrl}
                              alt={kol.name}
                              className="h-10 w-10 rounded-xl object-cover ring-2 ring-border group-hover:ring-primary/30 transition-all"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <div className={cn(
                            "h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-medium shadow-lg",
                            kol.avatarUrl ? 'hidden' : ''
                          )}>
                            {kol.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium group-hover:text-primary transition-colors">{kol.name}</p>
                            <a
                              href={`https://x.com/${kol.twitterHandle}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              @{kol.twitterHandle}
                              <ArrowUpRight className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge className={cn(tierStyle.bg, tierStyle.text, tierStyle.border, "border text-xs")}>
                          {kol.tier}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <Badge className={cn(statusStyle.bg, statusStyle.text, statusStyle.border, "border text-xs")}>
                          {kol.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-right">
                        <p className="font-semibold">{formatNumber(kol.followersCount || 0)}</p>
                      </td>
                      <td className="p-4 text-right">
                        <p className="font-medium">{kol._count?.posts || 0}</p>
                        {kol.lastPostDate && (
                          <p className="text-xs text-muted-foreground">
                            {new Date(kol.lastPostDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </p>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {kol.activeCampaigns > 0 ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 text-xs">
                            {kol.activeCampaigns}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {kol.ratePerPost ? (
                          <span className="font-medium">${(kol.ratePerPost / 100).toLocaleString()}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">Not set</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <span className="font-semibold text-emerald-600">${formatNumber(kol.totalEarnings)}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-center gap-1 flex-wrap">
                          {(kol.tags || []).slice(0, 2).map((tag) => (
                            <span
                              key={tag.id}
                              className="text-xs px-2 py-0.5 rounded-full border"
                              style={{
                                backgroundColor: tag.color + "15",
                                color: tag.color,
                                borderColor: tag.color + "30",
                              }}
                            >
                              {tag.name}
                            </span>
                          ))}
                          {(kol.tags || []).length > 2 && (
                            <span className="text-xs text-muted-foreground px-1">
                              +{(kol.tags || []).length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/agency/kols/${kol.id}`}>
                                <Edit className="h-4 w-4 mr-2" />
                                View/Edit
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(kol.id)}
                              className="text-rose-600 focus:text-rose-600 focus:bg-rose-500/10"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
