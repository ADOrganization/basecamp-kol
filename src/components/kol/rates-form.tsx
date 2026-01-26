"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, FileText, MessageSquare, Repeat2, Radio } from "lucide-react";

interface RatesFormProps {
  initialData: {
    ratePerPost: number | null;
    ratePerThread: number | null;
    ratePerRetweet: number | null;
    ratePerSpace: number | null;
  };
}

export function RatesForm({ initialData }: RatesFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Convert cents to dollars for display
  const [ratePerPost, setRatePerPost] = useState(
    initialData.ratePerPost ? (initialData.ratePerPost / 100).toString() : ""
  );
  const [ratePerThread, setRatePerThread] = useState(
    initialData.ratePerThread ? (initialData.ratePerThread / 100).toString() : ""
  );
  const [ratePerRetweet, setRatePerRetweet] = useState(
    initialData.ratePerRetweet ? (initialData.ratePerRetweet / 100).toString() : ""
  );
  const [ratePerSpace, setRatePerSpace] = useState(
    initialData.ratePerSpace ? (initialData.ratePerSpace / 100).toString() : ""
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setIsLoading(true);

    try {
      // Convert dollars to cents
      const response = await fetch("/api/kol/profile/rates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ratePerPost: ratePerPost ? Math.round(parseFloat(ratePerPost) * 100) : null,
          ratePerThread: ratePerThread ? Math.round(parseFloat(ratePerThread) * 100) : null,
          ratePerRetweet: ratePerRetweet ? Math.round(parseFloat(ratePerRetweet) * 100) : null,
          ratePerSpace: ratePerSpace ? Math.round(parseFloat(ratePerSpace) * 100) : null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to update rates");
        return;
      }

      setSuccess(true);
      router.refresh();
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const rates = [
    {
      id: "ratePerPost",
      label: "Post Rate",
      icon: FileText,
      value: ratePerPost,
      onChange: setRatePerPost,
      description: "Single tweet/post",
    },
    {
      id: "ratePerThread",
      label: "Thread Rate",
      icon: MessageSquare,
      value: ratePerThread,
      onChange: setRatePerThread,
      description: "Multi-tweet thread",
    },
    {
      id: "ratePerRetweet",
      label: "Retweet Rate",
      icon: Repeat2,
      value: ratePerRetweet,
      onChange: setRatePerRetweet,
      description: "Quote tweet or retweet",
    },
    {
      id: "ratePerSpace",
      label: "Space Rate",
      icon: Radio,
      value: ratePerSpace,
      onChange: setRatePerSpace,
      description: "Twitter/X Space appearance",
    },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-rose-50 dark:bg-rose-900/20 p-4">
          <p className="text-sm text-rose-700 dark:text-rose-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="rounded-md bg-emerald-50 dark:bg-emerald-900/20 p-4">
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            Rates updated successfully!
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {rates.map((rate) => (
          <div
            key={rate.id}
            className="p-4 rounded-lg border border-border bg-card"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <rate.icon className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <Label htmlFor={rate.id} className="font-medium">
                  {rate.label}
                </Label>
                <p className="text-xs text-muted-foreground">{rate.description}</p>
              </div>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id={rate.id}
                type="number"
                min="0"
                step="0.01"
                value={rate.value}
                onChange={(e) => rate.onChange(e.target.value)}
                className="pl-8"
                placeholder="0.00"
              />
            </div>
          </div>
        ))}
      </div>

      <Button
        type="submit"
        className="bg-purple-600 hover:bg-purple-700"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          "Save Rates"
        )}
      </Button>
    </form>
  );
}
