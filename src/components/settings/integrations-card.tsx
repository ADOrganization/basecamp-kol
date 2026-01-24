"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Twitter, MessageSquare, Bell, Loader2, AlertCircle, CheckCircle, Eye, EyeOff } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

interface IntegrationsCardProps {
  variant?: "agency" | "client";
}

export function TwitterIntegrationCard() {
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
    if (!apiKey.trim()) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/organization/twitter", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ twitterApiKey: apiKey }),
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
    if (!confirm("Remove the API key?")) return;

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
        setMessage({ type: "error", text: "Failed to remove" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to remove API key" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Twitter className="h-5 w-5" />
          Twitter / X API
        </CardTitle>
        <CardDescription>
          Configure your RapidAPI key for tweet scraping
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex items-center gap-2">
          {hasExistingKey ? (
            <>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <Badge variant="secondary" className="bg-green-100 text-green-700">Connected</Badge>
              {maskedKey && (
                <span className="text-sm text-muted-foreground font-mono">
                  {maskedKey}
                </span>
              )}
            </>
          ) : (
            <>
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <Badge variant="secondary">Not Configured</Badge>
            </>
          )}
        </div>

        {/* API Key Input */}
        <div className="space-y-2">
          <Label htmlFor="rapidapi-key">
            {hasExistingKey ? "Update RapidAPI Key" : "RapidAPI Key"}
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="rapidapi-key"
                type={showKey ? "text" : "password"}
                placeholder="Enter your RapidAPI key..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="pr-10 font-mono"
                disabled={isLoading}
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
            <Button onClick={handleSave} disabled={isSaving || !apiKey.trim() || isLoading}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Get your API key from{" "}
            <a
              href="https://rapidapi.com/davethebeast/api/twitter154"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              rapidapi.com/twitter154
            </a>
            {" "}(recommended) or similar Twitter API providers.
          </p>
        </div>

        {/* Remove button */}
        {hasExistingKey && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={isSaving}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
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

export function TelegramIntegrationCard() {
  const [isLoading, setIsLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [botToken, setBotToken] = useState("");

  const handleConnect = async () => {
    if (!botToken) {
      setShowInfo(true);
      return;
    }

    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsLoading(false);
    setShowInfo(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Telegram Bot
        </CardTitle>
        <CardDescription>
          Connect a Telegram bot to communicate with KOLs
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {showInfo && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Configuration Required</AlertTitle>
            <AlertDescription>
              Telegram integration requires a bot token from @BotFather on Telegram.
              Create a new bot to get your token.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="telegram-token">Bot Token</Label>
          <Input
            id="telegram-token"
            type="password"
            placeholder="Enter your bot token from @BotFather"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Not Connected</Badge>
            <span className="text-sm text-muted-foreground">
              Create a bot with @BotFather to get your token
            </span>
          </div>
          <Button onClick={handleConnect} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? "Connecting..." : "Save & Connect"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function NotificationsCard({ variant = "agency" }: IntegrationsCardProps) {
  const [showEmailInfo, setShowEmailInfo] = useState(false);
  const [showBrowserInfo, setShowBrowserInfo] = useState(false);

  const handleConfigureEmail = () => {
    setShowEmailInfo(true);
    setTimeout(() => setShowEmailInfo(false), 5000);
  };

  const handleEnableBrowser = async () => {
    // Check if browser supports notifications
    if (!("Notification" in window)) {
      setShowBrowserInfo(true);
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      new Notification("Notifications Enabled", {
        body: "You will now receive browser notifications from Basecamp.",
        icon: "/favicon.ico",
      });
    } else {
      setShowBrowserInfo(true);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notifications
        </CardTitle>
        <CardDescription>
          Configure how you receive notifications
        </CardDescription>
      </CardHeader>
      <CardContent>
        {showEmailInfo && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Email Configuration</AlertTitle>
            <AlertDescription>
              Email notifications will be sent to your registered email address
              when important events occur in your campaigns.
            </AlertDescription>
          </Alert>
        )}

        {showBrowserInfo && (
          <Alert className="mb-4" variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Browser Notifications Blocked</AlertTitle>
            <AlertDescription>
              Please enable notifications in your browser settings to receive alerts.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Email Notifications</p>
              <p className="text-sm text-muted-foreground">Receive updates via email</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleConfigureEmail}>
              Configure
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Browser Notifications</p>
              <p className="text-sm text-muted-foreground">Get notified in your browser</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleEnableBrowser}>
              Enable
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
