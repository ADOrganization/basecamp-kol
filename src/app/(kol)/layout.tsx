import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { KOLSidebar } from "@/components/kol/sidebar";

export default async function KOLLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const session = await auth();

    if (!session?.user) {
      redirect("/kol/login");
    }

    if (!session.user.isKol || !session.user.kolId) {
      redirect("/kol/login");
    }

    // Fetch fresh KOL data from database for sidebar
    let kolName = session.user.name || "KOL";
    let kolEmail = session.user.email || "";
    let kolAvatarUrl: string | null = null;
    let kolTwitterHandle: string | null = null;

    try {
      const freshKol = await db.kOL.findUnique({
        where: { id: session.user.kolId },
        select: {
          name: true,
          avatarUrl: true,
          twitterHandle: true,
          account: {
            select: {
              email: true,
            },
          },
        },
      });

      if (freshKol) {
        kolName = freshKol.name ?? kolName;
        kolAvatarUrl = freshKol.avatarUrl ?? null;
        kolTwitterHandle = freshKol.twitterHandle ? `@${freshKol.twitterHandle.replace('@', '')}` : null;
        kolEmail = freshKol.account?.email ?? kolEmail;
      }
    } catch (dbError) {
      console.error("Error fetching KOL data:", dbError);
      // Continue with session data
    }

    return (
      <div className="flex h-screen bg-background">
        <KOLSidebar
          user={{
            name: kolName,
            email: kolEmail,
            avatarUrl: kolAvatarUrl,
            twitterHandle: kolTwitterHandle,
          }}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="p-8">{children}</div>
        </main>
      </div>
    );
  } catch (error) {
    console.error("KOL layout error:", error);
    redirect("/kol/login");
  }
}
