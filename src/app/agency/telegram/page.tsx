import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send, Search, Circle } from "lucide-react";

export default async function TelegramPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Get KOLs with telegram usernames
  const kols = await db.kOL.findMany({
    where: {
      organizationId: session.user.organizationId,
      telegramUsername: { not: null },
    },
    include: {
      messages: {
        orderBy: { timestamp: "desc" },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  });

  // Get all messages grouped by KOL
  const messages = await db.telegramMessage.findMany({
    where: {
      kol: {
        organizationId: session.user.organizationId,
      },
    },
    include: {
      kol: true,
    },
    orderBy: { timestamp: "desc" },
    take: 50,
  });

  const unreadCount = messages.filter((m) => !m.isRead && m.direction === "INBOUND").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Telegram</h1>
        <p className="text-muted-foreground mt-1">
          Communicate with KOLs via Telegram
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Conversations List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Conversations</CardTitle>
              {unreadCount > 0 && (
                <Badge variant="default">{unreadCount} unread</Badge>
              )}
            </div>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search conversations..." className="pl-9" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {kols.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground text-center">
                  No KOLs with Telegram connected yet
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {kols.map((kol) => {
                  const lastMessage = kol.messages[0];
                  const hasUnread = lastMessage && !lastMessage.isRead && lastMessage.direction === "INBOUND";

                  return (
                    <button
                      key={kol.id}
                      className="w-full flex items-center gap-3 p-4 hover:bg-muted transition-colors text-left"
                    >
                      <div className="relative">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-indigo-100 text-indigo-600">
                            {kol.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        {hasUnread && (
                          <Circle className="absolute -top-0.5 -right-0.5 h-3 w-3 fill-indigo-500 text-indigo-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`font-medium truncate ${hasUnread ? "text-foreground" : ""}`}>
                            {kol.name}
                          </p>
                          {lastMessage && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(lastMessage.timestamp).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          @{kol.telegramUsername}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Message Area */}
        <Card className="lg:col-span-2">
          <CardContent className="flex flex-col items-center justify-center h-[600px]">
            <div className="text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                <MessageSquare className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-medium">Select a conversation</h3>
                <p className="text-muted-foreground mt-1">
                  Choose a KOL from the list to view messages
                </p>
              </div>
              <div className="pt-4">
                <p className="text-sm text-muted-foreground">
                  To connect Telegram, add your Telegram Bot token in Settings
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Telegram Integration Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-medium">
                1
              </div>
              <h4 className="font-medium">Create a Bot</h4>
              <p className="text-sm text-muted-foreground">
                Message @BotFather on Telegram and create a new bot to get your API token
              </p>
            </div>
            <div className="space-y-2">
              <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-medium">
                2
              </div>
              <h4 className="font-medium">Add Token in Settings</h4>
              <p className="text-sm text-muted-foreground">
                Go to Settings and add your Telegram Bot token to enable messaging
              </p>
            </div>
            <div className="space-y-2">
              <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-medium">
                3
              </div>
              <h4 className="font-medium">Connect KOLs</h4>
              <p className="text-sm text-muted-foreground">
                Add Telegram usernames to your KOLs to start conversations
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
