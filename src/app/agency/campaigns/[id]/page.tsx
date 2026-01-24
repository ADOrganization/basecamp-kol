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
  Filter,
  X,
  Bell,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PostForm } from "@/components/agency/post-form";
import { TweetScraper } from "@/components/agency/tweet-scraper";
import { TweetMonitor } from "@/components/agency/tweet-monitor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  keywords: string[];
  status: string;
  totalBudget: number;
  spentBudget: number;
  startDate: string | null;
  endDate: string | null;
  kpis: {
    impressions?: number;
    engagement?: number;
    clicks?: number;
    followers?: number;
  } | null;
  createdAt: string;
  client: { id: string; name: string; slug: string } | null;
  agency: { id: string; name: string };
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
      tier: string;
      followersCount: number;
      avgEngagementRate: number;
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
    postedAt: string | null;
    createdAt: string;
    kol: {
      id: string;
      name: string;
      twitterHandle: string;
    } | null;
  }[];
}

interface AvailableKOL {
  id: string;
  name: string;
  twitterHandle: string;
  tier: string;
  followersCount: number;
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
  const [selectedKol, setSelectedKol] = useState("");
  const [assignedBudget, setAssignedBudget] = useState("");
  const [requiredPosts, setRequiredPosts] = useState("");
  const [requiredThreads, setRequiredThreads] = useState("");
  const [requiredRetweets, setRequiredRetweets] = useState("");
  const [requiredSpaces, setRequiredSpaces] = useState("");
  const [isAddingKol, setIsAddingKol] = useState(false);

  // Filtering state
  const [showKeywordMatchesOnly, setShowKeywordMatchesOnly] = useState(false);
  const [filterByKol, setFilterByKol] = useState("");

  // Scraper state
  const [showScraper, setShowScraper] = useState(false);

  // API key and cookie state for scraper/monitor
  const [twitterApiKey, setTwitterApiKey] = useState("");
  const [twitterCookies, setTwitterCookies] = useState("");
  const [twitterCsrfToken, setTwitterCsrfToken] = useState("");

  // Load auth from localStorage
  useEffect(() => {
    const savedApiKey = localStorage.getItem("twitter_api_key");
    const savedCookies = localStorage.getItem("twitter_cookies");
    const savedCsrf = localStorage.getItem("twitter_csrf");
    if (savedApiKey) setTwitterApiKey(savedApiKey);
    if (savedCookies) setTwitterCookies(savedCookies);
    if (savedCsrf) setTwitterCsrfToken(savedCsrf);
  }, []);

  useEffect(() => {
    fetchCampaign();
  }, [id]);

  const fetchCampaign = async () => {
    try {
      const response = await fetch(`/api/campaigns/${id}`);
      if (response.ok) {
        const data = await response.json();
        setCampaign(data);
      } else if (response.status === 404) {
        router.push("/agency/campaigns");
      }
    } catch (error) {
      console.error("Failed to fetch campaign:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAvailableKols = async () => {
    try {
      const response = await fetch("/api/kols");
      if (response.ok) {
        const allKols = await response.json();
        const assignedKolIds = campaign?.campaignKols.map((ck) => ck.kol.id) || [];
        const available = allKols.filter((kol: AvailableKOL) => !assignedKolIds.includes(kol.id));
        setAvailableKols(available);
      }
    } catch (error) {
      console.error("Failed to fetch KOLs:", error);
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

  const handleUpdateKolStatus = async (kolId: string, status: string) => {
    try {
      const response = await fetch(`/api/campaigns/${id}/kols/${kolId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        fetchCampaign();
      }
    } catch (error) {
      console.error("Failed to update KOL status:", error);
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

  const totalImpressions = campaign.posts.reduce((sum, p) => sum + (p.impressions || 0), 0);
  const totalEngagement = campaign.posts.reduce((sum, p) => sum + (p.likes || 0) + (p.retweets || 0) + (p.replies || 0), 0);
  const assignedBudgetTotal = campaign.campaignKols.reduce((sum, ck) => sum + ck.assignedBudget, 0);

  // Filter posts
  const filteredPosts = campaign.posts.filter((post) => {
    if (showKeywordMatchesOnly && !post.hasKeywordMatch) return false;
    if (filterByKol && post.kol?.id !== filterByKol) return false;
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
          <Button variant="outline" onClick={() => setShowScraper(true)}>
            <FileText className="h-4 w-4 mr-2" />
            Scrape Tweets
          </Button>
          <Button onClick={() => setShowForm(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
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
          <p className="text-sm text-muted-foreground">Total Impressions</p>
          <p className="text-2xl font-bold">{formatNumber(totalImpressions)}</p>
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
          <TabsTrigger value="kpis" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            KPIs
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
                    <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                    <th className="w-[50px]"></th>
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
                            href={`/agency/kols/${ck.kol.id}`}
                            className="flex items-center gap-3 hover:text-primary"
                          >
                            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-sm font-medium">
                              {ck.kol.name.charAt(0)}
                            </div>
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
                          {formatCurrency(ck.assignedBudget)}
                        </td>
                        <td className="p-4">
                          <Select
                            value={ck.status}
                            onValueChange={(value) => handleUpdateKolStatus(ck.kol.id, value)}
                          >
                            <SelectTrigger className="w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PENDING">Pending</SelectItem>
                              <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                              <SelectItem value="DECLINED">Declined</SelectItem>
                              <SelectItem value="COMPLETED">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-4">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveKol(ck.kol.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
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
                      <SelectItem value="">All KOLs</SelectItem>
                      {campaign.campaignKols.map((ck) => (
                        <SelectItem key={ck.kol.id} value={ck.kol.id}>
                          @{ck.kol.twitterHandle}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {(showKeywordMatchesOnly || filterByKol) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowKeywordMatchesOnly(false);
                      setFilterByKol("");
                    }}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => setShowAddPost(true)}
              disabled={campaign.campaignKols.length === 0}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Post
            </Button>
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
                    <th className="text-left p-4 font-medium text-muted-foreground">Type</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                    {(campaign.keywords || []).length > 0 && (
                      <th className="text-left p-4 font-medium text-muted-foreground">Keywords</th>
                    )}
                    <th className="text-right p-4 font-medium text-muted-foreground">Impressions</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">Engagement</th>
                    <th className="w-[50px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPosts.map((post) => (
                    <tr key={post.id} className="border-t">
                      <td className="p-4">
                        <p className="font-medium">{post.kol?.name || "Unknown"}</p>
                        <p className="text-sm text-muted-foreground">@{post.kol?.twitterHandle || "unknown"}</p>
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
                      <td className="p-4 text-right">{formatNumber(post.impressions || 0)}</td>
                      <td className="p-4 text-right">
                        {formatNumber((post.likes || 0) + (post.retweets || 0) + (post.replies || 0))}
                      </td>
                      <td className="p-4">
                        {post.tweetUrl && (
                          <a
                            href={post.tweetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="kpis" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-lg border bg-card p-6">
              <h3 className="font-semibold mb-4">Current Performance</h3>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Impressions</span>
                  <span className="font-medium">{formatNumber(totalImpressions)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Engagement</span>
                  <span className="font-medium">{formatNumber(totalEngagement)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Posts</span>
                  <span className="font-medium">{campaign.posts.length}</span>
                </div>
                {(campaign.keywords || []).length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Posts with Keywords</span>
                    <span className="font-medium">{campaign.posts.filter(p => p.hasKeywordMatch).length}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border bg-card p-6">
              <h3 className="font-semibold mb-4">Target KPIs</h3>
              {campaign.kpis ? (
                <div className="space-y-4">
                  {campaign.kpis.impressions && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Target Impressions</span>
                      <span className="font-medium">{formatNumber(campaign.kpis.impressions)}</span>
                    </div>
                  )}
                  {campaign.kpis.engagement && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Target Engagement %</span>
                      <span className="font-medium">{campaign.kpis.engagement}%</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">No target KPIs set.</p>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Campaign Dialog */}
      <CampaignForm
        campaign={{
          ...campaign,
          clientId: campaign.client?.id || null,
          keywords: Array.isArray(campaign.keywords) ? campaign.keywords : [],
          kpis: campaign.kpis || null,
        }}
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
              <Select value={selectedKol} onValueChange={setSelectedKol}>
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
            </div>

            <div className="space-y-2">
              <Label>Assigned Budget (USD)</Label>
              <Input
                type="number"
                step="0.01"
                value={assignedBudget}
                onChange={(e) => setAssignedBudget(e.target.value)}
                placeholder="0.00"
              />
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
                    onChange={(e) => setRequiredPosts(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Threads</Label>
                  <Input
                    type="number"
                    min="0"
                    value={requiredThreads}
                    onChange={(e) => setRequiredThreads(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Retweets</Label>
                  <Input
                    type="number"
                    min="0"
                    value={requiredRetweets}
                    onChange={(e) => setRequiredRetweets(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Spaces</Label>
                  <Input
                    type="number"
                    min="0"
                    value={requiredSpaces}
                    onChange={(e) => setRequiredSpaces(e.target.value)}
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
    </div>
  );
}
