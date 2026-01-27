"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Loader2, Copy, Check, AlertTriangle, ArrowRight } from "lucide-react";

export default function Setup2FAPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [setupData, setSetupData] = useState<{ secret: string; qrCode: string } | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  useEffect(() => {
    fetchSetupData();
  }, []);

  const fetchSetupData = async () => {
    try {
      const response = await fetch("/api/auth/2fa/setup");
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to load 2FA setup");
      }
      const data = await response.json();
      setSetupData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load 2FA setup");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupData || verificationCode.length !== 6) return;

    setIsVerifying(true);
    setError("");

    try {
      const response = await fetch("/api/auth/2fa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: setupData.secret,
          code: verificationCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Verification failed");
      }

      setBackupCodes(data.backupCodes);
      setShowBackupCodes(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setIsVerifying(false);
    }
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  const handleContinue = () => {
    router.push("/client/dashboard");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-[#14B8A6]" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen px-4 py-8">
      <div className="w-full max-w-md relative">
        <div className="absolute -inset-4 bg-gradient-to-r from-[#14B8A6]/5 to-[#0D9488]/5 rounded-3xl blur-xl"></div>
        <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#14B8A6] to-[#0D9488] mb-6 shadow-xl" style={{ boxShadow: "0 8px 32px rgba(20, 184, 166, 0.3)" }}>
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-extrabold mb-2 text-white">
              {showBackupCodes ? "Save Your Backup Codes" : "Set Up Two-Factor Authentication"}
            </h1>
            <p className="text-[#6B6B80]">
              {showBackupCodes
                ? "Store these codes securely. Each can only be used once."
                : "For your security, enable 2FA before accessing the portal."}
            </p>
          </div>

          {showBackupCodes ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-2 p-4 bg-white/5 border border-white/10 rounded-xl">
                {backupCodes.map((code, i) => (
                  <div key={i} className="p-2 bg-white/5 rounded-lg text-center font-mono text-sm text-white">
                    {code}
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                className="w-full h-12 bg-white/5 border-white/10 text-white hover:bg-white/10 rounded-xl"
                onClick={copyBackupCodes}
              >
                {copiedCodes ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy All Codes
                  </>
                )}
              </Button>

              <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-sm">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>These codes will not be shown again. Make sure to save them before continuing.</p>
              </div>

              <Button
                className="w-full h-12 bg-gradient-to-r from-[#14B8A6] to-[#0D9488] hover:from-[#0D9488] hover:to-[#14B8A6] text-white font-semibold rounded-xl shadow-xl transition-all duration-300"
                                onClick={handleContinue}
              >
                I&apos;ve Saved My Codes - Continue
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          ) : (
            <form onSubmit={handleVerify} className="space-y-5">
              {setupData && (
                <>
                  <div className="flex justify-center">
                    <div className="p-4 bg-white rounded-xl">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={setupData.qrCode}
                        alt="2FA QR Code"
                        className="w-40 h-40"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-[#A0A0B0] font-medium">
                      Scan with your authenticator app, or enter manually:
                    </Label>
                    <code className="block p-3 bg-white/5 border border-white/10 rounded-xl text-center font-mono text-xs text-[#A0A0B0] break-all">
                      {setupData.secret}
                    </code>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-[#A0A0B0] font-medium">Verification Code</Label>
                    <div className="relative">
                      <Shield className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#6B6B80]" />
                      <Input
                        type="text"
                        placeholder="000000"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        maxLength={6}
                        autoComplete="one-time-code"
                        className="h-12 pl-12 bg-white/5 border-white/10 text-white placeholder:text-[#6B6B80] rounded-xl focus:border-[#14B8A6] focus:ring-[#14B8A6]/20 transition-all duration-300 text-center text-2xl tracking-widest font-mono"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={verificationCode.length !== 6 || isVerifying}
                    className="w-full h-12 bg-gradient-to-r from-[#14B8A6] to-[#0D9488] hover:from-[#0D9488] hover:to-[#14B8A6] text-white font-semibold rounded-xl shadow-xl transition-all duration-300"
                                      >
                    {isVerifying ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        Verify & Enable 2FA
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                </>
              )}

              {error && !setupData && (
                <div className="text-center space-y-4">
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => router.push("/login")}
                    className="text-[#A0A0B0] hover:text-white hover:bg-white/5"
                  >
                    Back to Login
                  </Button>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
