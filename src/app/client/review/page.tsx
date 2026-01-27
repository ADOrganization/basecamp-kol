"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  ThumbsUp,
  FileText,
  Search,
} from "lucide-react";
import { formatNumber } from "@/lib/utils";

interface Post {
  id: string;
  content: string;
  status: string;
  tweetUrl: string | null;
  scheduledFor: string | null;
  postedAt: string | null;
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
  kol: {
    id: string;
    name: string;
    twitterHandle: string;
    avatarUrl: string | null;
  };
  campaign: {
    id: string;
    name: string;
  };
}

export default function ClientReviewPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const response = await fetch("/api/posts");
      if (response.ok) {
        const data = await response.json();
        setPosts(data);
      }
    } catch (error) {
      console.error("Failed to fetch posts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (postId: string) => {
    setActionLoading(postId);
    try {
      const response = await fetch(`/api/posts/${postId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      if (response.ok) {
        setPosts(posts.map(p =>
          p.id === postId ? { ...p, status: "APPROVED" } : p
        ));
        fetchPosts();
      }
    } catch (error) {
      console.error("Failed to approve post:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (postId: string) => {
    setActionLoading(postId);
    try {
      const response = await fetch(`/api/posts/${postId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });
      if (response.ok) {
        setPosts(posts.map(p =>
          p.id === postId ? { ...p, status: "REJECTED" } : p
        ));
        fetchPosts();
      }
    } catch (error) {
      console.error("Failed to reject post:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const pendingPosts = posts.filter(p => p.status === "PENDING_APPROVAL" || p.status === "DRAFT");
  const reviewedPosts = posts.filter(p => p.status !== "PENDING_APPROVAL" && p.status !== "DRAFT");
  const approvedCount = posts.filter(p => p.status === "APPROVED" || p.status === "POSTED").length;
  const rejectedCount = posts.filter(p => p.status === "REJECTED").length;

  const filteredPendingPosts = pendingPosts.filter(p =>
    p.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.kol.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.campaign.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredReviewedPosts = reviewedPosts.filter(p =>
    p.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.kol.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.campaign.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return <Badge className="bg-slate-100 text-slate-700"><FileText className="h-3 w-3 mr-1" />Draft</Badge>;
      case "PENDING_APPROVAL":
        return <Badge className="bg-amber-100 text-amber-700"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "APPROVED":
        return <Badge className="bg-teal-100 text-teal-700"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>;
      case "REJECTED":
        return <Badge className="bg-rose-100 text-rose-700"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      case "POSTED":
        return <Badge className="bg-blue-100 text-blue-700"><ExternalLink className="h-3 w-3 mr-1" />Posted</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  const PostCard = ({ post, showActions = false }: { post: Post; showActions?: boolean }) => (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 border-2 border-teal-100">
              {post.kol.avatarUrl && <AvatarImage src={post.kol.avatarUrl} alt={post.kol.name} />}
              <AvatarFallback className="bg-gradient-to-br from-teal-500 to-teal-600 text-white">
                {post.kol.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{post.kol.name}</p>
              <p className="text-sm text-muted-foreground">@{post.kol.twitterHandle}</p>
            </div>
          </div>
          {getStatusBadge(post.status)}
        </div>

        <div className="bg-muted/50 rounded-xl p-4 mb-4 border border-border">
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{post.content}</p>
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
          <span>
            {post.campaign.name}
          </span>
          {post.scheduledFor && (
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {new Date(post.scheduledFor).toLocaleDateString()}
            </span>
          )}
        </div>

        {post.status === "POSTED" && post.likes > 0 && (
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-xl mb-4">
            <div className="h-8 w-8 rounded-lg bg-rose-100 flex items-center justify-center">
              <ThumbsUp className="h-4 w-4 text-rose-600" />
            </div>
            <div>
              <p className="text-sm font-semibold">{formatNumber(post.likes)}</p>
              <p className="text-xs text-muted-foreground">Likes</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          {post.tweetUrl && (
            <a
              href={post.tweetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-teal-600 hover:text-teal-700 flex items-center gap-1 font-medium"
            >
              <ExternalLink className="h-4 w-4" />
              View on X
            </a>
          )}
          {showActions && (post.status === "PENDING_APPROVAL" || post.status === "DRAFT") && (
            <div className="flex gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleReject(post.id)}
                disabled={actionLoading === post.id}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
              >
                <XCircle className="h-4 w-4 mr-1" />
                Reject
              </Button>
              <Button
                size="sm"
                onClick={() => handleApprove(post.id)}
                disabled={actionLoading === post.id}
                className="bg-teal-600 hover:bg-teal-700"
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Approve
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 rounded-full -mr-8 -mt-8" />
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingPosts.length}</p>
                <p className="text-sm text-muted-foreground">Pending Review</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-teal-500/10 rounded-full -mr-8 -mt-8" />
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-teal-100 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-teal-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{approvedCount}</p>
                <p className="text-sm text-muted-foreground">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/10 rounded-full -mr-8 -mt-8" />
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-rose-100 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-rose-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{rejectedCount}</p>
                <p className="text-sm text-muted-foreground">Rejected</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search posts by content, KOL, or campaign..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        />
      </div>

      <Tabs defaultValue="pending" className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="pending" className="gap-2 data-[state=active]:bg-background">
            <Clock className="h-4 w-4" />
            Pending ({filteredPendingPosts.length})
          </TabsTrigger>
          <TabsTrigger value="reviewed" className="gap-2 data-[state=active]:bg-background">
            <FileText className="h-4 w-4" />
            All Posts ({filteredReviewedPosts.length + filteredPendingPosts.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {filteredPendingPosts.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center">
                <div className="h-16 w-16 rounded-full bg-teal-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="h-8 w-8 text-teal-600" />
                </div>
                <h3 className="font-semibold text-lg mb-2">All caught up!</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {searchQuery
                    ? "No posts match your search criteria."
                    : "You have no posts pending review. New content submissions will appear here."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {filteredPendingPosts.map((post) => (
                <PostCard key={post.id} post={post} showActions />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reviewed" className="space-y-4">
          {filteredReviewedPosts.length === 0 && filteredPendingPosts.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2">No posts yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {searchQuery
                    ? "No posts match your search criteria."
                    : "Posts will appear here once KOLs start creating content for your campaigns."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {[...filteredPendingPosts, ...filteredReviewedPosts].map((post) => (
                <PostCard key={post.id} post={post} showActions={post.status === "PENDING_APPROVAL" || post.status === "DRAFT"} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
