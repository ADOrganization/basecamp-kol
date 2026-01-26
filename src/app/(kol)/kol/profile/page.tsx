import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProfileForm } from "@/components/kol/profile-form";
import { RatesForm } from "@/components/kol/rates-form";
import { Users, TrendingUp, Heart, Repeat2 } from "lucide-react";

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

function getTierColor(tier: string): string {
  switch (tier) {
    case "MACRO":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
    case "LARGE":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "MID":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
  }
}

export default async function KOLProfilePage() {
  const session = await auth();

  if (!session?.user?.kolId) {
    redirect("/kol/login");
  }

  const kol = await db.kOL.findUnique({
    where: { id: session.user.kolId },
    include: {
      account: { select: { email: true } },
    },
  });

  if (!kol) {
    redirect("/kol/login");
  }

  const metrics = [
    {
      label: "Followers",
      value: formatNumber(kol.followersCount),
      icon: Users,
    },
    {
      label: "Engagement",
      value: `${kol.avgEngagementRate.toFixed(2)}%`,
      icon: TrendingUp,
    },
    {
      label: "Avg Likes",
      value: formatNumber(kol.avgLikes),
      icon: Heart,
    },
    {
      label: "Avg Retweets",
      value: formatNumber(kol.avgRetweets),
      icon: Repeat2,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-6">
        {kol.avatarUrl ? (
          <img
            src={kol.avatarUrl}
            alt={kol.name}
            className="h-24 w-24 rounded-full object-cover border-4 border-purple-200 dark:border-purple-900"
          />
        ) : (
          <div className="h-24 w-24 rounded-full bg-purple-600 flex items-center justify-center text-3xl font-bold text-white">
            {kol.name.charAt(0)}
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground">{kol.name}</h1>
            <Badge className={getTierColor(kol.tier)}>{kol.tier}</Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            @{kol.twitterHandle.replace("@", "")}
          </p>
          {kol.bio && (
            <p className="text-foreground mt-3 max-w-2xl">{kol.bio}</p>
          )}
          {kol.categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {kol.categories.map((category) => (
                <Badge key={category} variant="secondary">
                  {category}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <metric.icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{metric.label}</p>
                  <p className="text-xl font-bold">{metric.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Edit Profile</CardTitle>
          <CardDescription>
            Update your profile information visible to agencies
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            initialData={{
              name: kol.name,
              bio: kol.bio,
              categories: kol.categories,
              twitterHandle: kol.twitterHandle,
              telegramUsername: kol.telegramUsername,
            }}
          />
        </CardContent>
      </Card>

      {/* Rates */}
      <Card>
        <CardHeader>
          <CardTitle>Your Rates</CardTitle>
          <CardDescription>
            Set your rates for different types of content
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RatesForm
            initialData={{
              ratePerPost: kol.ratePerPost,
              ratePerThread: kol.ratePerThread,
              ratePerRetweet: kol.ratePerRetweet,
              ratePerSpace: kol.ratePerSpace,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
