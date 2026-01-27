"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Loader2, KeyRound, ArrowRight } from "lucide-react";

export default function Verify2FAPage() {
  const router = useRouter();
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    const minBackupLength = useBackupCode ? 10 : 6;
    const normalizedCode = verificationCode.replace(/-/g, "");
    if (normalizedCode.length < minBackupLength) return;

    setIsVerifying(true);
    setError("");

    try {
      const response = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: verificationCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Verification failed");
      }

      router.push(data.redirectTo || "/client/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setIsVerifying(false);
    }
  };

  const toggleBackupCode = () => {
    setUseBackupCode(!useBackupCode);
    setVerificationCode("");
    setError("");
  };

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-md relative">
        <div className="absolute -inset-4 bg-gradient-to-r from-[#14B8A6]/15 to-[#0D9488]/10 rounded-3xl blur-2xl"></div>
        <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#14B8A6] to-[#0D9488] mb-6 shadow-xl" style={{ boxShadow: "0 8px 32px rgba(20, 184, 166, 0.3)" }}>
              {useBackupCode ? (
                <KeyRound className="w-8 h-8 text-white" />
              ) : (
                <Shield className="w-8 h-8 text-white" />
              )}
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-extrabold mb-2 text-white">
              {useBackupCode ? "Enter Backup Code" : "Two-Factor Authentication"}
            </h1>
            <p className="text-[#6B6B80]">
              {useBackupCode
                ? "Enter one of your backup codes to sign in"
                : "Enter the 6-digit code from your authenticator app"}
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-5">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm text-[#A0A0B0] font-medium">
                {useBackupCode ? "Backup Code" : "Verification Code"}
              </Label>
              <div className="relative">
                {useBackupCode ? (
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#6B6B80]" />
                ) : (
                  <Shield className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#6B6B80]" />
                )}
                <Input
                  type="text"
                  placeholder={useBackupCode ? "XXXXX-XXXXX" : "000000"}
                  value={verificationCode}
                  onChange={(e) => {
                    const value = useBackupCode
                      ? e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 11)
                      : e.target.value.replace(/\D/g, "").slice(0, 6);
                    setVerificationCode(value);
                  }}
                  maxLength={useBackupCode ? 11 : 6}
                  autoComplete="one-time-code"
                  autoFocus
                  className="h-12 pl-12 bg-white/5 border-white/10 text-white placeholder:text-[#6B6B80] rounded-xl focus:border-[#14B8A6] focus:ring-[#14B8A6]/20 transition-all duration-300 text-center text-2xl tracking-widest font-mono"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={verificationCode.replace(/-/g, "").length < (useBackupCode ? 10 : 6) || isVerifying}
              className="w-full h-12 bg-gradient-to-r from-[#14B8A6] to-[#0D9488] hover:from-[#0D9488] hover:to-[#14B8A6] text-white font-semibold rounded-xl shadow-xl transition-all duration-300"
              style={{ boxShadow: "0 8px 32px rgba(20, 184, 166, 0.3)" }}
            >
              {isVerifying ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  Verify
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={toggleBackupCode}
              className="w-full text-[#A0A0B0] hover:text-white hover:bg-white/5"
            >
              {useBackupCode ? "Use authenticator app instead" : "Use a backup code"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
