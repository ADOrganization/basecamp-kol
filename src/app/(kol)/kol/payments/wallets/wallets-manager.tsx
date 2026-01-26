"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { WalletCard } from "@/components/kol/wallet-card";
import { WalletForm } from "@/components/kol/wallet-form";
import { ArrowLeft, Plus, Wallet } from "lucide-react";

interface Wallet {
  id: string;
  network: string;
  address: string;
  label: string | null;
  isPrimary: boolean;
}

interface WalletsManagerProps {
  wallets: Wallet[];
}

export function WalletsManager({ wallets }: WalletsManagerProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editWallet, setEditWallet] = useState<Wallet | null>(null);

  const handleEdit = (wallet: Wallet) => {
    setEditWallet(wallet);
    setIsFormOpen(true);
  };

  const handleClose = () => {
    setIsFormOpen(false);
    setEditWallet(null);
  };

  // Group wallets by network
  const walletsByNetwork: Record<string, Wallet[]> = {};
  wallets.forEach((wallet) => {
    if (!walletsByNetwork[wallet.network]) {
      walletsByNetwork[wallet.network] = [];
    }
    walletsByNetwork[wallet.network].push(wallet);
  });

  return (
    <>
      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild className="-ml-4">
          <Link href="/kol/payments">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Payments
          </Link>
        </Button>
        <Button
          onClick={() => setIsFormOpen(true)}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Wallet
        </Button>
      </div>

      {/* Wallets Grid */}
      {wallets.length === 0 ? (
        <div className="text-center py-16 bg-muted/30 rounded-lg">
          <Wallet className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold text-foreground">
            No wallets configured
          </h3>
          <p className="text-muted-foreground mt-1 max-w-md mx-auto">
            Add your crypto wallet addresses to receive payments. You can add
            multiple wallets for different networks.
          </p>
          <Button
            onClick={() => setIsFormOpen(true)}
            className="mt-4 bg-purple-600 hover:bg-purple-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Your First Wallet
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(walletsByNetwork).map(([network, networkWallets]) => (
            <div key={network}>
              <h2 className="text-lg font-semibold mb-3 capitalize">
                {network.toLowerCase().replace("bsc", "BNB Chain")}
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {networkWallets.map((wallet) => (
                  <WalletCard key={wallet.id} wallet={wallet} onEdit={handleEdit} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Wallet Form Modal */}
      <WalletForm
        isOpen={isFormOpen}
        onClose={handleClose}
        editWallet={editWallet}
      />
    </>
  );
}
