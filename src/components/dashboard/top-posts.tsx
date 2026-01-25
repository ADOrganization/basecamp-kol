"use client";

import Link from "next/link";
import { formatNumber } from "@/lib/utils";
import { Eye, Heart, Repeat2, ExternalLink, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TopPost {
  id: string;
  content: string | null;
  impressions: number;
  likes: number;
  retweets: number;
  engagementRate: number;
  tweetUrl: string | null;
  kol: {
    name: string;
    twitterHandle: string;
  };
  campaign: {
    name: string;
  };
}

interface TopPostsProps {
  posts: TopPost[];
}

export function TopPosts({ posts }: TopPostsProps) {
  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <TrendingUp className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">No posts with metrics yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {posts.map((post, index) => (
        <div
          key={post.id}
          className="group relative flex items-start gap-3 p-4 rounded-xl border bg-card hover:border-primary/50 transition-all"
        >
          {/* Rank badge */}
          <div className={`
            flex items-center justify-center w-8 h-8 rounded-full shrink-0 font-bold text-sm
            ${index === 0 ? "bg-amber-500/20 text-amber-500" : ""}
            ${index === 1 ? "bg-slate-400/20 text-slate-400" : ""}
            ${index === 2 ? "bg-orange-600/20 text-orange-600" : ""}
            ${index > 2 ? "bg-muted text-muted-foreground" : ""}
          `}>
            #{index + 1}
          </div>

          <div className="flex-1 min-w-0">
            {/* KOL info */}
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">{post.kol.name}</span>
              <span className="text-xs text-muted-foreground">@{post.kol.twitterHandle}</span>
            </div>

            {/* Content preview */}
            {post.content && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                {post.content}
              </p>
            )}

            {/* Metrics */}
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1 text-indigo-500">
                <Eye className="h-3.5 w-3.5" />
                {formatNumber(post.impressions)}
              </span>
              <span className="flex items-center gap-1 text-rose-500">
                <Heart className="h-3.5 w-3.5" />
                {formatNumber(post.likes)}
              </span>
              <span className="flex items-center gap-1 text-emerald-500">
                <Repeat2 className="h-3.5 w-3.5" />
                {formatNumber(post.retweets)}
              </span>
              <Badge variant="outline" className="text-xs">
                {post.engagementRate.toFixed(1)}% ER
              </Badge>
            </div>
          </div>

          {/* View link */}
          {post.tweetUrl && (
            <Link
              href={post.tweetUrl}
              target="_blank"
              className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg hover:bg-muted"
            >
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
