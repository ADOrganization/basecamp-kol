"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";

const NETWORKS = [
  { value: "ETHEREUM", label: "Ethereum", placeholder: "0x..." },
  { value: "POLYGON", label: "Polygon", placeholder: "0x..." },
  { value: "ARBITRUM", label: "Arbitrum", placeholder: "0x..." },
  { value: "OPTIMISM", label: "Optimism", placeholder: "0x..." },
  { value: "BASE", label: "Base", placeholder: "0x..." },
  { value: "BSC", label: "BNB Chain", placeholder: "0x..." },
  { value: "SOLANA", label: "Solana", placeholder: "..." },
];

interface WalletFormProps {
  isOpen: boolean;
  onClose: () => void;
  editWallet?: {
    id: string;
    network: string;
    address: string;
    label: string | null;
    isPrimary: boolean;
  } | null;
}

export function WalletForm({ isOpen, onClose, editWallet }: WalletFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [network, setNetwork] = useState(editWallet?.network || "");
  const [address, setAddress] = useState(editWallet?.address || "");
  const [label, setLabel] = useState(editWallet?.label || "");
  const [isPrimary, setIsPrimary] = useState(editWallet?.isPrimary || false);

  const isEditing = !!editWallet;

  const handleSubmit = async () => {
    setError("");

    if (!network) {
      setError("Please select a network");
      return;
    }

    if (!address) {
      setError("Please enter a wallet address");
      return;
    }

    setIsLoading(true);

    try {
      const url = isEditing
        ? `/api/kol/wallets/${editWallet.id}`
        : "/api/kol/wallets";
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          network,
          address,
          label: label || null,
          isPrimary,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to save wallet");
        return;
      }

      router.refresh();
      onClose();
      resetForm();
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setNetwork("");
    setAddress("");
    setLabel("");
    setIsPrimary(false);
    setError("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const selectedNetwork = NETWORKS.find((n) => n.value === network);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Wallet" : "Add Wallet"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update your wallet details"
              : "Add a new crypto wallet for receiving payments"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="rounded-md bg-rose-50 dark:bg-rose-900/20 p-3">
              <p className="text-sm text-rose-700 dark:text-rose-400">{error}</p>
            </div>
          )}

          <div>
            <Label htmlFor="network">Network</Label>
            <Select
              value={network}
              onValueChange={setNetwork}
              disabled={isEditing}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select network" />
              </SelectTrigger>
              <SelectContent>
                {NETWORKS.map((n) => (
                  <SelectItem key={n.value} value={n.value}>
                    {n.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="address">Wallet Address</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 font-mono text-sm"
              placeholder={selectedNetwork?.placeholder || "Enter wallet address"}
            />
          </div>

          <div>
            <Label htmlFor="label">Label (optional)</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="mt-1"
              placeholder="e.g., Main Wallet, Cold Storage"
              maxLength={50}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isPrimary"
              checked={isPrimary}
              onCheckedChange={(checked) => setIsPrimary(checked as boolean)}
            />
            <Label htmlFor="isPrimary" className="text-sm font-normal">
              Set as primary wallet for this network
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : isEditing ? (
              "Update Wallet"
            ) : (
              "Add Wallet"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
