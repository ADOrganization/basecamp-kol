"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react";

export function TwitterSettings() {
  const [apiKey, setApiKey] = useState("");
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/organization/twitter");
      if (response.ok) {
        const data = await response.json();
        setHasExistingKey(data.hasApiKey);
        setMaskedKey(data.maskedApiKey);
      }
    } catch (error) {
      console.error("Failed to fetch Twitter settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/organization/twitter", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ twitterApiKey: apiKey || undefined }),
      });

      if (response.ok) {
        setMessage({ type: "success", text: "API key saved successfully" });
        setApiKey("");
        fetchSettings();
      } else {
        const data = await response.json();
        setMessage({ type: "error", text: data.error || "Failed to save" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to save API key" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    if (!confirm("Are you sure you want to remove the API key?")) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/organization/twitter", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ twitterApiKey: "" }),
      });

      if (response.ok) {
        setMessage({ type: "success", text: "API key removed" });
        setHasExistingKey(false);
        setMaskedKey(null);
      } else {
        setMessage({ type: "error", text: "Failed to remove API key" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to remove API key" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Twitter/X API</CardTitle>
        <CardDescription>
          Configure your Twitter API key (twexapi.io or other provider) for reliable tweet scraping
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex items-center gap-2">
          {hasExistingKey ? (
            <>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-600">API key configured</span>
              {maskedKey && (
                <span className="text-sm text-muted-foreground font-mono">
                  ({maskedKey})
                </span>
              )}
            </>
          ) : (
            <>
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span className="text-sm text-amber-600">No API key configured</span>
            </>
          )}
        </div>

        {/* Input */}
        <div className="space-y-2">
          <Label htmlFor="apiKey">
            {hasExistingKey ? "Update API Key" : "Twitter API Key"}
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="apiKey"
                type={showKey ? "text" : "password"}
                placeholder="Enter your API key (e.g., twitterx_...)..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="pr-10 font-mono"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
            <Button onClick={handleSave} disabled={isSaving || !apiKey}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Get your API key from{" "}
            <a
              href="https://rapidapi.com/search/twitter"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              rapidapi.com
            </a>
            . Subscribe to a Twitter API endpoint (e.g., twitter154).
          </p>
        </div>

        {/* Clear button */}
        {hasExistingKey && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            disabled={isSaving}
            className="text-destructive hover:text-destructive"
          >
            Remove API Key
          </Button>
        )}

        {/* Message */}
        {message && (
          <div
            className={`flex items-center gap-2 text-sm ${
              message.type === "success" ? "text-green-600" : "text-destructive"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            {message.text}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
