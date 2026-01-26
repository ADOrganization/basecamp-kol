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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface JoinRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: {
    id: string;
    name: string;
    projectTwitterHandle: string | null;
  };
}

export function JoinRequestModal({ isOpen, onClose, campaign }: JoinRequestModalProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch(`/api/kol/campaigns/${campaign.id}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message || null }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to submit request");
        return;
      }

      router.refresh();
      onClose();
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request to Join Campaign</DialogTitle>
          <DialogDescription>
            Submit a request to join <strong>{campaign.name}</strong>
            {campaign.projectTwitterHandle && ` (${campaign.projectTwitterHandle})`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="rounded-md bg-rose-50 dark:bg-rose-900/20 p-3">
              <p className="text-sm text-rose-700 dark:text-rose-400">{error}</p>
            </div>
          )}

          <div>
            <Label htmlFor="message">Message (optional)</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell the agency why you'd be a great fit for this campaign..."
              className="mt-1"
              rows={4}
              maxLength={500}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {message.length}/500 characters
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
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
                Submitting...
              </>
            ) : (
              "Submit Request"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
