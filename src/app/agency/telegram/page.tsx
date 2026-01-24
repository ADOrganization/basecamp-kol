import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TelegramConversations } from "@/components/agency/telegram-conversations";

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
        take: 50,
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

  // Transform kols to serializable format
  const serializedKols = kols.map(kol => ({
    id: kol.id,
    name: kol.name,
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
          Communicate with KOLs via Telegram
        </p>
      </div>

      <TelegramConversations kols={serializedKols} unreadCount={unreadCount} />

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
