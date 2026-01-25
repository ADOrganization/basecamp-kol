"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatNumber, getTierColor, getStatusColor } from "@/lib/utils";
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
import { Search, Plus, MoreHorizontal, ExternalLink, Trash2, Edit, RefreshCw, Loader2, CheckCircle, AlertCircle, Filter, X } from "lucide-react";

interface KOL {
  id: string;
  name: string;
  twitterHandle: string;
  avatarUrl: string | null;
  tier: string;
  status: string;
  followersCount: number;
  avgEngagementRate: number;
  totalEarnings: number;
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
  const [engagementMin, setEngagementMin] = useState<string>("");
  const [engagementMax, setEngagementMax] = useState<string>("");
  const [campaignsMin, setCampaignsMin] = useState<string>("");
  const [earningsMin, setEarningsMin] = useState<string>("");
  const [earningsMax, setEarningsMax] = useState<string>("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Get unique tags from all KOLs
  const allTags = Array.from(
    new Map(kols.flatMap(k => k.tags).map(t => [t.id, t])).values()
  );

  // Count active filters
  const activeFilterCount = [
    followersMin, followersMax, engagementMin, engagementMax,
    campaignsMin, earningsMin, earningsMax
  ].filter(Boolean).length + (selectedTagIds.length > 0 ? 1 : 0);

  const clearAllFilters = () => {
    setFollowersMin("");
    setFollowersMax("");
    setEngagementMin("");
    setEngagementMax("");
    setCampaignsMin("");
    setEarningsMin("");
    setEarningsMax("");
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

    // Followers filter
    const minFollowers = followersMin ? parseInt(followersMin) : 0;
    const maxFollowers = followersMax ? parseInt(followersMax) : Infinity;
    const matchesFollowers = kol.followersCount >= minFollowers && kol.followersCount <= maxFollowers;

    // Engagement filter (input is percentage, stored as decimal)
    const minEngagement = engagementMin ? parseFloat(engagementMin) / 100 : 0;
    const maxEngagement = engagementMax ? parseFloat(engagementMax) / 100 : Infinity;
    const matchesEngagement = kol.avgEngagementRate >= minEngagement && kol.avgEngagementRate <= maxEngagement;

    // Campaigns filter
    const minCampaigns = campaignsMin ? parseInt(campaignsMin) : 0;
    const matchesCampaigns = kol._count.campaignKols >= minCampaigns;

    // Earnings filter
    const minEarnings = earningsMin ? parseFloat(earningsMin) : 0;
    const maxEarnings = earningsMax ? parseFloat(earningsMax) : Infinity;
    const matchesEarnings = kol.totalEarnings >= minEarnings && kol.totalEarnings <= maxEarnings;

    // Tags filter
    const matchesTags = selectedTagIds.length === 0 ||
      selectedTagIds.some(tagId => kol.tags.some(t => t.id === tagId));

    return matchesSearch && matchesTier && matchesStatus &&
           matchesFollowers && matchesEngagement && matchesCampaigns &&
           matchesEarnings && matchesTags;
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
      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search KOLs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={tierFilter} onValueChange={setTierFilter}>
          <SelectTrigger className="w-[140px]">
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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
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
        <Popover open={showFilters} onOpenChange={setShowFilters}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="relative">
              <Filter className="h-4 w-4 mr-2" />
              More Filters
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Filters</h4>
                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    className="h-auto p-1 text-xs text-muted-foreground"
                  >
                    Clear all
                  </Button>
                )}
              </div>

              {/* Followers Range */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Followers</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={followersMin}
                    onChange={(e) => setFollowersMin(e.target.value)}
                    className="h-8"
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={followersMax}
                    onChange={(e) => setFollowersMax(e.target.value)}
                    className="h-8"
                  />
                </div>
              </div>

              {/* Engagement Range */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Engagement Rate (%)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="Min %"
                    value={engagementMin}
                    onChange={(e) => setEngagementMin(e.target.value)}
                    className="h-8"
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="Max %"
                    value={engagementMax}
                    onChange={(e) => setEngagementMax(e.target.value)}
                    className="h-8"
                  />
                </div>
              </div>

              {/* Campaigns Min */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Min Campaigns</Label>
                <Input
                  type="number"
                  placeholder="Minimum campaigns"
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
                  <span className="text-muted-foreground">-</span>
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
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
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
                        className={`text-xs px-2 py-1 rounded-full cursor-pointer transition-all ${
                          selectedTagIds.includes(tag.id)
                            ? "ring-2 ring-primary ring-offset-1"
                            : "opacity-70 hover:opacity-100"
                        }`}
                        style={{
                          backgroundColor: tag.color + "20",
                          color: tag.color,
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
        <Button
          variant="outline"
          onClick={handleRefreshAll}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          {isRefreshing ? "Refreshing..." : "Refresh Metrics"}
        </Button>
        <Button onClick={onAddNew}>
          <Plus className="h-4 w-4 mr-2" />
          Add KOL
        </Button>
      </div>

      {/* Refresh Status Message */}
      {refreshStatus.type && (
        <div className={`flex items-center gap-2 p-3 rounded-lg ${
          refreshStatus.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {refreshStatus.type === 'success' ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <span className="text-sm font-medium">{refreshStatus.message}</span>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-4 font-medium text-muted-foreground">KOL</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Tier</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
              <th className="text-right p-4 font-medium text-muted-foreground">Followers</th>
              <th className="text-right p-4 font-medium text-muted-foreground">Engagement</th>
              <th className="text-right p-4 font-medium text-muted-foreground">Campaigns</th>
              <th className="text-right p-4 font-medium text-muted-foreground">Earnings</th>
              <th className="text-center p-4 font-medium text-muted-foreground">Tags</th>
              <th className="w-[50px]"></th>
            </tr>
          </thead>
          <tbody>
            {filteredKols.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-muted-foreground">
                  {kols.length === 0
                    ? "No KOLs added yet. Click 'Add KOL' to get started."
                    : "No KOLs match your filters."}
                </td>
              </tr>
            ) : (
              filteredKols.map((kol) => (
                <tr
                  key={kol.id}
                  className="border-t hover:bg-muted/50 cursor-pointer"
                  onClick={() => router.push(`/agency/kols/${kol.id}`)}
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {kol.avatarUrl ? (
                        <img
                          src={kol.avatarUrl}
                          alt={kol.name}
                          className="h-10 w-10 rounded-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-medium ${kol.avatarUrl ? 'hidden' : ''}`}>
                        {kol.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{kol.name}</p>
                        <a
                          href={`https://twitter.com/${kol.twitterHandle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          @{kol.twitterHandle}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge className={getTierColor(kol.tier)} variant="secondary">
                      {kol.tier}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <Badge className={getStatusColor(kol.status)} variant="secondary">
                      {kol.status}
                    </Badge>
                  </td>
                  <td className="p-4 text-right font-medium">
                    {formatNumber(kol.followersCount)}
                  </td>
                  <td className="p-4 text-right">
                    {(kol.avgEngagementRate * 100).toFixed(2)}%
                  </td>
                  <td className="p-4 text-right">
                    {kol._count.campaignKols}
                  </td>
                  <td className="p-4 text-right font-medium text-green-600">
                    ${formatNumber(kol.totalEarnings)}
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center gap-1 flex-wrap">
                      {kol.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag.id}
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: tag.color + "20", color: tag.color }}
                        >
                          {tag.name}
                        </span>
                      ))}
                      {kol.tags.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{kol.tags.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
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
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
