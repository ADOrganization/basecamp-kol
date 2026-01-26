"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

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
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isExpired, setIsExpired] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/kol/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      // Auto-login after registration
      const result = await signIn("kol-credentials", {
        email: invitation?.email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Registration successful but login failed. Please try logging in.");
        router.push("/kol/login");
      } else {
        router.push("/kol/dashboard");
        router.refresh();
      }
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {error && (
            <div className="rounded-md bg-rose-50 dark:bg-rose-900/20 p-4">
              <p className="text-sm text-rose-700 dark:text-rose-400">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                value={invitation?.email || ""}
                disabled
                className="mt-1 bg-muted"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                This will be your login email
              </p>
            </div>

            <div>
              <Label htmlFor="password">Create Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1"
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1"
                placeholder="Confirm your password"
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              "Complete Registration"
            )}
          </Button>
        </form>
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
