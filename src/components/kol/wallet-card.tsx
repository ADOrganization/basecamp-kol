"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Copy, Check, MoreVertical, Pencil, Trash2, Star, Loader2 } from "lucide-react";

interface Wallet {
  id: string;
  network: string;
  address: string;
  label: string | null;
  isPrimary: boolean;
}

interface WalletCardProps {
  wallet: Wallet;
  onEdit: (wallet: Wallet) => void;
}

const NETWORK_COLORS: Record<string, string> = {
  ETHEREUM: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  POLYGON: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  ARBITRUM: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400",
  OPTIMISM: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400",
  BASE: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  BSC: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  SOLANA: "bg-gradient-to-r from-purple-100 to-teal-100 text-purple-800 dark:from-purple-900/30 dark:to-teal-900/30 dark:text-purple-400",
};

const NETWORK_LABELS: Record<string, string> = {
  ETHEREUM: "Ethereum",
  POLYGON: "Polygon",
  ARBITRUM: "Arbitrum",
  OPTIMISM: "Optimism",
  BASE: "Base",
  BSC: "BNB Chain",
  SOLANA: "Solana",
};

export function WalletCard({ wallet, onEdit }: WalletCardProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSettingPrimary, setIsSettingPrimary] = useState(false);

  const copyAddress = async () => {
    await navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/kol/wallets/${wallet.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to delete wallet:", error);
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleSetPrimary = async () => {
    setIsSettingPrimary(true);
    try {
      const response = await fetch(`/api/kol/wallets/${wallet.id}/primary`, {
        method: "PUT",
      });

      if (response.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to set primary:", error);
    } finally {
      setIsSettingPrimary(false);
    }
  };

  return (
    <>
      <Card className={wallet.isPrimary ? "border-purple-500 dark:border-purple-600" : ""}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Badge className={NETWORK_COLORS[wallet.network] || "bg-gray-100"}>
                {NETWORK_LABELS[wallet.network] || wallet.network}
              </Badge>
              {wallet.isPrimary && (
                <Badge variant="outline" className="text-purple-600 border-purple-600">
                  <Star className="h-3 w-3 mr-1 fill-current" />
                  Primary
                </Badge>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(wallet)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                {!wallet.isPrimary && (
                  <DropdownMenuItem onClick={handleSetPrimary} disabled={isSettingPrimary}>
                    {isSettingPrimary ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Star className="h-4 w-4 mr-2" />
                    )}
                    Set as Primary
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-rose-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {wallet.label && (
            <p className="text-sm font-medium mt-3">{wallet.label}</p>
          )}

          <div className="flex items-center gap-2 mt-2">
            <code className="text-xs text-muted-foreground font-mono truncate flex-1">
              {wallet.address}
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={copyAddress}
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Wallet</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this wallet? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
