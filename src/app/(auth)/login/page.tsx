"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const errorParam = params.get("error");
      const reasonParam = params.get("reason");

      if (reasonParam === "idle") {
        setError("You were logged out due to inactivity. Please sign in again.");
        return;
      }

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
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="w-full max-w-md relative">
          <div className="absolute -inset-4 bg-gradient-to-r from-[#14B8A6]/5 to-[#0D9488]/5 rounded-3xl blur-xl"></div>
          <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-10">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#14B8A6] to-[#0D9488] mb-6">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
              <h1 className="font-display text-3xl md:text-4xl font-extrabold mb-2 text-white">
                Check your email
              </h1>
              <p className="text-[#6B6B80]">
                We sent a sign-in link to
              </p>
              <p className="text-white font-medium mt-1">{email}</p>
            </div>

            <div className="p-4 bg-[#14B8A6]/10 border border-[#14B8A6]/20 rounded-xl mb-6">
              <p className="text-sm text-[#A0A0B0] text-center">
                Click the link in the email to sign in. The link will expire in 15 minutes.
              </p>
            </div>

            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEmailSent(false);
                setEmail("");
              }}
              className="w-full text-[#A0A0B0] hover:text-white hover:bg-white/5"
            >
              Use a different email
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-md relative">
        <div className="absolute -inset-4 bg-gradient-to-r from-[#14B8A6]/5 to-[#0D9488]/5 rounded-3xl blur-xl"></div>
        <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#14B8A6]/15 to-[#0D9488]/15 border border-white/10 mb-6">
              <Sparkles className="w-4 h-4 text-[#14B8A6]" />
              <span className="text-sm text-[#A0A0B0] font-medium">Client Portal</span>
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-extrabold mb-2 text-white">
              Welcome to Basecamp
            </h1>
            <p className="text-[#6B6B80]">
              Enter your email to receive a secure sign-in link
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm text-[#A0A0B0] font-medium">Email address</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#6B6B80]" />
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="email"
                  className="h-12 pl-12 bg-white/5 border-white/10 text-white placeholder:text-[#6B6B80] rounded-xl focus:border-[#14B8A6] focus:ring-[#14B8A6]/20 transition-all duration-300"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading || !email}
              className="w-full h-12 bg-gradient-to-r from-[#14B8A6] to-[#0D9488] hover:from-[#0D9488] hover:to-[#14B8A6] text-white font-semibold rounded-xl transition-all duration-300"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  Send sign-in link
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-8 p-4 bg-[#14B8A6]/5 border border-[#14B8A6]/20 rounded-xl">
            <p className="text-xs text-[#A0A0B0] text-center">
              We&apos;ll send you a secure link to sign in. No password needed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
