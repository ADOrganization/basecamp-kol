import { getAgencyContext } from "@/lib/get-agency-context";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Clock, MessageSquare, Eye } from "lucide-react";
import { PostReviewCard } from "@/components/agency/post-review-card";
import { ReviewedPostsSection } from "@/components/agency/reviewed-posts-section";

export default async function ContentReviewPage() {
  const context = await getAgencyContext();

  if (!context) {
    redirect("/login");
  }

  const posts = await db.post.findMany({
    where: {
      campaign: {
        agencyId: context.organizationId,
      },
      hiddenFromReview: false,
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

  // Serialize posts for client component
  const serializedPosts = posts.map((post) => ({
    id: post.id,
    content: post.content,
    type: post.type,
    status: post.status,
    tweetUrl: post.tweetUrl,
    impressions: post.impressions,
    likes: post.likes,
    retweets: post.retweets,
    replies: post.replies,
    quotes: post.quotes,
    bookmarks: post.bookmarks,
    kol: {
      name: post.kol.name,
      twitterHandle: post.kol.twitterHandle,
    },
    campaign: {
      name: post.campaign.name,
    },
  }));

  const serializedPendingPosts = serializedPosts.filter((p) => p.status === "PENDING_APPROVAL" || p.status === "DRAFT");
  const serializedReviewedPosts = serializedPosts.filter((p) => p.status !== "PENDING_APPROVAL" && p.status !== "DRAFT");

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
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
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

      {/* Needs Review Section (Pending Approval + Drafts) */}
      {serializedPendingPosts.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Needs Review</h2>
          <div className="grid gap-4">
            {serializedPendingPosts.map((post) => (
              <PostReviewCard key={post.id} post={post} showActions />
            ))}
          </div>
        </div>
      )}

      {/* Reviewed Posts */}
      <ReviewedPostsSection posts={serializedReviewedPosts} />
    </div>
  );
}
