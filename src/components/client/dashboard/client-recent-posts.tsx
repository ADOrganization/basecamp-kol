"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { FileText, Eye, Heart, Repeat2, MessageCircle, ExternalLink } from "lucide-react";
import { formatNumber, cn } from "@/lib/utils";

interface RecentPost {
  id: string;
  content: string | null;
  tweetUrl: string | null;
  status: string;
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
  postedAt: string | null;
  createdAt: string;
  kolName: string;
  kolHandle: string;
  kolAvatar: string | null;
}

interface ClientRecentPostsProps {
  posts: RecentPost[];
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  POSTED: { label: "Live", color: "text-emerald-600 bg-emerald-500/10" },
  VERIFIED: { label: "Verified", color: "text-emerald-600 bg-emerald-500/10" },
  PENDING_APPROVAL: { label: "Pending", color: "text-amber-600 bg-amber-500/10" },
  APPROVED: { label: "Approved", color: "text-blue-600 bg-blue-500/10" },
  REJECTED: { label: "Rejected", color: "text-rose-600 bg-rose-500/10" },
  DRAFT: { label: "Draft", color: "text-gray-600 bg-gray-500/10" },
};

export function ClientRecentPosts({ posts }: ClientRecentPostsProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-sky-500" />
          Recent Posts
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        {posts.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm">No posts yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => {
              const totalEngagement = post.likes + post.retweets + post.replies;
              const statusInfo = STATUS_MAP[post.status] || STATUS_MAP.DRAFT;
              const date = post.postedAt || post.createdAt;
              const formattedDate = new Date(date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              });

              return (
                <div
                  key={post.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <Avatar className="h-7 w-7 flex-shrink-0 mt-0.5">
                    <AvatarImage src={post.kolAvatar || undefined} />
                    <AvatarFallback className="text-xs">
                      {post.kolName?.charAt(0) || "K"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium truncate">
                        @{post.kolHandle}
                      </span>
                      <Badge
                        variant="secondary"
                        className={cn("text-[10px] px-1.5 py-0 h-4", statusInfo.color)}
                      >
                        {statusInfo.label}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">
                        {formattedDate}
                      </span>
                    </div>
                    {post.content && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mb-1.5">
                        {post.content.slice(0, 80)}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {formatNumber(post.impressions)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        {formatNumber(post.likes)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Repeat2 className="h-3 w-3" />
                        {formatNumber(post.retweets)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        {formatNumber(post.replies)}
                      </span>
                      {post.tweetUrl && (
                        <a
                          href={post.tweetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto text-primary hover:underline flex items-center gap-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3 w-3" />
                          View
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
