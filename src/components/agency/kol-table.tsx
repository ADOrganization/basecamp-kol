"use client";

import { useState } from "react";
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
import { Search, Plus, MoreHorizontal, ExternalLink, Trash2, Edit } from "lucide-react";

interface KOL {
  id: string;
  name: string;
  twitterHandle: string;
  avatarUrl: string | null;
  tier: string;
  status: string;
  followersCount: number;
  avgEngagementRate: number;
  tags: { id: string; name: string; color: string }[];
  _count: {
    campaignKols: number;
    posts: number;
  };
}

interface KOLTableProps {
  kols: KOL[];
  onAddNew: () => void;
}

export function KOLTable({ kols: initialKols, onAddNew }: KOLTableProps) {
  const router = useRouter();
  const [kols, setKols] = useState(initialKols);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredKols = kols.filter((kol) => {
    const matchesSearch =
      search === "" ||
      kol.name.toLowerCase().includes(search.toLowerCase()) ||
      kol.twitterHandle.toLowerCase().includes(search.toLowerCase());

    const matchesTier = tierFilter === "all" || kol.tier === tierFilter;
    const matchesStatus = statusFilter === "all" || kol.status === statusFilter;

    return matchesSearch && matchesTier && matchesStatus;
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
            <SelectItem value="NANO">Nano</SelectItem>
            <SelectItem value="MICRO">Micro</SelectItem>
            <SelectItem value="MID">Mid</SelectItem>
            <SelectItem value="MACRO">Macro</SelectItem>
            <SelectItem value="MEGA">Mega</SelectItem>
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
        <Button onClick={onAddNew}>
          <Plus className="h-4 w-4 mr-2" />
          Add KOL
        </Button>
      </div>

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
              <th className="text-center p-4 font-medium text-muted-foreground">Tags</th>
              <th className="w-[50px]"></th>
            </tr>
          </thead>
          <tbody>
            {filteredKols.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
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
