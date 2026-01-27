"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Shield, Loader2, KeyRound } from "lucide-react";

export default function Verify2FAPage() {
  const router = useRouter();
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    // Backup codes are now XXXXX-XXXXX format (11 chars) or 10 chars without hyphen
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

      // Redirect to dashboard
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
            {useBackupCode ? (
              <KeyRound className="h-6 w-6 text-primary" />
            ) : (
              <Shield className="h-6 w-6 text-primary" />
            )}
          </div>
          <CardTitle>
            {useBackupCode ? "Enter Backup Code" : "Two-Factor Authentication"}
          </CardTitle>
          <CardDescription>
            {useBackupCode
              ? "Enter one of your backup codes to sign in."
              : "Enter the 6-digit code from your authenticator app."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleVerify} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="code">
                {useBackupCode ? "Backup Code" : "Verification Code"}
              </Label>
              <Input
                id="code"
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
                className="text-center text-2xl tracking-widest font-mono"
                autoComplete="one-time-code"
                autoFocus
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm text-center">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={
                verificationCode.replace(/-/g, "").length < (useBackupCode ? 10 : 6) || isVerifying
              }
            >
              {isVerifying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Verify
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={toggleBackupCode}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {useBackupCode
                  ? "Use authenticator app instead"
                  : "Use a backup code"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
