import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CheckCircle, XCircle, Clock, ExternalLink, MessageSquare, Heart, Repeat2, Eye } from "lucide-react";
import Link from "next/link";

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  PENDING_APPROVAL: "outline",
  APPROVED: "default",
  REJECTED: "destructive",
  SCHEDULED: "secondary",
  POSTED: "default",
  VERIFIED: "default",
};

export default async function ContentReviewPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const posts = await db.post.findMany({
    where: {
      campaign: {
        agencyId: session.user.organizationId,
      },
    },
    include: {
      kol: true,
      campaign: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const pendingPosts = posts.filter((p) => p.status === "PENDING_APPROVAL");
  const approvedPosts = posts.filter((p) => p.status === "APPROVED" || p.status === "POSTED" || p.status === "VERIFIED");
  const draftPosts = posts.filter((p) => p.status === "DRAFT");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Content Review</h1>
        <p className="text-muted-foreground mt-1">
          Review and approve KOL posts before they go live
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="metric-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingPosts.length}</div>
            <p className="text-xs text-muted-foreground">Awaiting approval</p>
          </CardContent>
        </Card>
        <Card className="metric-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-teal-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedPosts.length}</div>
            <p className="text-xs text-muted-foreground">Ready or posted</p>
          </CardContent>
        </Card>
        <Card className="metric-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Drafts</CardTitle>
            <MessageSquare className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{draftPosts.length}</div>
            <p className="text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>
        <Card className="metric-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
            <Eye className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{posts.length}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Approval Section */}
      {pendingPosts.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Pending Approval</h2>
          <div className="grid gap-4">
            {pendingPosts.map((post) => (
              <Card key={post.id} className="card-hover border-amber-200 dark:border-amber-900">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-indigo-100 text-indigo-600">
                          {post.kol.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{post.kol.name}</span>
                          <span className="text-muted-foreground">@{post.kol.twitterHandle}</span>
                          <Badge variant={statusColors[post.status]}>{post.status.replace("_", " ")}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Campaign: {post.campaign.name}
                        </p>
                        <div className="bg-muted p-4 rounded-lg mt-2">
                          <p className="text-sm whitespace-pre-wrap">{post.content || "No content provided"}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="text-rose-600 hover:text-rose-700">
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                      <Button size="sm" className="bg-teal-600 hover:bg-teal-700">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* All Posts */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">All Posts</h2>
        {posts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No posts yet</h3>
              <p className="text-muted-foreground text-center mt-1">
                Posts will appear here when KOLs submit content for review
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {posts.map((post) => (
              <Card key={post.id} className="card-hover">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-indigo-100 text-indigo-600">
                          {post.kol.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{post.kol.name}</span>
                          <span className="text-sm text-muted-foreground">@{post.kol.twitterHandle}</span>
                          <Badge variant={statusColors[post.status]}>{post.status.replace("_", " ")}</Badge>
                          <Badge variant="outline">{post.type}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {post.campaign.name}
                        </p>
                        {post.content && (
                          <p className="text-sm mt-2 line-clamp-2">{post.content}</p>
                        )}
                        {post.status === "POSTED" && (
                          <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Eye className="h-4 w-4" />
                              {post.impressions.toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Heart className="h-4 w-4" />
                              {post.likes.toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Repeat2 className="h-4 w-4" />
                              {post.retweets.toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageSquare className="h-4 w-4" />
                              {post.replies.toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    {post.tweetUrl && (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={post.tweetUrl} target="_blank">
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
