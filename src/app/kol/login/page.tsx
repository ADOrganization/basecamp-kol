"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, CheckCircle2, AlertCircle } from "lucide-react";

export default function KOLLoginPage() {
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
              setError("Your account has been disabled. Contact your agency.");
              break;
            case "UserNotFound":
              setError("No KOL account found with this email.");
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
        body: JSON.stringify({ email, userType: "kol" }),
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-md space-y-8 p-8">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 rounded-xl bg-purple-600 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-white" />
            </div>
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
              Check your email
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a sign-in link to <strong>{email}</strong>
            </p>
          </div>

          <div className="rounded-md bg-purple-500/10 border border-purple-500/20 p-4 text-sm text-purple-700 dark:text-purple-300">
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 p-8">
        {/* Logo */}
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-purple-600 flex items-center justify-center">
            <span className="text-2xl font-bold text-white">B</span>
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
            KOL Portal
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your email to receive a secure sign-in link
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {error && (
            <div className="rounded-md bg-rose-50 dark:bg-rose-900/20 p-4 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 text-rose-700 dark:text-rose-400 shrink-0" />
              <p className="text-sm text-rose-700 dark:text-rose-400">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 h-11"
                placeholder="you@example.com"
                disabled={isLoading}
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700 h-11"
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
        </form>

        {/* Footer links */}
        <div className="text-center text-sm text-muted-foreground">
          <p>
            Not a KOL?{" "}
            <Link href="/login" className="text-purple-600 hover:text-purple-500">
              Agency/Client login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
