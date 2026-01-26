"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail, CheckCircle2, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Check for error in URL
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const errorParam = params.get("error");
      if (errorParam) {
        const timer = setTimeout(() => {
          switch (errorParam) {
            case "RateLimit":
              setError("Too many attempts. Please try again later.");
              break;
            case "InvalidLink":
              setError("Invalid or expired sign-in link. Please request a new one.");
              break;
            case "Expired":
              setError("This sign-in link has expired. Please request a new one.");
              break;
            case "AccountDisabled":
              setError("Your account has been disabled. Contact your administrator.");
              break;
            default:
              setError("An error occurred. Please try again.");
          }
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, userType: "user" }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to send sign-in link");
        return;
      }

      setEmailSent(true);
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <Card className="border-border bg-card/50 backdrop-blur">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-teal-600 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-2xl">Check your email</CardTitle>
          <CardDescription className="text-base">
            We sent a sign-in link to <strong>{email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-teal-500/10 border border-teal-500/20 p-4 text-sm text-teal-700 dark:text-teal-300">
            <p>Click the link in the email to sign in. The link will expire in 15 minutes.</p>
          </div>
          <div className="text-center">
            <Button
              variant="ghost"
              onClick={() => {
                setEmailSent(false);
                setEmail("");
              }}
              className="text-muted-foreground"
            >
              Use a different email
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card/50 backdrop-blur">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-teal-600 flex items-center justify-center">
          <span className="text-2xl font-bold text-white">B</span>
        </div>
        <CardTitle className="text-2xl">Welcome to Basecamp</CardTitle>
        <CardDescription>
          Enter your email to receive a secure sign-in link
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-rose-500/10 border border-rose-500/20 p-3 text-sm text-rose-500 dark:text-rose-400 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="email"
              className="h-11"
            />
          </div>
        </CardContent>
        <div className="px-6 pb-6 flex flex-col space-y-4">
          <Button
            type="submit"
            className="w-full bg-teal-600 hover:bg-teal-700 h-11"
            disabled={isLoading || !email}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending link...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send sign-in link
              </>
            )}
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            Are you a KOL?{" "}
            <Link href="/kol/login" className="text-teal-600 dark:text-teal-400 hover:text-teal-500 dark:hover:text-teal-300">
              KOL Portal login
            </Link>
          </p>
        </div>
      </form>
    </Card>
  );
}
