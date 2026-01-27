"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Shield, Mail, Lock, ArrowRight, KeyRound } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          ...(requires2FA && { twoFactorCode })
        }),
      });

      const data = await response.json();

      if (data.requires2FA) {
        setRequires2FA(true);
        setIsLoading(false);
        return;
      }

      if (data.requires2FASetup) {
        // New admin account - redirect to mandatory 2FA setup
        router.push("/admin/setup-2fa");
        return;
      }

      if (!response.ok) {
        setError(data.error || "Invalid credentials");
        return;
      }

      // Redirect directly to agency dashboard
      router.push("/agency/dashboard");
      router.refresh();
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-[#0A0A0F]">
      <div className="w-full max-w-md px-4" style={{ opacity: 1 }}>
        <div className="absolute -inset-4 bg-gradient-to-r from-[#6366F1]/15 to-[#8B5CF6]/10 rounded-3xl blur-2xl"></div>
        <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#6366F1]/15 to-[#8B5CF6]/15 border border-white/10 mb-6">
              <Shield className="w-4 h-4 text-[#6366F1]" />
              <span className="text-sm text-[#A0A0B0] font-medium">Admin Portal</span>
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-extrabold mb-2 text-white">
              {requires2FA ? "Two-Factor Authentication" : "Admin Sign In"}
            </h1>
            <p className="text-[#6B6B80]">
              {requires2FA
                ? "Enter the code from your authenticator app"
                : "Enter your credentials to access the admin portal"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            {!requires2FA ? (
              <>
                <div className="space-y-2">
                  <Label className="text-sm text-[#A0A0B0] font-medium">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#6B6B80]" />
                    <Input
                      type="email"
                      placeholder="admin@basecampnetwork.xyz"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                      className="h-12 pl-12 bg-white/5 border-white/10 text-white placeholder:text-[#6B6B80] rounded-xl focus:border-[#6366F1] focus:ring-[#6366F1]/20 transition-all duration-300"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-[#A0A0B0] font-medium">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#6B6B80]" />
                    <Input
                      type="password"
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      className="h-12 pl-12 bg-white/5 border-white/10 text-white placeholder:text-[#6B6B80] rounded-xl focus:border-[#6366F1] focus:ring-[#6366F1]/20 transition-all duration-300"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label className="text-sm text-[#A0A0B0] font-medium">Authentication Code</Label>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#6B6B80]" />
                  <Input
                    type="text"
                    placeholder="000000"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    disabled={isLoading}
                    autoFocus
                    maxLength={6}
                    className="h-12 pl-12 bg-white/5 border-white/10 text-white placeholder:text-[#6B6B80] rounded-xl focus:border-[#6366F1] focus:ring-[#6366F1]/20 transition-all duration-300 text-center text-2xl tracking-widest font-mono"
                  />
                </div>
                <p className="text-xs text-[#6B6B80] text-center mt-2">
                  Enter the 6-digit code from your authenticator app or a backup code
                </p>
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading || (!requires2FA && (!email || !password)) || (requires2FA && twoFactorCode.length < 6)}
              className="w-full h-12 bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] hover:from-[#7C3AED] hover:to-[#A78BFA] text-white font-semibold rounded-xl shadow-xl transition-all duration-300"
              style={{ boxShadow: "0 8px 32px rgba(99, 102, 241, 0.3)" }}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  {requires2FA ? "Verify" : "Continue"}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>

            {requires2FA && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setRequires2FA(false);
                  setTwoFactorCode("");
                  setError("");
                }}
                className="w-full text-[#A0A0B0] hover:text-white"
              >
                Back to login
              </Button>
            )}
          </form>

          <div className="mt-8 p-4 bg-[#6366F1]/5 border border-[#6366F1]/20 rounded-xl">
            <p className="text-xs text-[#A0A0B0] text-center">
              {requires2FA
                ? "Lost access to your authenticator? Use a backup code instead."
                : "This portal is for authorized administrators only. All access attempts are logged."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
