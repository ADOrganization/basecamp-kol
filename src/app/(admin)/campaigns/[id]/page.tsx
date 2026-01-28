"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CampaignForm } from "@/components/agency/campaign-form";
import { DeliverablesProgress, calculateDeliverables } from "@/components/agency/deliverables-progress";
import {
  formatNumber,
  formatCurrency,
  getStatusColor,
  getTierColor,
} from "@/lib/utils";
import {
  ArrowLeft,
  Edit,
  Plus,
  Users,
  FileText,
  BarChart3,
  Trash2,
  ExternalLink,
  Hash,
  X,
  RefreshCw,
  Loader2,
  MoreVertical,
  CheckCircle,
  Archive,
  Play,
  Pause,
  XCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PostForm } from "@/components/agency/post-form";
import { PostDetailModal } from "@/components/agency/post-detail-modal";
import { TweetScraper } from "@/components/agency/tweet-scraper";
import { TweetMonitor } from "@/components/agency/tweet-monitor";
import { ReportGenerator } from "@/components/agency/report-generator";
import { CampaignDocuments } from "@/components/agency/campaign-documents";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FolderOpen } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CampaignDetails {
  id: string;
  name: string;
  description: string | null;
  projectTwitterHandle: string | null;
  clientTelegramChatId: string | null;
  keywords: string[];
  status: string;
  totalBudget: number;
  spentBudget: number;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  client: { id: string; name: string; slug: string } | null;
  agency: { id: string; name: string };
  clientUsers?: { email: string; name: string | null }[];
  campaignKols: {
    id: string;
    status: string;
    assignedBudget: number;
    requiredPosts: number;
    requiredThreads: number;
    requiredRetweets: number;
    requiredSpaces: number;
    deliverables: { type: string; quantity: number }[] | null;
    kol: {
      id: string;
      name: string;
      twitterHandle: string;
      avatarUrl: string | null;
      tier: string;
      followersCount: number;
      avgEngagementRate: number;
      ratePerPost: number | null;
      ratePerThread: number | null;
      ratePerRetweet: number | null;
      ratePerSpace: number | null;
    };
  }[];
  posts: {
    id: string;
    type: string | null;
    status: string | null;
    content: string | null;
    tweetUrl: string | null;
    matchedKeywords: string[] | null;
    hasKeywordMatch: boolean | null;
    impressions: number | null;
    likes: number | null;
    retweets: number | null;
    replies: number | null;
    quotes: number | null;
    bookmarks: number | null;
    postedAt: string | null;
    createdAt: string;
    kol: {
      id: string;
      name: string;
      twitterHandle: string;
      avatarUrl: string | null;
    } | null;
  }[];
}

interface AvailableKOL {
  id: string;
  name: string;
  twitterHandle: string;
  tier: string;
  followersCount: number;
  ratePerPost: number | null;
  ratePerThread: number | null;
  ratePerRetweet: number | null;
  ratePerSpace: number | null;
}

interface TelegramChat {
  id: string;
  telegramChatId: string;
  title: string | null;
}

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [campaign, setCampaign] = useState<CampaignDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showAddKol, setShowAddKol] = useState(false);
  const [showAddPost, setShowAddPost] = useState(false);
  const [availableKols, setAvailableKols] = useState<AvailableKOL[]>([]);
  const [telegramChats, setTelegramChats] = useState<TelegramChat[]>([]);
  const [selectedKol, setSelectedKol] = useState("");
  const [assignedBudget, setAssignedBudget] = useState("");
  const [requiredPosts, setRequiredPosts] = useState("");
  const [requiredThreads, setRequiredThreads] = useState("");
  const [requiredRetweets, setRequiredRetweets] = useState("");
  const [requiredSpaces, setRequiredSpaces] = useState("");
  const [isAddingKol, setIsAddingKol] = useState(false);

  // Edit KOL state
  const [showEditKol, setShowEditKol] = useState(false);
  const [editingKol, setEditingKol] = useState<CampaignDetails["campaignKols"][0] | null>(null);
  const [editBudget, setEditBudget] = useState("");
  const [editPosts, setEditPosts] = useState("");
  const [editThreads, setEditThreads] = useState("");
  const [editRetweets, setEditRetweets] = useState("");
  const [editSpaces, setEditSpaces] = useState("");
  const [isUpdatingKol, setIsUpdatingKol] = useState(false);

  // Filtering state
  const [showKeywordMatchesOnly, setShowKeywordMatchesOnly] = useState(false);
  const [filterByKol, setFilterByKol] = useState("all");

  // Scraper state
  const [showScraper, setShowScraper] = useState(false);

  // Report generator state
  const [showReportGenerator, setShowReportGenerator] = useState(false);

  // Post detail modal state
  const [selectedPost, setSelectedPost] = useState<CampaignDetails["posts"][0] | null>(null);
  const [showPostDetail, setShowPostDetail] = useState(false);

  // Post delete state
  const [postToDelete, setPostToDelete] = useState<CampaignDetails["posts"][0] | null>(null);
  const [showDeletePostDialog, setShowDeletePostDialog] = useState(false);
  const [isDeletingPost, setIsDeletingPost] = useState(false);

  // Refresh metrics state
  const [isRefreshingMetrics, setIsRefreshingMetrics] = useState(false);

  // API key and cookie state for scraper/monitor
  const [twitterApiKey, setTwitterApiKey] = useState("");
  const [twitterCookies, setTwitterCookies] = useState("");
  const [twitterCsrfToken, setTwitterCsrfToken] = useState("");

  // Campaign actions state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Document count state
  const [documentCount, setDocumentCount] = useState(0);

  // Load auth from localStorage
  useEffect(() => {
    const savedApiKey = localStorage.getItem("twitter_api_key");
    const savedCookies = localStorage.getItem("twitter_cookies");
    const savedCsrf = localStorage.getItem("twitter_csrf");
    if (savedApiKey) setTwitterApiKey(savedApiKey);
    if (savedCookies) setTwitterCookies(savedCookies);
    if (savedCsrf) setTwitterCsrfToken(savedCsrf);
  }, []);

  const fetchCampaign = async () => {
    try {
      // Add timestamp to bust any caches
      const response = await fetch(`/api/campaigns/${id}?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setCampaign(data);
      } else if (response.status === 404) {
        router.push("/campaigns");
      }
    } catch (error) {
      console.error("Failed to fetch campaign:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaign();
    fetchTelegramChats();
    fetchDocumentCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Update selected post when campaign data refreshes
  useEffect(() => {
    if (selectedPost && campaign && showPostDetail) {
      const updatedPost = campaign.posts.find(p => p.id === selectedPost.id);
      if (updatedPost && JSON.stringify(updatedPost) !== JSON.stringify(selectedPost)) {
        setSelectedPost(updatedPost);
      }
    }
    // Only run when campaign changes, not when selectedPost changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign]);

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

  const fetchDocumentCount = async () => {
    try {
      const response = await fetch(`/api/campaigns/${id}/documents`);
      if (response.ok) {
        const data = await response.json();
        setDocumentCount(Array.isArray(data) ? data.length : 0);
      }
    } catch (error) {
      console.error("Failed to fetch document count:", error);
    }
  };

  const fetchAvailableKols = async () => {
    try {
      const response = await fetch("/api/kols");
      if (response.ok) {
        const result = await response.json();
        // API returns { data: [...], pagination: {...} }
        const allKols = result.data || [];
        const assignedKolIds = campaign?.campaignKols.map((ck) => ck.kol.id) || [];
        const available = allKols.filter((kol: AvailableKOL) => !assignedKolIds.includes(kol.id));
        setAvailableKols(available);
      }
    } catch (error) {
      console.error("Failed to fetch KOLs:", error);
    }
  };

  const handleUpdateCampaignStatus = async (status: string) => {
    setIsUpdatingStatus(true);
    try {
      const response = await fetch(`/api/campaigns/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (response.ok) {
        fetchCampaign();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to update campaign status");
      }
    } catch (error) {
      console.error("Failed to update campaign status:", error);
      alert("Failed to update campaign status");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDeleteCampaign = async () => {
    try {
      const response = await fetch(`/api/campaigns/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        router.push("/campaigns");
      } else {
        const data = await response.json();
        alert(data.error || "Failed to delete campaign");
      }
    } catch (error) {
      console.error("Failed to delete campaign:", error);
      alert("Failed to delete campaign");
    }
  };

  const handleDeletePost = async () => {
    if (!postToDelete) return;
    setIsDeletingPost(true);
    try {
      const response = await fetch(`/api/posts/${postToDelete.id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        await fetchCampaign();
        setShowDeletePostDialog(false);
        setPostToDelete(null);
      } else {
        const data = await response.json();
        alert(data.error || "Failed to delete post");
      }
    } catch (error) {
      console.error("Failed to delete post:", error);
      alert("Failed to delete post");
    } finally {
      setIsDeletingPost(false);
    }
  };

  const handleRefreshAllMetrics = async () => {
    if (!campaign || campaign.posts.length === 0) return;
    setIsRefreshingMetrics(true);

    try {
      // Use bulk refresh endpoint
      const response = await fetch(`/api/campaigns/${id}/refresh-metrics`, {
        method: "POST",
      });

      const result = await response.json();

      if (response.ok) {
        // Check API configuration status
        const apiStatus = result.apiStatus;
        const usingFallback = apiStatus?.usingFallback;

        // Show feedback to user with debug info
        if (result.refreshed > 0) {
          let message = `Refreshed ${result.refreshed}/${result.total} posts.`;
          if (result.failed > 0) message += ` ${result.failed} failed.`;

          // Warn if using fallback (unreliable)
          if (usingFallback) {
            message += `\n\n⚠️ Using fallback API (limited data). Configure SocialData or Apify key in Settings → Integrations for full metrics.`;
          }

          // Show saved metrics for debugging
          if (result.debug?.savedMetrics) {
            const sample = result.debug.savedMetrics.slice(0, 2);
            message += `\n\nSaved:\n${sample.map((m: { postId: string; views: number; likes: number; retweets: number }) =>
              `${m.views.toLocaleString()} views, ${m.likes} likes, ${m.retweets} retweets`
            ).join('\n')}`;
          }
          alert(message);
        } else if (!result.scraperConfigured || usingFallback) {
          alert('Refresh failed: No API key configured.\n\nThe fallback Twitter API is unreliable.\n\nGo to Settings → Integrations to add your SocialData API key for reliable tweet metrics.');
        } else if (result.errors && result.errors.length > 0) {
          alert(`Could not refresh posts.\n\nErrors:\n${result.errors.slice(0, 3).join('\n')}`);
        } else {
          alert('No posts could be refreshed. Please try again later.');
        }
      } else {
        alert(result.error || 'Failed to refresh metrics');
      }

      // Refetch campaign to get updated metrics
      await fetchCampaign();
    } catch (error) {
      console.error("Failed to refresh metrics:", error);
      alert('Failed to refresh metrics. Please try again.');
    } finally {
      setIsRefreshingMetrics(false);
    }
  };

  const handleAddKol = async () => {
    if (!selectedKol) return;
    setIsAddingKol(true);

    try {
      const response = await fetch(`/api/campaigns/${id}/kols`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kolId: selectedKol,
          assignedBudget: assignedBudget ? Math.round(Number(assignedBudget) * 100) : 0,
          requiredPosts: requiredPosts ? Number(requiredPosts) : 0,
          requiredThreads: requiredThreads ? Number(requiredThreads) : 0,
          requiredRetweets: requiredRetweets ? Number(requiredRetweets) : 0,
          requiredSpaces: requiredSpaces ? Number(requiredSpaces) : 0,
        }),
      });

      if (response.ok) {
        setShowAddKol(false);
        resetKolForm();
        fetchCampaign();
      }
    } catch (error) {
      console.error("Failed to add KOL:", error);
    } finally {
      setIsAddingKol(false);
    }
  };

  const resetKolForm = () => {
    setSelectedKol("");
    setAssignedBudget("");
    setRequiredPosts("");
    setRequiredThreads("");
    setRequiredRetweets("");
    setRequiredSpaces("");
  };

  // Calculate budget based on KOL rates and deliverables
  const calculateBudget = (kolId: string, posts: string, threads: string, retweets: string, spaces: string) => {
    const kol = availableKols.find(k => k.id === kolId);
    if (!kol) return;

    const postsCount = parseInt(posts) || 0;
    const threadsCount = parseInt(threads) || 0;
    const retweetsCount = parseInt(retweets) || 0;
    const spacesCount = parseInt(spaces) || 0;

    // Rates are stored in cents
    const postsCost = postsCount * (kol.ratePerPost || 0);
    const threadsCost = threadsCount * (kol.ratePerThread || 0);
    const retweetsCost = retweetsCount * (kol.ratePerRetweet || 0);
    const spacesCost = spacesCount * (kol.ratePerSpace || 0);

    const totalCents = postsCost + threadsCost + retweetsCost + spacesCost;
    const totalDollars = totalCents / 100;

    setAssignedBudget(totalDollars.toFixed(2));
  };

  // Calculate budget from campaign KOL data (for display in table)
  const getKolBudget = (ck: CampaignDetails["campaignKols"][0]): number => {
    // If stored budget exists and is non-zero, use it
    if (ck.assignedBudget > 0) {
      return ck.assignedBudget;
    }
    // Otherwise calculate from rates × deliverables
    const postsCost = ck.requiredPosts * (ck.kol.ratePerPost || 0);
    const threadsCost = ck.requiredThreads * (ck.kol.ratePerThread || 0);
    const retweetsCost = ck.requiredRetweets * (ck.kol.ratePerRetweet || 0);
    const spacesCost = ck.requiredSpaces * (ck.kol.ratePerSpace || 0);
    return postsCost + threadsCost + retweetsCost + spacesCost;
  };

  // Update budget when KOL or deliverables change
  const handleKolSelect = (kolId: string) => {
    setSelectedKol(kolId);
    calculateBudget(kolId, requiredPosts, requiredThreads, requiredRetweets, requiredSpaces);
  };

  const handleDeliverablesChange = (type: string, value: string) => {
    switch (type) {
      case "posts":
        setRequiredPosts(value);
        calculateBudget(selectedKol, value, requiredThreads, requiredRetweets, requiredSpaces);
        break;
      case "threads":
        setRequiredThreads(value);
        calculateBudget(selectedKol, requiredPosts, value, requiredRetweets, requiredSpaces);
        break;
      case "retweets":
        setRequiredRetweets(value);
        calculateBudget(selectedKol, requiredPosts, requiredThreads, value, requiredSpaces);
        break;
      case "spaces":
        setRequiredSpaces(value);
        calculateBudget(selectedKol, requiredPosts, requiredThreads, requiredRetweets, value);
        break;
    }
  };

  const handleRemoveKol = async (kolId: string) => {
    if (!confirm("Remove this KOL from the campaign?")) return;

    try {
      await fetch(`/api/campaigns/${id}/kols?kolId=${kolId}`, {
        method: "DELETE",
      });
      fetchCampaign();
    } catch (error) {
      console.error("Failed to remove KOL:", error);
    }
  };

  // Calculate edit budget based on KOL rates and deliverables
  const calculateEditBudget = (kol: CampaignDetails["campaignKols"][0]["kol"], posts: string, threads: string, retweets: string, spaces: string) => {
    const postsCount = parseInt(posts) || 0;
    const threadsCount = parseInt(threads) || 0;
    const retweetsCount = parseInt(retweets) || 0;
    const spacesCount = parseInt(spaces) || 0;

    // Rates are stored in cents
    const postsCost = postsCount * (kol.ratePerPost || 0);
    const threadsCost = threadsCount * (kol.ratePerThread || 0);
    const retweetsCost = retweetsCount * (kol.ratePerRetweet || 0);
    const spacesCost = spacesCount * (kol.ratePerSpace || 0);

    const totalCents = postsCost + threadsCost + retweetsCost + spacesCost;
    const totalDollars = totalCents / 100;

    setEditBudget(totalDollars.toFixed(2));
  };

  const handleEditDeliverableChange = (type: string, value: string) => {
    if (!editingKol) return;
    switch (type) {
      case "posts":
        setEditPosts(value);
        calculateEditBudget(editingKol.kol, value, editThreads, editRetweets, editSpaces);
        break;
      case "threads":
        setEditThreads(value);
        calculateEditBudget(editingKol.kol, editPosts, value, editRetweets, editSpaces);
        break;
      case "retweets":
        setEditRetweets(value);
        calculateEditBudget(editingKol.kol, editPosts, editThreads, value, editSpaces);
        break;
      case "spaces":
        setEditSpaces(value);
        calculateEditBudget(editingKol.kol, editPosts, editThreads, editRetweets, value);
        break;
    }
  };

  const handleEditKol = (ck: CampaignDetails["campaignKols"][0]) => {
    setEditingKol(ck);
    // Calculate budget based on current deliverables and KOL rates
    const postsCount = ck.requiredPosts;
    const threadsCount = ck.requiredThreads;
    const retweetsCount = ck.requiredRetweets;
    const spacesCount = ck.requiredSpaces;

    const postsCost = postsCount * (ck.kol.ratePerPost || 0);
    const threadsCost = threadsCount * (ck.kol.ratePerThread || 0);
    const retweetsCost = retweetsCount * (ck.kol.ratePerRetweet || 0);
    const spacesCost = spacesCount * (ck.kol.ratePerSpace || 0);

    const totalCents = postsCost + threadsCost + retweetsCost + spacesCost;
    const totalDollars = totalCents / 100;

    setEditBudget(totalDollars.toFixed(2));
    setEditPosts(ck.requiredPosts.toString());
    setEditThreads(ck.requiredThreads.toString());
    setEditRetweets(ck.requiredRetweets.toString());
    setEditSpaces(ck.requiredSpaces.toString());
    setShowEditKol(true);
  };

  const handleUpdateKol = async () => {
    if (!editingKol) return;
    setIsUpdatingKol(true);

    try {
      const response = await fetch(`/api/campaigns/${id}/kols`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kolId: editingKol.kol.id,
          assignedBudget: editBudget ? Math.round(Number(editBudget) * 100) : 0,
          requiredPosts: editPosts ? Number(editPosts) : 0,
          requiredThreads: editThreads ? Number(editThreads) : 0,
          requiredRetweets: editRetweets ? Number(editRetweets) : 0,
          requiredSpaces: editSpaces ? Number(editSpaces) : 0,
        }),
      });

      if (response.ok) {
        setShowEditKol(false);
        setEditingKol(null);
        fetchCampaign();
      }
    } catch (error) {
      console.error("Failed to update KOL:", error);
    } finally {
      setIsUpdatingKol(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!campaign) return null;

  const totalLikes = campaign.posts.reduce((sum, p) => sum + (p.likes || 0), 0);
  const totalEngagement = campaign.posts.reduce((sum, p) => sum + (p.likes || 0) + (p.retweets || 0) + (p.replies || 0) + (p.quotes || 0) + (p.bookmarks || 0), 0);
  const assignedBudgetTotal = campaign.campaignKols.reduce((sum, ck) => sum + getKolBudget(ck), 0);

  // Filter posts
  const filteredPosts = campaign.posts.filter((post) => {
    if (showKeywordMatchesOnly && !post.hasKeywordMatch) return false;
    if (filterByKol && filterByKol !== "all" && post.kol?.id !== filterByKol) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{campaign.name}</h1>
              <Badge className={getStatusColor(campaign.status)} variant="secondary">
                {campaign.status.replace("_", " ")}
              </Badge>
            </div>
            <div className="flex items-center gap-4 mt-1 text-muted-foreground">
              {campaign.client && <span>Client: {campaign.client.name}</span>}
              {campaign.projectTwitterHandle && (
                <span className="flex items-center gap-1">
                  <span>Project: {campaign.projectTwitterHandle}</span>
                </span>
              )}
              {campaign.clientTelegramChatId ? (
                <span className="flex items-center gap-1 text-green-600">
                  <span>Telegram: Configured</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-600">
                  <span>Telegram: Not configured</span>
                </span>
              )}
            </div>
            {(campaign.keywords || []).length > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <div className="flex flex-wrap gap-1">
                  {(campaign.keywords || []).map((kw) => (
                    <Badge key={kw} variant="outline" className="text-xs">
                      {kw}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowReportGenerator(true)}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
          <Button variant="outline" onClick={() => setShowScraper(true)}>
            <FileText className="h-4 w-4 mr-2" />
            Scrape Posts
          </Button>
          <Button onClick={() => setShowForm(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" disabled={isUpdatingStatus}>
                {isUpdatingStatus ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MoreVertical className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {campaign.status === "DRAFT" && (
                <DropdownMenuItem onClick={() => handleUpdateCampaignStatus("ACTIVE")}>
                  <Play className="h-4 w-4 mr-2 text-emerald-500" />
                  Activate Campaign
                </DropdownMenuItem>
              )}
              {campaign.status === "ACTIVE" && (
                <>
                  <DropdownMenuItem onClick={() => handleUpdateCampaignStatus("PAUSED")}>
                    <Pause className="h-4 w-4 mr-2 text-amber-500" />
                    Pause Campaign
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleUpdateCampaignStatus("COMPLETED")}>
                    <CheckCircle className="h-4 w-4 mr-2 text-blue-500" />
                    Mark Complete
                  </DropdownMenuItem>
                </>
              )}
              {campaign.status === "PAUSED" && (
                <>
                  <DropdownMenuItem onClick={() => handleUpdateCampaignStatus("ACTIVE")}>
                    <Play className="h-4 w-4 mr-2 text-emerald-500" />
                    Resume Campaign
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleUpdateCampaignStatus("COMPLETED")}>
                    <CheckCircle className="h-4 w-4 mr-2 text-blue-500" />
                    Mark Complete
                  </DropdownMenuItem>
                </>
              )}
              {(campaign.status === "COMPLETED" || campaign.status === "CANCELLED") && (
                <DropdownMenuItem onClick={() => handleUpdateCampaignStatus("ACTIVE")}>
                  <Play className="h-4 w-4 mr-2 text-emerald-500" />
                  Reactivate
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => handleUpdateCampaignStatus("CANCELLED")}>
                <XCircle className="h-4 w-4 mr-2 text-orange-500" />
                Cancel Campaign
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowDeleteDialog(true)}
                className="text-rose-600 focus:text-rose-600 focus:bg-rose-500/10"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Campaign
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Budget</p>
          <p className="text-2xl font-bold">{formatCurrency(campaign.totalBudget)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatCurrency(assignedBudgetTotal)} assigned
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">KOLs Assigned</p>
          <p className="text-2xl font-bold">{campaign.campaignKols.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Posts</p>
          <p className="text-2xl font-bold">{campaign.posts.length}</p>
          {(campaign.keywords || []).length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {campaign.posts.filter(p => p.hasKeywordMatch).length} with keywords
            </p>
          )}
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Engagement</p>
          <p className="text-2xl font-bold">{formatNumber(totalEngagement)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatNumber(totalLikes)} likes
          </p>
        </div>
      </div>

      {/* Keyword Monitor */}
      {(campaign.keywords || []).length > 0 && (
        <TweetMonitor
          campaignId={id}
          campaignName={campaign.name}
          kols={campaign.campaignKols.map((ck) => ({
            id: ck.kol.id,
            name: ck.kol.name,
            handle: ck.kol.twitterHandle,
          }))}
          keywords={campaign.keywords || []}
          twitterApiKey={twitterApiKey}
          twitterCookies={twitterCookies}
          twitterCsrfToken={twitterCsrfToken}
        />
      )}

      {/* Tabs */}
      <Tabs defaultValue="kols">
        <TabsList>
          <TabsTrigger value="kols" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            KOLs ({campaign.campaignKols.length})
          </TabsTrigger>
          <TabsTrigger value="posts" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Posts ({campaign.posts.length})
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Documents ({documentCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kols" className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">Assigned KOLs</h3>
            <Button
              size="sm"
              onClick={() => {
                fetchAvailableKols();
                setShowAddKol(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add KOL
            </Button>
          </div>

          <div className="rounded-lg border bg-card">
            {campaign.campaignKols.length === 0 ? (
              <p className="p-6 text-muted-foreground">No KOLs assigned yet.</p>
            ) : (
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium text-muted-foreground">KOL</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Tier</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Deliverables</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">Budget</th>
                    <th className="w-[100px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {campaign.campaignKols.map((ck) => {
                    // Get posts for this KOL
                    const kolPosts = campaign.posts.filter(p => p.kol?.id === ck.kol.id);
                    const deliverables = calculateDeliverables(kolPosts, {
                      posts: ck.requiredPosts,
                      threads: ck.requiredThreads,
                      retweets: ck.requiredRetweets,
                      spaces: ck.requiredSpaces,
                    });

                    return (
                      <tr key={ck.id} className="border-t">
                        <td className="p-4">
                          <Link
                            href={`/kols/${ck.kol.id}`}
                            className="flex items-center gap-3 hover:text-primary"
                          >
                            {ck.kol.avatarUrl ? (
                              <img
                                src={ck.kol.avatarUrl}
                                alt={ck.kol.name}
                                className="h-8 w-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-sm font-medium">
                                {ck.kol.name.charAt(0)}
                              </div>
                            )}
                            <div>
                              <p className="font-medium">{ck.kol.name}</p>
                              <p className="text-sm text-muted-foreground">@{ck.kol.twitterHandle}</p>
                            </div>
                          </Link>
                        </td>
                        <td className="p-4">
                          <Badge className={getTierColor(ck.kol.tier)} variant="secondary">
                            {ck.kol.tier}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <DeliverablesProgress deliverables={deliverables} compact />
                        </td>
                        <td className="p-4 text-right font-medium">
                          {formatCurrency(getKolBudget(ck))}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditKol(ck)}
                              title="Edit deliverables"
                            >
                              <Edit className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveKol(ck.kol.id)}
                              title="Remove from campaign"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="posts" className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <h3 className="font-semibold">Campaign Posts</h3>

              {/* Filters */}
              <div className="flex items-center gap-2">
                {(campaign.keywords || []).length > 0 && (
                  <Button
                    variant={showKeywordMatchesOnly ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowKeywordMatchesOnly(!showKeywordMatchesOnly)}
                  >
                    <Hash className="h-4 w-4 mr-1" />
                    Keywords Only
                  </Button>
                )}
                {campaign.campaignKols.length > 0 && (
                  <Select value={filterByKol} onValueChange={setFilterByKol}>
                    <SelectTrigger className="w-[160px] h-9">
                      <SelectValue placeholder="All KOLs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All KOLs</SelectItem>
                      {campaign.campaignKols.map((ck) => (
                        <SelectItem key={ck.kol.id} value={ck.kol.id}>
                          @{ck.kol.twitterHandle}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {(showKeywordMatchesOnly || filterByKol !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowKeywordMatchesOnly(false);
                      setFilterByKol("all");
                    }}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefreshAllMetrics}
                disabled={isRefreshingMetrics || campaign.posts.length === 0}
              >
                {isRefreshingMetrics ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Refresh Metrics
              </Button>
              <Button
                size="sm"
                onClick={() => setShowAddPost(true)}
                disabled={campaign.campaignKols.length === 0}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Post
              </Button>
            </div>
          </div>
          <div className="rounded-lg border bg-card">
            {filteredPosts.length === 0 ? (
              <p className="p-6 text-muted-foreground">
                {campaign.posts.length === 0 ? "No posts tracked yet." : "No posts match the current filters."}
              </p>
            ) : (
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium text-muted-foreground">KOL</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Content</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Type</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                    {(campaign.keywords || []).length > 0 && (
                      <th className="text-left p-4 font-medium text-muted-foreground">Keywords</th>
                    )}
                    <th className="text-left p-4 font-medium text-muted-foreground">Posted</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">Views</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">Likes</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">Reposts</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">Comments</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">Bookmarks</th>
                    <th className="w-[100px] text-right p-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPosts.map((post) => (
                    <tr
                      key={post.id}
                      className="border-t hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => {
                        setSelectedPost(post);
                        setShowPostDetail(true);
                      }}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={post.kol?.avatarUrl || undefined} alt={post.kol?.name || "KOL"} />
                            <AvatarFallback className="text-xs">
                              {post.kol?.name?.charAt(0).toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{post.kol?.name || "Unknown"}</p>
                            <p className="text-sm text-muted-foreground">@{post.kol?.twitterHandle || "unknown"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 max-w-[200px]">
                        {post.content ? (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {post.content}
                          </p>
                        ) : (
                          <span className="text-muted-foreground text-sm italic">No content</span>
                        )}
                      </td>
                      <td className="p-4">{post.type || "POST"}</td>
                      <td className="p-4">
                        <Badge className={getStatusColor(post.status || "POSTED")} variant="secondary">
                          {(post.status || "POSTED").replace("_", " ")}
                        </Badge>
                      </td>
                      {(campaign.keywords || []).length > 0 && (
                        <td className="p-4">
                          {post.matchedKeywords && post.matchedKeywords.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {post.matchedKeywords.map((kw) => (
                                <Badge key={kw} variant="secondary" className="text-xs bg-green-100 text-green-700">
                                  {kw}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </td>
                      )}
                      <td className="p-4 text-sm text-muted-foreground">
                        {post.postedAt ? new Date(post.postedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        }) : "-"}
                      </td>
                      <td className="p-4 text-right text-sm">{formatNumber(post.impressions || 0)}</td>
                      <td className="p-4 text-right text-sm">{formatNumber(post.likes || 0)}</td>
                      <td className="p-4 text-right text-sm">{formatNumber(post.retweets || 0)}</td>
                      <td className="p-4 text-right text-sm">{formatNumber(post.replies || 0)}</td>
                      <td className="p-4 text-right text-sm">{formatNumber(post.bookmarks || 0)}</td>
                      <td className="p-4 flex items-center gap-1">
                        {post.tweetUrl && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(post.tweetUrl!, "_blank");
                            }}
                            title="View on X"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPostToDelete(post);
                            setShowDeletePostDialog(true);
                          }}
                          title="Delete post"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <CampaignDocuments campaignId={campaign.id} campaignName={campaign.name} />
        </TabsContent>
      </Tabs>

      {/* Edit Campaign Dialog */}
      <CampaignForm
        campaign={{
          ...campaign,
          clientTelegramChatId: campaign.clientTelegramChatId || null,
          keywords: Array.isArray(campaign.keywords) ? campaign.keywords : [],
        }}
        telegramChats={telegramChats}
        open={showForm}
        onClose={() => {
          setShowForm(false);
          fetchCampaign();
        }}
      />

      {/* Add KOL Dialog */}
      <Dialog open={showAddKol} onOpenChange={setShowAddKol}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add KOL to Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select KOL</Label>
              <Select value={selectedKol} onValueChange={handleKolSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a KOL" />
                </SelectTrigger>
                <SelectContent>
                  {availableKols.map((kol) => (
                    <SelectItem key={kol.id} value={kol.id}>
                      {kol.name} (@{kol.twitterHandle}) - {kol.tier}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedKol && (() => {
                const kol = availableKols.find(k => k.id === selectedKol);
                if (!kol) return null;
                const hasRates = kol.ratePerPost || kol.ratePerThread || kol.ratePerRetweet || kol.ratePerSpace;
                if (!hasRates) return (
                  <p className="text-xs text-amber-600 mt-1">No rates configured for this KOL</p>
                );
                return (
                  <div className="text-xs text-muted-foreground mt-1 space-x-2">
                    {kol.ratePerPost && <span>Post: ${(kol.ratePerPost / 100).toFixed(0)}</span>}
                    {kol.ratePerThread && <span>Thread: ${(kol.ratePerThread / 100).toFixed(0)}</span>}
                    {kol.ratePerRetweet && <span>RT: ${(kol.ratePerRetweet / 100).toFixed(0)}</span>}
                    {kol.ratePerSpace && <span>Space: ${(kol.ratePerSpace / 100).toFixed(0)}</span>}
                  </div>
                );
              })()}
            </div>

            <div className="space-y-2">
              <Label>Assigned Budget (USD)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={assignedBudget}
                onChange={(e) => setAssignedBudget(e.target.value)}
                placeholder="Enter budget"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Auto-suggested from rates, but you can override
              </p>
            </div>

            <div className="pt-2 border-t">
              <Label className="text-sm font-medium">Required Deliverables</Label>
              <p className="text-xs text-muted-foreground mb-3">
                Set the number of each content type this KOL should deliver
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Posts</Label>
                  <Input
                    type="number"
                    min="0"
                    value={requiredPosts}
                    onChange={(e) => handleDeliverablesChange("posts", e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Threads</Label>
                  <Input
                    type="number"
                    min="0"
                    value={requiredThreads}
                    onChange={(e) => handleDeliverablesChange("threads", e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Retweets</Label>
                  <Input
                    type="number"
                    min="0"
                    value={requiredRetweets}
                    onChange={(e) => handleDeliverablesChange("retweets", e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Spaces</Label>
                  <Input
                    type="number"
                    min="0"
                    value={requiredSpaces}
                    onChange={(e) => handleDeliverablesChange("spaces", e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowAddKol(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddKol} disabled={!selectedKol || isAddingKol}>
                {isAddingKol ? "Adding..." : "Add KOL"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit KOL Dialog */}
      <Dialog open={showEditKol} onOpenChange={setShowEditKol}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit KOL Deliverables</DialogTitle>
          </DialogHeader>
          {editingKol && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                {editingKol.kol.avatarUrl ? (
                  <img
                    src={editingKol.kol.avatarUrl}
                    alt={editingKol.kol.name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                    {editingKol.kol.name.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="font-medium">{editingKol.kol.name}</p>
                  <p className="text-sm text-muted-foreground">@{editingKol.kol.twitterHandle}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Assigned Budget (USD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editBudget}
                  readOnly
                  className="bg-muted"
                  placeholder="Auto-calculated"
                />
                <p className="text-xs text-muted-foreground">
                  Auto-calculated from KOL rates × deliverables
                </p>
              </div>

              <div className="pt-2 border-t">
                <Label className="text-sm font-medium">Required Deliverables</Label>
                <p className="text-xs text-muted-foreground mb-3">
                  Update the number of each content type this KOL should deliver
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Posts</Label>
                    <Input
                      type="number"
                      min="0"
                      value={editPosts}
                      onChange={(e) => handleEditDeliverableChange("posts", e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Threads</Label>
                    <Input
                      type="number"
                      min="0"
                      value={editThreads}
                      onChange={(e) => handleEditDeliverableChange("threads", e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Retweets</Label>
                    <Input
                      type="number"
                      min="0"
                      value={editRetweets}
                      onChange={(e) => handleEditDeliverableChange("retweets", e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Spaces</Label>
                    <Input
                      type="number"
                      min="0"
                      value={editSpaces}
                      onChange={(e) => handleEditDeliverableChange("spaces", e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setShowEditKol(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateKol} disabled={isUpdatingKol}>
                  {isUpdatingKol ? "Updating..." : "Update"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Post Dialog */}
      <PostForm
        campaignId={id}
        campaignKeywords={campaign.keywords || []}
        kols={campaign.campaignKols.map((ck) => ({
          id: ck.kol.id,
          name: ck.kol.name,
          twitterHandle: ck.kol.twitterHandle,
        }))}
        open={showAddPost}
        onClose={() => {
          setShowAddPost(false);
          fetchCampaign();
        }}
      />

      {/* Tweet Scraper Dialog */}
      <TweetScraper
        campaignId={id}
        kols={campaign.campaignKols.map((ck) => ({
          id: ck.kol.id,
          name: ck.kol.name,
          handle: ck.kol.twitterHandle,
        }))}
        keywords={campaign.keywords || []}
        open={showScraper}
        onClose={() => setShowScraper(false)}
        onImportComplete={() => {
          setShowScraper(false);
          fetchCampaign();
        }}
      />

      {/* Post Detail Modal */}
      <PostDetailModal
        post={selectedPost}
        open={showPostDetail}
        onClose={() => setShowPostDetail(false)}
        onRefresh={async () => {
          await fetchCampaign();
        }}
        onEdit={(post) => {
          // Close detail modal and open edit form
          setShowPostDetail(false);
          // TODO: Open edit form - for now we can redirect or show a form
          // The PostForm component can be used for editing too
        }}
        onDelete={async (postId) => {
          const response = await fetch(`/api/posts/${postId}`, {
            method: "DELETE",
          });
          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || "Failed to delete post");
          }
          await fetchCampaign();
        }}
      />

      {/* Report Generator */}
      <ReportGenerator
        campaignId={id}
        campaignName={campaign.name}
        campaignStartDate={campaign.startDate}
        campaignEndDate={campaign.endDate}
        open={showReportGenerator}
        onClose={() => setShowReportGenerator(false)}
      />

      {/* Delete Campaign Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{campaign.name}&rdquo;? This will permanently remove the campaign, all associated KOL assignments, and {campaign.posts.length} posts. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCampaign}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Delete Campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Post Dialog */}
      <AlertDialog open={showDeletePostDialog} onOpenChange={setShowDeletePostDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this post from {postToDelete?.kol?.name || "Unknown KOL"}? This action cannot be undone and all metrics data will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingPost}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePost}
              disabled={isDeletingPost}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isDeletingPost ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Post"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
