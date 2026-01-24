"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Twitter, MessageSquare, Bell, Loader2, AlertCircle } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

interface IntegrationsCardProps {
  variant?: "agency" | "client";
}

export function TwitterIntegrationCard() {
  const [isLoading, setIsLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [formData, setFormData] = useState({
    apiKey: "",
    apiSecret: "",
    bearerToken: "",
  });

  const handleConnect = async () => {
    if (!formData.apiKey || !formData.apiSecret || !formData.bearerToken) {
      setShowInfo(true);
      return;
    }

    setIsLoading(true);
    // Simulate connection attempt
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsLoading(false);
    setShowInfo(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Twitter className="h-5 w-5" />
          Twitter / X API
        </CardTitle>
        <CardDescription>
          Connect to Twitter API for post verification and metrics tracking
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {showInfo && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Configuration Required</AlertTitle>
            <AlertDescription>
              Twitter API integration requires a valid Twitter Developer account and API credentials.
              Visit developer.twitter.com to obtain your credentials.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="twitter-key">API Key</Label>
            <Input
              id="twitter-key"
              type="password"
              placeholder="Enter your API key"
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="twitter-secret">API Secret</Label>
            <Input
              id="twitter-secret"
              type="password"
              placeholder="Enter your API secret"
              value={formData.apiSecret}
              onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="twitter-bearer">Bearer Token</Label>
            <Input
              id="twitter-bearer"
              type="password"
              placeholder="Enter your bearer token"
              value={formData.bearerToken}
              onChange={(e) => setFormData({ ...formData, bearerToken: e.target.value })}
            />
          </div>
        </div>
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Not Connected</Badge>
            <span className="text-sm text-muted-foreground">
              Add your credentials to enable Twitter integration
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
