"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, Trash2, Loader2 } from "lucide-react";
import { PostReviewCard } from "./post-review-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Post {
  id: string;
  content: string | null;
  type: string;
  status: string;
  tweetUrl: string | null;
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
  kol: {
    name: string;
    twitterHandle: string;
  };
  campaign: {
    name: string;
  };
}

interface ReviewedPostsSectionProps {
  posts: Post[];
}

export function ReviewedPostsSection({ posts }: ReviewedPostsSectionProps) {
  const router = useRouter();
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClearReviewed = async () => {
    setIsClearing(true);
    setError(null);
    try {
      const response = await fetch("/api/posts/clear-reviewed", {
        method: "DELETE",
      });
      if (response.ok) {
        router.refresh();
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.error || "Failed to clear reviewed posts");
      }
    } catch (err) {
      console.error("Failed to clear reviewed posts:", err);
      setError("Failed to clear reviewed posts. Please try again.");
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Reviewed Posts</h2>
        {posts.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-rose-600 hover:text-rose-700">
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Reviewed
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all reviewed posts?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete {posts.length} reviewed post{posts.length !== 1 ? "s" : ""}.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearReviewed}
                  className="bg-rose-600 hover:bg-rose-700"
                  disabled={isClearing}
                >
                  {isClearing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Clearing...
                    </>
                  ) : (
                    "Clear All"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {error && (
        <div className="p-3 rounded bg-red-50 text-red-600 text-sm">
          {error}
        </div>
      )}

      {posts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No reviewed posts yet</h3>
            <p className="text-muted-foreground text-center mt-1">
              Posts will appear here after they have been reviewed
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {posts.map((post) => (
            <PostReviewCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
