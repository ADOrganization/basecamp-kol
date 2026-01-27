"use client";

import { useState, useEffect } from "react";
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
import { Shield, Loader2, Copy, Check, AlertTriangle } from "lucide-react";

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
        // No valid token, redirect to login
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>
            {showBackupCodes ? "Save Your Backup Codes" : "Two-Factor Authentication Required"}
          </CardTitle>
          <CardDescription>
            {showBackupCodes
              ? "Store these codes securely. Each can only be used once."
              : "For your security, all accounts must enable 2FA before accessing the portal."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {showBackupCodes ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg font-mono text-sm">
                {backupCodes.map((code, i) => (
                  <div key={i} className="p-2 bg-background rounded text-center">
                    {code}
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                className="w-full"
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

              <div className="flex items-start gap-2 p-3 bg-amber-500/10 rounded-lg text-amber-600 text-sm">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>These codes will not be shown again. Make sure to save them before continuing.</p>
              </div>

              <Button className="w-full" onClick={handleContinue}>
                I&apos;ve Saved My Codes - Continue
              </Button>
            </div>
          ) : (
            <form onSubmit={handleVerify} className="space-y-6">
              {setupData && (
                <>
                  <div className="flex justify-center">
                    <div className="p-4 bg-white rounded-xl">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={setupData.qrCode}
                        alt="2FA QR Code"
                        className="w-48 h-48"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">
                      Scan with your authenticator app, or enter manually:
                    </Label>
                    <code className="block p-3 bg-muted rounded-lg text-center font-mono text-xs break-all">
                      {setupData.secret}
                    </code>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="code">Verification Code</Label>
                    <Input
                      id="code"
                      type="text"
                      placeholder="000000"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      maxLength={6}
                      className="text-center text-2xl tracking-widest font-mono"
                      autoComplete="one-time-code"
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
                    disabled={verificationCode.length !== 6 || isVerifying}
                  >
                    {isVerifying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Verify & Enable 2FA
                  </Button>
                </>
              )}

              {error && !setupData && (
                <div className="text-center space-y-4">
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm">
                    {error}
                  </div>
                  <Button variant="outline" onClick={() => router.push("/login")}>
                    Back to Login
                  </Button>
                </div>
              )}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
