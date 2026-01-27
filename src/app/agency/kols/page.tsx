"use client";

import { useState, useEffect, useMemo } from "react";
import { KOLTable } from "@/components/agency/kol-table";
import { KOLForm } from "@/components/agency/kol-form";
import { formatNumber, formatCurrency } from "@/lib/utils";
import {
  Users,
  TrendingUp,
  DollarSign,
  Megaphone,
  Star,
} from "lucide-react";

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

interface TelegramChat {
  id: string;
  telegramChatId: string;
  title: string | null;
}

export default function KOLsPage() {
  const [kols, setKols] = useState<KOL[]>([]);
  const [telegramChats, setTelegramChats] = useState<TelegramChat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchKols();
    fetchTelegramChats();
  }, []);

  const fetchKols = async () => {
    try {
      setError(null);
      const response = await fetch("/api/kols");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      const result = await response.json();
      // Normalize data to ensure _count exists
      const normalizedKols = (result.data || []).map((k: KOL) => ({
        ...k,
        _count: k._count || { campaignKols: 0, posts: 0 },
        tags: k.tags || [],
        followersCount: k.followersCount || 0,
        avgLikes: k.avgLikes || 0,
        avgRetweets: k.avgRetweets || 0,
        totalEarnings: k.totalEarnings || 0,
      }));
      setKols(normalizedKols);
    } catch (err) {
      console.error("Failed to fetch KOLs:", err);
      setError(err instanceof Error ? err.message : "Failed to load KOL roster");
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

  // Calculate summary stats with safe access
  const stats = useMemo(() => {
    // Safety check - ensure kols is an array
    const kolArray = Array.isArray(kols) ? kols : [];

    const activeKols = kolArray.filter((k) => k.status === "ACTIVE").length;
    const totalReach = kolArray.reduce((sum, k) => sum + (k.followersCount || 0), 0);
    const totalEarnings = kolArray.reduce((sum, k) => sum + (k.totalEarnings || 0), 0);
    const totalPosts = kolArray.reduce((sum, k) => sum + (k._count?.posts || 0), 0);
    const avgEngagement = kolArray.length > 0
      ? kolArray.reduce((sum, k) => {
          const followers = k.followersCount || 0;
          const er = followers > 0 ? (((k.avgLikes || 0) + (k.avgRetweets || 0)) / followers) * 100 : 0;
          return sum + er;
        }, 0) / kolArray.length
      : 0;

    return { activeKols, totalReach, totalEarnings, totalPosts, avgEngagement };
  }, [kols]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-40 bg-muted animate-pulse rounded-lg" />
            <div className="h-4 w-64 bg-muted animate-pulse rounded" />
          </div>
        </div>
        {/* Stats skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
        {/* Table skeleton */}
        <div className="h-96 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <Users className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold">KOL Roster</h1>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center">
          <p className="text-red-500 font-medium mb-2">Failed to load KOL roster</p>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <button
            onClick={fetchKols}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
          >
            Try Again
          </button>
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
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Users className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold">KOL Roster</h1>
          </div>
          <p className="text-muted-foreground">
            Manage your influencer network and track performance metrics.
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-purple-500" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Total KOLs</span>
          </div>
          <p className="text-2xl font-bold">{kols.length}</p>
          <p className="text-xs text-muted-foreground">{stats.activeKols} active</p>
        </div>

        <div className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Total Reach</span>
          </div>
          <p className="text-2xl font-bold">{formatNumber(stats.totalReach)}</p>
          <p className="text-xs text-muted-foreground">combined followers</p>
        </div>

        <div className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Total Paid</span>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.totalEarnings)}</p>
          <p className="text-xs text-muted-foreground">all time</p>
        </div>

        <div className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Megaphone className="h-4 w-4 text-amber-500" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Posts</span>
          </div>
          <p className="text-2xl font-bold">{formatNumber(stats.totalPosts)}</p>
          <p className="text-xs text-muted-foreground">delivered</p>
        </div>

        <div className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-pink-500/10 flex items-center justify-center">
              <Star className="h-4 w-4 text-pink-500" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Avg ER</span>
          </div>
          <p className="text-2xl font-bold">{stats.avgEngagement.toFixed(2)}%</p>
          <p className="text-xs text-muted-foreground">engagement rate</p>
        </div>
      </div>

      <KOLTable kols={Array.isArray(kols) ? kols : []} onAddNew={() => setShowForm(true)} onRefresh={fetchKols} />

      <KOLForm
        telegramChats={telegramChats}
        open={showForm}
        onClose={() => {
          setShowForm(false);
          fetchKols();
        }}
      />
    </div>
  );
}
