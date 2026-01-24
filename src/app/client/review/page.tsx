"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Eye,
  ThumbsUp,
  MessageCircle,
  Repeat2,
  FileText
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
      }
    } catch (error) {
      console.error("Failed to reject post:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const pendingPosts = posts.filter(p => p.status === "PENDING_APPROVAL");
  const reviewedPosts = posts.filter(p => p.status !== "PENDING_APPROVAL");

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING_APPROVAL":
        return <Badge className="bg-amber-100 text-amber-700"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "APPROVED":
        return <Badge className="bg-teal-100 text-teal-700"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>;
      case "REJECTED":
        return <Badge className="bg-rose-100 text-rose-700"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      case "PUBLISHED":
        return <Badge className="bg-blue-100 text-blue-700"><ExternalLink className="h-3 w-3 mr-1" />Published</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const PostCard = ({ post, showActions = false }: { post: Post; showActions?: boolean }) => (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback className="bg-teal-100 text-teal-700">
                {post.kol.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{post.kol.name}</p>
              <p className="text-sm text-muted-foreground">@{post.kol.twitterHandle}</p>
            </div>
          </div>
          {getStatusBadge(post.status)}
        </div>

        <div className="bg-slate-50 rounded-lg p-4 mb-4">
          <p className="text-sm whitespace-pre-wrap">{post.content}</p>
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
          <span>Campaign: {post.campaign.name}</span>
          {post.scheduledFor && (
            <span>Scheduled: {new Date(post.scheduledFor).toLocaleDateString()}</span>
          )}
        </div>

        {post.status === "PUBLISHED" && (
          <div className="grid grid-cols-4 gap-4 p-3 bg-slate-50 rounded-lg mb-4">
            <div className="text-center">
              <Eye className="h-4 w-4 mx-auto text-slate-500 mb-1" />
              <p className="text-sm font-medium">{formatNumber(post.impressions)}</p>
              <p className="text-xs text-muted-foreground">Views</p>
            </div>
            <div className="text-center">
              <ThumbsUp className="h-4 w-4 mx-auto text-slate-500 mb-1" />
              <p className="text-sm font-medium">{formatNumber(post.likes)}</p>
              <p className="text-xs text-muted-foreground">Likes</p>
            </div>
            <div className="text-center">
              <Repeat2 className="h-4 w-4 mx-auto text-slate-500 mb-1" />
              <p className="text-sm font-medium">{formatNumber(post.retweets)}</p>
              <p className="text-xs text-muted-foreground">Retweets</p>
            </div>
            <div className="text-center">
              <MessageCircle className="h-4 w-4 mx-auto text-slate-500 mb-1" />
              <p className="text-sm font-medium">{formatNumber(post.replies)}</p>
              <p className="text-xs text-muted-foreground">Replies</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          {post.tweetUrl && (
            <a
              href={post.tweetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              <ExternalLink className="h-4 w-4" />
              View on X
            </a>
          )}
          {showActions && post.status === "PENDING_APPROVAL" && (
            <div className="flex gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleReject(post.id)}
                disabled={actionLoading === post.id}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
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
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Review Posts</h1>
        <p className="text-muted-foreground mt-1">
          Review and approve content from your KOL campaigns
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
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
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-teal-100 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-teal-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {posts.filter(p => p.status === "APPROVED" || p.status === "PUBLISHED").length}
                </p>
                <p className="text-sm text-muted-foreground">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-rose-100 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-rose-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {posts.filter(p => p.status === "REJECTED").length}
                </p>
                <p className="text-sm text-muted-foreground">Rejected</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="space-y-6">
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            Pending ({pendingPosts.length})
          </TabsTrigger>
          <TabsTrigger value="reviewed" className="gap-2">
            <FileText className="h-4 w-4" />
            All Posts ({posts.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingPosts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto text-teal-500 mb-4" />
                <h3 className="font-semibold text-lg">All caught up!</h3>
                <p className="text-muted-foreground mt-1">
                  No posts pending your review.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {pendingPosts.map((post) => (
                <PostCard key={post.id} post={post} showActions />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reviewed" className="space-y-4">
          {posts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-slate-400 mb-4" />
                <h3 className="font-semibold text-lg">No posts yet</h3>
                <p className="text-muted-foreground mt-1">
                  Posts from your campaigns will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} showActions={post.status === "PENDING_APPROVAL"} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
