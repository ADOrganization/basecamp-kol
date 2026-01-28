import { getAgencyContext } from "@/lib/get-agency-context";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TelegramConversations } from "@/components/agency/telegram-conversations";
import { TelegramGroups } from "@/components/agency/telegram-groups";
import { TelegramBroadcast } from "@/components/agency/telegram-broadcast";
import { Users, MessageSquare, Send } from "lucide-react";

export default async function TelegramPage() {
  const context = await getAgencyContext();

  if (!context) {
    redirect("/admin/login");
  }

  // Get KOLs with telegram usernames
  const kols = await db.kOL.findMany({
    where: {
      organizationId: context.organizationId,
      telegramUsername: { not: null },
    },
    include: {
      messages: {
        orderBy: { timestamp: "desc" },
        take: 50,
      },
    },
    orderBy: { name: "asc" },
  });

  // Get all messages grouped by KOL
  const messages = await db.telegramMessage.findMany({
    where: {
      kol: {
        organizationId: context.organizationId,
      },
    },
    include: {
      kol: true,
    },
    orderBy: { timestamp: "desc" },
    take: 50,
  });

  // Get campaigns for filters
  const campaigns = await db.campaign.findMany({
    where: {
      agencyId: context.organizationId,
      status: { in: ["ACTIVE", "PAUSED"] },
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });

  // Get group chat count
  const groupChatCount = await db.telegramChat.count({
    where: {
      organizationId: context.organizationId,
      status: "ACTIVE",
    },
  });

  const unreadCount = messages.filter((m) => !m.isRead && m.direction === "INBOUND").length;

  // Transform kols to serializable format
  const serializedKols = kols.map(kol => ({
    id: kol.id,
    name: kol.name,
    avatarUrl: kol.avatarUrl,
    telegramUsername: kol.telegramUsername,
    messages: kol.messages.map(m => ({
      id: m.id,
      content: m.content,
      direction: m.direction,
      isRead: m.isRead,
      timestamp: m.timestamp,
    })),
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Telegram</h1>
        <p className="text-muted-foreground mt-1">
          Manage group chats and communicate with KOLs via Telegram
        </p>
      </div>

      <Tabs defaultValue="groups" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="groups" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Groups
            {groupChatCount > 0 && (
              <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                {groupChatCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="conversations" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            1:1 Chats
            {unreadCount > 0 && (
              <span className="ml-1 text-xs bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="broadcast" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Broadcast
          </TabsTrigger>
        </TabsList>

        <TabsContent value="groups">
          <TelegramGroups campaigns={campaigns} />
        </TabsContent>

        <TabsContent value="conversations">
          <TelegramConversations kols={serializedKols} unreadCount={unreadCount} />
        </TabsContent>

        <TabsContent value="broadcast">
          <TelegramBroadcast campaigns={campaigns} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
