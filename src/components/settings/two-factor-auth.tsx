"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  Loader2,
  Copy,
  Check,
  Smartphone,
  Key,
} from "lucide-react";

interface TwoFactorStatus {
  enabled: boolean;
  backupCodesRemaining: number;
}

export function TwoFactorAuth() {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Setup state
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [setupData, setSetupData] = useState<{ secret: string; qrCode: string } | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  // Disable state
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [isDisabling, setIsDisabling] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await fetch("/api/admin/auth/2fa/status");
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (err) {
      console.error("Failed to fetch 2FA status:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const startSetup = async () => {
    setError("");
    setIsSettingUp(true);
    try {
      const response = await fetch("/api/admin/auth/2fa/setup");
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to start 2FA setup");
      }
      const data = await response.json();
      setSetupData(data);
      setShowSetupDialog(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start setup");
    } finally {
      setIsSettingUp(false);
    }
  };

  const completeSetup = async () => {
    if (!setupData || verificationCode.length !== 6) return;

    setError("");
    setIsSettingUp(true);
    try {
      const response = await fetch("/api/admin/auth/2fa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: setupData.secret,
          code: verificationCode,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Invalid verification code");
      }

      const data = await response.json();
      setBackupCodes(data.backupCodes);
      setShowSetupDialog(false);
      setShowBackupCodes(true);
      setStatus({ enabled: true, backupCodesRemaining: 10 });
      setVerificationCode("");
      setSetupData(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to enable 2FA");
    } finally {
      setIsSettingUp(false);
    }
  };

  const disable2FA = async () => {
    if (!disablePassword) return;

    setError("");
    setIsDisabling(true);
    try {
      const response = await fetch("/api/admin/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePassword }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to disable 2FA");
      }

      setStatus({ enabled: false, backupCodesRemaining: 0 });
      setShowDisableDialog(false);
      setDisablePassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disable 2FA");
    } finally {
      setIsDisabling(false);
    }
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
        <div className="flex items-center gap-4">
          <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
            status?.enabled
              ? "bg-emerald-500/10"
              : "bg-amber-500/10"
          }`}>
            {status?.enabled ? (
              <ShieldCheck className="h-6 w-6 text-emerald-500" />
            ) : (
              <Shield className="h-6 w-6 text-amber-500" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Two-Factor Authentication</h3>
              <Badge variant={status?.enabled ? "default" : "secondary"} className={
                status?.enabled
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                  : ""
              }>
                {status?.enabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {status?.enabled
                ? `Protecting your account with authenticator app. ${status.backupCodesRemaining} backup codes remaining.`
                : "Add an extra layer of security to your account using an authenticator app."}
            </p>
          </div>
        </div>
        <div>
          {status?.enabled ? (
            <Button
              variant="outline"
              onClick={() => setShowDisableDialog(true)}
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
            >
              <ShieldOff className="h-4 w-4 mr-2" />
              Disable 2FA
            </Button>
          ) : (
            <Button onClick={startSetup} disabled={isSettingUp}>
              {isSettingUp ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4 mr-2" />
              )}
              Enable 2FA
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm">
          {error}
        </div>
      )}

      {/* How it works */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="p-4 rounded-lg border">
          <div className="h-10 w-10 rounded-lg bg-indigo-500/10 flex items-center justify-center mb-3">
            <Smartphone className="h-5 w-5 text-indigo-500" />
          </div>
          <h4 className="font-medium mb-1">Authenticator App</h4>
          <p className="text-sm text-muted-foreground">
            Use Google Authenticator, Authy, or any TOTP-compatible app.
          </p>
        </div>
        <div className="p-4 rounded-lg border">
          <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center mb-3">
            <Key className="h-5 w-5 text-purple-500" />
          </div>
          <h4 className="font-medium mb-1">Time-Based Codes</h4>
          <p className="text-sm text-muted-foreground">
            Codes refresh every 30 seconds for enhanced security.
          </p>
        </div>
        <div className="p-4 rounded-lg border">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-3">
            <Shield className="h-5 w-5 text-emerald-500" />
          </div>
          <h4 className="font-medium mb-1">Backup Codes</h4>
          <p className="text-sm text-muted-foreground">
            10 one-time backup codes for emergency access.
          </p>
        </div>
      </div>

      {/* Setup Dialog */}
      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set Up Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Scan the QR code with your authenticator app, then enter the verification code.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {setupData && (
              <>
                {/* QR Code */}
                <div className="flex justify-center">
                  <div className="p-4 bg-white rounded-xl">
                    <img
                      src={setupData.qrCode}
                      alt="2FA QR Code"
                      className="w-48 h-48"
                    />
                  </div>
                </div>

                {/* Manual Entry */}
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    Or enter this code manually:
                  </Label>
                  <code className="block p-3 bg-muted rounded-lg text-center font-mono text-sm break-all">
                    {setupData.secret}
                  </code>
                </div>

                {/* Verification Code Input */}
                <div className="space-y-2">
                  <Label>Verification Code</Label>
                  <Input
                    type="text"
                    placeholder="000000"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    className="text-center text-2xl tracking-widest font-mono"
                  />
                </div>

                {error && (
                  <p className="text-sm text-rose-500 text-center">{error}</p>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSetupDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={completeSetup}
              disabled={verificationCode.length !== 6 || isSettingUp}
            >
              {isSettingUp ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Verify & Enable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backup Codes Dialog */}
      <Dialog open={showBackupCodes} onOpenChange={setShowBackupCodes}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
              2FA Enabled Successfully
            </DialogTitle>
            <DialogDescription>
              Save these backup codes in a safe place. Each code can only be used once.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
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

            <p className="text-xs text-muted-foreground text-center">
              These codes will not be shown again. Store them securely.
            </p>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowBackupCodes(false)}>
              I&apos;ve Saved My Codes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable Confirmation Dialog */}
      <AlertDialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Two-Factor Authentication?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the extra security layer from your account. Enter your password to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4">
            <Label>Password</Label>
            <Input
              type="password"
              placeholder="Enter your password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              className="mt-2"
            />
            {error && (
              <p className="text-sm text-rose-500 mt-2">{error}</p>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDisablePassword("");
              setError("");
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={disable2FA}
              disabled={!disablePassword || isDisabling}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {isDisabling ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Disable 2FA
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
