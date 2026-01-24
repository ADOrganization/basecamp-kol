"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface KOLFormProps {
  kol?: {
    id: string;
    name: string;
    twitterHandle: string;
    telegramUsername: string | null;
    email: string | null;
    tier: string;
    status: string;
    ratePerPost: number | null;
    ratePerThread: number | null;
    ratePerRetweet: number | null;
    ratePerSpace: number | null;
    walletAddress: string | null;
    paymentNotes: string | null;
    notes: string | null;
  };
  open: boolean;
  onClose: () => void;
}

export function KOLForm({ kol, open, onClose }: KOLFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    name: kol?.name || "",
    twitterHandle: kol?.twitterHandle || "",
    telegramUsername: kol?.telegramUsername || "",
    email: kol?.email || "",
    tier: kol?.tier || "MICRO",
    status: kol?.status || "ACTIVE",
    ratePerPost: kol?.ratePerPost ? kol.ratePerPost / 100 : "",
    ratePerThread: kol?.ratePerThread ? kol.ratePerThread / 100 : "",
    ratePerRetweet: kol?.ratePerRetweet ? kol.ratePerRetweet / 100 : "",
    ratePerSpace: kol?.ratePerSpace ? kol.ratePerSpace / 100 : "",
    walletAddress: kol?.walletAddress || "",
    paymentNotes: kol?.paymentNotes || "",
    notes: kol?.notes || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const payload = {
        ...formData,
        ratePerPost: formData.ratePerPost ? Math.round(Number(formData.ratePerPost) * 100) : undefined,
        ratePerThread: formData.ratePerThread ? Math.round(Number(formData.ratePerThread) * 100) : undefined,
        ratePerRetweet: formData.ratePerRetweet ? Math.round(Number(formData.ratePerRetweet) * 100) : undefined,
        ratePerSpace: formData.ratePerSpace ? Math.round(Number(formData.ratePerSpace) * 100) : undefined,
      };

      const url = kol ? `/api/kols/${kol.id}` : "/api/kols";
      const method = kol ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to save KOL");
        setIsLoading(false);
        return;
      }

      router.refresh();
      onClose();
    } catch {
      setError("An error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{kol ? "Edit KOL" : "Add New KOL"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-medium">Basic Information</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="twitterHandle">Twitter Handle *</Label>
                <Input
                  id="twitterHandle"
                  value={formData.twitterHandle}
                  onChange={(e) => setFormData({ ...formData, twitterHandle: e.target.value })}
                  placeholder="@handle"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telegramUsername">Telegram Username</Label>
                <Input
                  id="telegramUsername"
                  value={formData.telegramUsername}
                  onChange={(e) => setFormData({ ...formData, telegramUsername: e.target.value })}
                  placeholder="@telegram"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="kol@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tier">Tier *</Label>
                <Select
                  value={formData.tier}
                  onValueChange={(value) => setFormData({ ...formData, tier: value })}
                >
                  <SelectTrigger id="tier">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NANO">Nano (&lt;10K)</SelectItem>
                    <SelectItem value="MICRO">Micro (10K-100K)</SelectItem>
                    <SelectItem value="MID">Mid (100K-500K)</SelectItem>
                    <SelectItem value="MACRO">Macro (500K-1M)</SelectItem>
                    <SelectItem value="MEGA">Mega (1M+)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="BLACKLISTED">Blacklisted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Rates */}
          <div className="space-y-4">
            <h3 className="font-medium">Rates (USD)</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ratePerPost">Rate per Post</Label>
                <Input
                  id="ratePerPost"
                  type="number"
                  step="0.01"
                  value={formData.ratePerPost}
                  onChange={(e) => setFormData({ ...formData, ratePerPost: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ratePerThread">Rate per Thread</Label>
                <Input
                  id="ratePerThread"
                  type="number"
                  step="0.01"
                  value={formData.ratePerThread}
                  onChange={(e) => setFormData({ ...formData, ratePerThread: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ratePerRetweet">Rate per Retweet</Label>
                <Input
                  id="ratePerRetweet"
                  type="number"
                  step="0.01"
                  value={formData.ratePerRetweet}
                  onChange={(e) => setFormData({ ...formData, ratePerRetweet: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ratePerSpace">Rate per Space</Label>
                <Input
                  id="ratePerSpace"
                  type="number"
                  step="0.01"
                  value={formData.ratePerSpace}
                  onChange={(e) => setFormData({ ...formData, ratePerSpace: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* Payment Info */}
          <div className="space-y-4">
            <h3 className="font-medium">Payment Information</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="walletAddress">Wallet Address</Label>
                <Input
                  id="walletAddress"
                  value={formData.walletAddress}
                  onChange={(e) => setFormData({ ...formData, walletAddress: e.target.value })}
                  placeholder="0x..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentNotes">Payment Notes</Label>
                <Textarea
                  id="paymentNotes"
                  value={formData.paymentNotes}
                  onChange={(e) => setFormData({ ...formData, paymentNotes: e.target.value })}
                  placeholder="Preferred payment method, network, etc."
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Internal Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional notes about this KOL..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : kol ? "Save Changes" : "Add KOL"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
