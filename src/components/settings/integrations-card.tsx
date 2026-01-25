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
  const [apifyKey, setApifyKey] = useState("");
  const [hasApifyKey, setHasApifyKey] = useState(false);
  const [maskedApifyKey, setMaskedApifyKey] = useState<string | null>(null);
  const [showApifyKey, setShowApifyKey] = useState(false);

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
        setHasApifyKey(data.hasApifyKey);
        setMaskedApifyKey(data.maskedApifyKey);
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveApify = async () => {
    if (!apifyKey.trim()) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/organization/twitter", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apifyApiKey: apifyKey }),
      });

      if (response.ok) {
        setMessage({ type: "success", text: "API key saved successfully" });
        setApifyKey("");
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

  const handleClearApify = async () => {
    if (!confirm("Remove the Apify API key?")) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/organization/twitter", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apifyApiKey: "" }),
      });

      if (response.ok) {
        setMessage({ type: "success", text: "API key removed" });
        setHasApifyKey(false);
        setMaskedApifyKey(null);
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
          Twitter / X Scraping
        </CardTitle>
        <CardDescription>
          Configure Apify for tweet scraping
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex items-center gap-2">
          {hasApifyKey ? (
            <>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <Badge variant="secondary" className="bg-green-100 text-green-700">Connected</Badge>
              {maskedApifyKey && (
                <span className="text-sm text-muted-foreground font-mono">
                  {maskedApifyKey}
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

        {/* Apify API Key Input */}
        <div className="space-y-2">
          <Label htmlFor="apify-api-key">
            {hasApifyKey ? "Update API Key" : "Apify API Key"}
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="apify-api-key"
                type={showApifyKey ? "text" : "password"}
                placeholder="Enter your Apify API key..."
                value={apifyKey}
                onChange={(e) => setApifyKey(e.target.value)}
                className="pr-10 font-mono"
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowApifyKey(!showApifyKey)}
              >
                {showApifyKey ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
            <Button onClick={handleSaveApify} disabled={isSaving || !apifyKey.trim() || isLoading}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Get your API key from apify.com/account#/integrations
          </p>
        </div>

        {/* Remove button */}
        {hasApifyKey && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearApify}
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
  const [botToken, setBotToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [botUsername, setBotUsername] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await fetch("/api/organization/telegram");
      if (response.ok) {
        const data = await response.json();
        setIsConnected(data.isConnected);
        setBotUsername(data.botUsername);
      }
    } catch (error) {
      console.error("Failed to fetch Telegram status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!botToken.trim()) {
      setMessage({ type: "error", text: "Please enter a bot token" });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/organization/telegram", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: "success", text: `Connected to @${data.botUsername}` });
        setIsConnected(true);
        setBotUsername(data.botUsername);
        setBotToken("");
      } else {
        setMessage({ type: "error", text: data.error || "Failed to connect" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to connect to Telegram" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect Telegram bot?")) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/organization/telegram", {
        method: "DELETE",
      });

      if (response.ok) {
        setMessage({ type: "success", text: "Telegram bot disconnected" });
        setIsConnected(false);
        setBotUsername(null);
      } else {
        setMessage({ type: "error", text: "Failed to disconnect" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to disconnect" });
    } finally {
      setIsSaving(false);
    }
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
        {/* Status */}
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <Badge variant="secondary" className="bg-green-100 text-green-700">Connected</Badge>
              {botUsername && (
                <span className="text-sm text-muted-foreground">
                  @{botUsername}
                </span>
              )}
            </>
          ) : (
            <>
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <Badge variant="secondary">Not Connected</Badge>
            </>
          )}
        </div>

        {/* Bot Token Input */}
        <div className="space-y-2">
          <Label htmlFor="telegram-token">
            {isConnected ? "Update Bot Token" : "Bot Token"}
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="telegram-token"
                type={showToken ? "text" : "password"}
                placeholder="Enter bot token from @BotFather..."
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                className="pr-10 font-mono"
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
            <Button onClick={handleConnect} disabled={isSaving || !botToken.trim() || isLoading}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Connect"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Get your bot token from @BotFather on Telegram
          </p>
        </div>

        {/* Disconnect button */}
        {isConnected && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDisconnect}
            disabled={isSaving}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            Disconnect Bot
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

export function NotificationsCard({ variant = "agency" }: IntegrationsCardProps) {
  const [showEmailInfo, setShowEmailInfo] = useState(false);
  const [showBrowserInfo, setShowBrowserInfo] = useState(false);

  const handleConfigureEmail = () => {
    setShowEmailInfo(true);
    setTimeout(() => setShowEmailInfo(false), 5000);
  };

  const handleEnableBrowser = async () => {
    // Check if browser supports notifications
    if (typeof window === "undefined" || !("Notification" in window)) {
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
