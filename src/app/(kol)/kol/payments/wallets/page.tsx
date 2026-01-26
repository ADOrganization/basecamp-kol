import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { WalletsManager } from "./wallets-manager";

export default async function KOLWalletsPage() {
  const session = await auth();

  if (!session?.user?.kolId) {
    redirect("/kol/login");
  }

  const wallets = await db.kOLWallet.findMany({
    where: { kolId: session.user.kolId },
    orderBy: [{ network: "asc" }, { isPrimary: "desc" }, { createdAt: "asc" }],
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Wallet Configuration</h1>
        <p className="text-muted-foreground mt-1">
          Manage your crypto wallets for receiving payments
        </p>
      </div>

      <WalletsManager wallets={wallets} />
    </div>
  );
}
