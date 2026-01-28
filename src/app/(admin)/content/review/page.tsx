import { getAgencyContext } from "@/lib/get-agency-context";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { CheckCircle, Clock, MessageSquare, Eye, FileText, AlertCircle } from "lucide-react";
import { PostReviewCard } from "@/components/agency/post-review-card";
import { ReviewedPostsSection } from "@/components/agency/reviewed-posts-section";

export default async function ContentReviewPage() {
  const context = await getAgencyContext();

  if (!context) {
    redirect("/admin/login");
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
      avatarUrl: post.kol.avatarUrl,
    },
    campaign: {
      name: post.campaign.name,
    },
  }));

  const serializedPendingPosts = serializedPosts.filter((p) => p.status === "PENDING_APPROVAL" || p.status === "DRAFT");
  const serializedReviewedPosts = serializedPosts.filter((p) => p.status !== "PENDING_APPROVAL" && p.status !== "DRAFT");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Content Review</h1>
          </div>
          <p className="text-muted-foreground">
            Review and approve KOL posts before they go live.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Pending</span>
          </div>
          <p className="text-2xl font-bold text-amber-600">{pendingPosts.length}</p>
          <p className="text-xs text-muted-foreground">awaiting approval</p>
        </div>

        <div className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Approved</span>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{approvedPosts.length}</p>
          <p className="text-xs text-muted-foreground">ready or posted</p>
        </div>

        <div className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-slate-500/10 flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-slate-500" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Drafts</span>
          </div>
          <p className="text-2xl font-bold">{draftPosts.length}</p>
          <p className="text-xs text-muted-foreground">in progress</p>
        </div>

        <div className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Eye className="h-4 w-4 text-indigo-500" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Total</span>
          </div>
          <p className="text-2xl font-bold">{posts.length}</p>
          <p className="text-xs text-muted-foreground">all posts</p>
        </div>
      </div>

      {/* Needs Review Section (Pending Approval + Drafts) */}
      {serializedPendingPosts.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold">Needs Review</h2>
            <span className="ml-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-xs font-medium">
              {serializedPendingPosts.length}
            </span>
          </div>
          <div className="grid gap-4">
            {serializedPendingPosts.map((post) => (
              <PostReviewCard key={post.id} post={post} showActions />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border bg-card p-8 text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-3">
            <CheckCircle className="h-6 w-6 text-emerald-500" />
          </div>
          <h3 className="font-medium">All caught up!</h3>
          <p className="text-sm text-muted-foreground mt-1">
            No posts are waiting for your review.
          </p>
        </div>
      )}

      {/* Reviewed Posts */}
      <ReviewedPostsSection posts={serializedReviewedPosts} />
    </div>
  );
}
