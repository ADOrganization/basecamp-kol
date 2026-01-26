"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, Mail } from "lucide-react";

interface InvitationData {
  kolId: string;
  kolName: string;
  email: string;
  organizationName: string;
}

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isExpired, setIsExpired] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!token) {
      setIsVerifying(false);
      setError("Invalid invitation link");
      return;
    }

    const verifyInvitation = async () => {
      try {
        const response = await fetch(`/api/kol/auth/verify-invite?token=${token}`);
        const data = await response.json();

        if (!response.ok) {
          if (data.error === "Invitation expired") {
            setIsExpired(true);
          } else {
            setError(data.error || "Invalid invitation");
          }
          return;
        }

        setInvitation(data);
      } catch {
        setError("Failed to verify invitation");
      } finally {
        setIsVerifying(false);
      }
    };

    verifyInvitation();
  }, [token]);

  const handleAccept = async () => {
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/kol/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to accept invitation");
        return;
      }

      setIsComplete(true);
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-purple-600" />
          <p className="mt-4 text-muted-foreground">Verifying invitation...</p>
        </div>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-md space-y-8 p-8 text-center">
          <XCircle className="h-16 w-16 mx-auto text-rose-500" />
          <h2 className="text-2xl font-bold text-foreground">Invitation Expired</h2>
          <p className="text-muted-foreground">
            This invitation link has expired. Please contact your agency to request a new invitation.
          </p>
          <Button
            onClick={() => router.push("/kol/login")}
            variant="outline"
          >
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-md space-y-8 p-8 text-center">
          <XCircle className="h-16 w-16 mx-auto text-rose-500" />
          <h2 className="text-2xl font-bold text-foreground">Invalid Invitation</h2>
          <p className="text-muted-foreground">{error}</p>
          <Button
            onClick={() => router.push("/kol/login")}
            variant="outline"
          >
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-md space-y-8 p-8 text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Account Created!</h2>
          <p className="text-muted-foreground">
            Your KOL Portal account has been set up for <strong>{invitation?.email}</strong>
          </p>
          <div className="rounded-md bg-purple-500/10 border border-purple-500/20 p-4 text-sm text-purple-700 dark:text-purple-300">
            <p>Click the button below to sign in. We&apos;ll send a secure sign-in link to your email.</p>
          </div>
          <Button
            onClick={() => router.push("/kol/login")}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            <Mail className="mr-2 h-4 w-4" />
            Continue to Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 p-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-purple-600 flex items-center justify-center">
            <CheckCircle className="h-6 w-6 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
            Welcome, {invitation?.kolName}!
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You&apos;ve been invited to join the KOL Portal by{" "}
            <span className="font-medium text-foreground">{invitation?.organizationName}</span>
          </p>
        </div>

        {/* Info */}
        <div className="space-y-4">
          {error && (
            <div className="rounded-md bg-rose-50 dark:bg-rose-900/20 p-4">
              <p className="text-sm text-rose-700 dark:text-rose-400">{error}</p>
            </div>
          )}

          <div className="rounded-md bg-muted p-4">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Your email:</strong> {invitation?.email}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              You&apos;ll use this email to sign in via a secure magic link.
            </p>
          </div>

          <Button
            onClick={handleAccept}
            className="w-full bg-purple-600 hover:bg-purple-700"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting up account...
              </>
            ) : (
              "Accept Invitation"
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            By accepting, you agree to join the KOL Portal and manage your campaigns with {invitation?.organizationName}.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-purple-600" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <AcceptInviteForm />
    </Suspense>
  );
}
