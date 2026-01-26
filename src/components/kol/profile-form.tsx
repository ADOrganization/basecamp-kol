"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, X } from "lucide-react";

const CATEGORY_OPTIONS = [
  "DeFi",
  "Gaming",
  "NFT",
  "AI",
  "Layer 1",
  "Layer 2",
  "Infrastructure",
  "Trading",
  "Memes",
  "Social",
  "DAO",
  "Privacy",
  "Metaverse",
  "RWA",
];

interface ProfileFormProps {
  initialData: {
    name: string;
    bio: string | null;
    categories: string[];
    twitterHandle: string;
    telegramUsername: string | null;
  };
}

export function ProfileForm({ initialData }: ProfileFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState(initialData.name);
  const [bio, setBio] = useState(initialData.bio || "");
  const [categories, setCategories] = useState<string[]>(initialData.categories);
  const [twitterHandle, setTwitterHandle] = useState(initialData.twitterHandle);
  const [telegramUsername, setTelegramUsername] = useState(initialData.telegramUsername || "");

  const toggleCategory = (category: string) => {
    if (categories.includes(category)) {
      setCategories(categories.filter((c) => c !== category));
    } else if (categories.length < 10) {
      setCategories([...categories, category]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setIsLoading(true);

    try {
      const response = await fetch("/api/kol/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          bio: bio || null,
          categories,
          twitterHandle,
          telegramUsername: telegramUsername || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to update profile");
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
            Profile updated successfully!
          </p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Display Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1"
            required
          />
        </div>

        <div>
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="mt-1"
            rows={4}
            placeholder="Tell us about yourself and your content focus..."
            maxLength={500}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {bio.length}/500 characters
          </p>
        </div>

        <div>
          <Label>Categories (max 10)</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {CATEGORY_OPTIONS.map((category) => (
              <Badge
                key={category}
                variant={categories.includes(category) ? "default" : "outline"}
                className={`cursor-pointer transition-colors ${
                  categories.includes(category)
                    ? "bg-purple-600 hover:bg-purple-700"
                    : "hover:bg-muted"
                }`}
                onClick={() => toggleCategory(category)}
              >
                {category}
                {categories.includes(category) && (
                  <X className="h-3 w-3 ml-1" />
                )}
              </Badge>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="twitterHandle">X (Twitter) Handle</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                @
              </span>
              <Input
                id="twitterHandle"
                value={twitterHandle.replace("@", "")}
                onChange={(e) => setTwitterHandle(e.target.value.replace("@", ""))}
                className="pl-8"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="telegramUsername">Telegram Username</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                @
              </span>
              <Input
                id="telegramUsername"
                value={telegramUsername.replace("@", "")}
                onChange={(e) => setTelegramUsername(e.target.value.replace("@", ""))}
                className="pl-8"
                placeholder="optional"
              />
            </div>
          </div>
        </div>
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
          "Save Profile"
        )}
      </Button>
    </form>
  );
}
