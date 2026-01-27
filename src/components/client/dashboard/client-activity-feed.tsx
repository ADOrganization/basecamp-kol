"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Activity,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  Edit,
  Send,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface ActivityItem {
  id: string;
  type: "POST_CREATED" | "POST_APPROVED" | "POST_REJECTED" | "POST_PUBLISHED" | "POST_PENDING";
  kolName: string;
  kolAvatar?: string | null;
  campaignName: string;
  postContent?: string;
  timestamp: Date;
}

interface ActivityFeedProps {
  activities: ActivityItem[];
}

const getActivityIcon = (type: ActivityItem["type"]) => {
  switch (type) {
    case "POST_CREATED":
      return <Edit className="h-4 w-4" />;
    case "POST_APPROVED":
      return <CheckCircle2 className="h-4 w-4" />;
    case "POST_REJECTED":
      return <XCircle className="h-4 w-4" />;
    case "POST_PUBLISHED":
      return <Send className="h-4 w-4" />;
    case "POST_PENDING":
      return <Clock className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

const getActivityColor = (type: ActivityItem["type"]) => {
  switch (type) {
    case "POST_CREATED":
      return "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400";
    case "POST_APPROVED":
      return "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400";
    case "POST_REJECTED":
      return "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400";
    case "POST_PUBLISHED":
      return "bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400";
    case "POST_PENDING":
      return "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  }
};

const getActivityLabel = (type: ActivityItem["type"]) => {
  switch (type) {
    case "POST_CREATED":
      return "Created post";
    case "POST_APPROVED":
      return "Post approved";
    case "POST_REJECTED":
      return "Post rejected";
    case "POST_PUBLISHED":
      return "Post published";
    case "POST_PENDING":
      return "Awaiting review";
    default:
      return "Activity";
  }
};

export function ClientActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No recent activity</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity, index) => (
              <div key={activity.id} className="relative">
                {/* Timeline connector */}
                {index !== activities.length - 1 && (
                  <div className="absolute left-[19px] top-10 w-0.5 h-full bg-border" />
                )}

                <div className="flex gap-3">
                  {/* Icon */}
                  <div
                    className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 z-10",
                      getActivityColor(activity.type)
                    )}
                  >
                    {getActivityIcon(activity.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pb-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={activity.kolAvatar || undefined} />
                          <AvatarFallback className="text-[10px]">
                            {activity.kolName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-sm truncate">
                          {activity.kolName}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatDistanceToNow(activity.timestamp, {
                          addSuffix: true,
                        })}
                      </span>
                    </div>

                    <p className="text-sm text-muted-foreground mt-1">
                      {getActivityLabel(activity.type)}
                    </p>

                    <Badge
                      variant="outline"
                      className="mt-2 text-xs font-normal"
                    >
                      {activity.campaignName}
                    </Badge>

                    {activity.postContent && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2 italic">
                        &ldquo;{activity.postContent}&rdquo;
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
