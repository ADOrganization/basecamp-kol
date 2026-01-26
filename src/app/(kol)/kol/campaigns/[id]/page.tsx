import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeliverablesTracker } from "@/components/kol/deliverables-tracker";
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  ExternalLink,
  Twitter,
} from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function getStatusColor(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "PENDING_APPROVAL":
    case "PENDING":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    case "COMPLETED":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "CONFIRMED":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
  }
}

export default async function KOLCampaignDetailPage({ params }: PageProps) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.kolId) {
    redirect("/kol/login");
  }

  const kolId = session.user.kolId;

  // Fetch campaign and KOL's assignment
  const campaignKol = await db.campaignKOL.findUnique({
    where: {
      campaignId_kolId: {
        campaignId: id,
        kolId,
      },
    },
    include: {
      campaign: {
        include: {
          posts: {
            where: { kolId },
            orderBy: { createdAt: "desc" },
          },
          payments: {
            where: { kolId },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  if (!campaignKol) {
    notFound();
  }

  const { campaign } = campaignKol;

  // Calculate deliverables completion
  const completedPosts = campaign.posts.filter(
    (p) => (p.status === "VERIFIED" || p.status === "POSTED") && p.type === "POST"
  ).length;
  const completedThreads = campaign.posts.filter(
    (p) => (p.status === "VERIFIED" || p.status === "POSTED") && p.type === "THREAD"
  ).length;
  const completedRetweets = campaign.posts.filter(
    (p) => (p.status === "VERIFIED" || p.status === "POSTED") && p.type === "RETWEET"
  ).length;
  const completedSpaces = campaign.posts.filter(
    (p) => (p.status === "VERIFIED" || p.status === "POSTED") && p.type === "SPACE"
  ).length;

  // Calculate total paid
  const totalPaid = campaign.payments
    .filter((p) => p.status === "COMPLETED")
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-8">
      {/* Back Button */}
      <Button variant="ghost" asChild className="-ml-4">
        <Link href="/kol/campaigns">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Campaigns
        </Link>
      </Button>

      {/* Header */}
      <div className="flex items-start gap-6">
        {campaign.projectAvatarUrl ? (
          <img
            src={campaign.projectAvatarUrl}
            alt={campaign.name}
            className="h-20 w-20 rounded-xl object-cover"
          />
        ) : (
          <div className="h-20 w-20 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <span className="text-2xl font-bold text-purple-600">
              {campaign.name.charAt(0)}
            </span>
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-foreground">{campaign.name}</h1>
            <Badge className={getStatusColor(campaign.status)}>
              {campaign.status}
            </Badge>
            <Badge variant="outline" className={getStatusColor(campaignKol.status)}>
              {campaignKol.status}
            </Badge>
          </div>
          {campaign.projectTwitterHandle && (
            <a
              href={`https://twitter.com/${campaign.projectTwitterHandle.replace("@", "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground mt-2"
            >
              <Twitter className="h-4 w-4" />
              {campaign.projectTwitterHandle}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {campaign.description && (
            <p className="text-muted-foreground mt-3">{campaign.description}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <DollarSign className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Assigned Budget</p>
                <p className="text-xl font-bold">
                  {formatCurrency(campaignKol.assignedBudget)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Amount Paid</p>
                <p className="text-xl font-bold">{formatCurrency(totalPaid)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Timeline</p>
                <p className="text-sm font-medium">
                  {campaign.startDate && campaign.endDate ? (
                    <>
                      {new Date(campaign.startDate).toLocaleDateString()} -{" "}
                      {new Date(campaign.endDate).toLocaleDateString()}
                    </>
                  ) : (
                    "No dates set"
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deliverables */}
      <DeliverablesTracker
        deliverables={{
          requiredPosts: campaignKol.requiredPosts,
          requiredThreads: campaignKol.requiredThreads,
          requiredRetweets: campaignKol.requiredRetweets,
          requiredSpaces: campaignKol.requiredSpaces,
          completedPosts,
          completedThreads,
          completedRetweets,
          completedSpaces,
        }}
      />

      {/* Recent Posts */}
      {campaign.posts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Posts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {campaign.posts.slice(0, 5).map((post) => (
                <div
                  key={post.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{post.type}</Badge>
                      <Badge className={getStatusColor(post.status)}>
                        {post.status}
                      </Badge>
                    </div>
                    {post.content && (
                      <p className="text-sm text-muted-foreground mt-1 truncate">
                        {post.content}
                      </p>
                    )}
                  </div>
                  {post.tweetUrl && (
                    <a
                      href={post.tweetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-4 text-purple-600 hover:text-purple-700"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Keywords */}
      {campaign.keywords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Campaign Keywords</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Include these keywords in your posts:
            </p>
            <div className="flex flex-wrap gap-2">
              {campaign.keywords.map((keyword) => (
                <Badge key={keyword} variant="secondary" className="text-sm">
                  {keyword}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
