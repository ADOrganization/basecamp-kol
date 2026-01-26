"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, UserPlus, AlertCircle, CheckCircle2 } from "lucide-react";

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [invitation, setInvitation] = useState<{
    email: string;
    organizationName: string;
    role: string;
    inviterName: string;
  } | null>(null);

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setError("Invalid invitation link");
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/auth/accept-invite?token=${encodeURIComponent(token)}`);
        const data = await response.json();

        if (!response.ok || !data.valid) {
          setError(data.error || "Invalid or expired invitation");
          setIsLoading(false);
          return;
        }

        setInvitation(data.invitation);
      } catch {
        setError("Failed to verify invitation");
      } finally {
        setIsLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to accept invitation");
        return;
      }

      // Redirect to dashboard
      router.push(data.redirectTo);
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-border bg-card/50 backdrop-blur">
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </CardContent>
      </Card>
    );
  }

  if (error && !invitation) {
    return (
      <Card className="border-border bg-card/50 backdrop-blur">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-rose-600 flex items-center justify-center">
            <AlertCircle className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-2xl">Invalid Invitation</CardTitle>
          <CardDescription className="text-base">
            {error}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-muted-foreground">
            Please contact your administrator for a new invitation.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card/50 backdrop-blur">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-teal-600 flex items-center justify-center">
          <UserPlus className="h-6 w-6 text-white" />
        </div>
        <CardTitle className="text-2xl">You&apos;re Invited!</CardTitle>
        <CardDescription className="text-base">
          <strong>{invitation?.inviterName}</strong> has invited you to join{" "}
          <strong>{invitation?.organizationName}</strong> as a{" "}
          <span className="capitalize">{invitation?.role?.toLowerCase()}</span>
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-rose-500/10 border border-rose-500/20 p-3 text-sm text-rose-500 dark:text-rose-400 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="rounded-md bg-muted/50 p-3 text-sm">
            <p className="text-muted-foreground">
              Email: <span className="text-foreground">{invitation?.email}</span>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Your Name (optional)</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              className="h-11"
            />
          </div>
        </CardContent>
        <div className="px-6 pb-6">
          <Button
            type="submit"
            className="w-full bg-teal-600 hover:bg-teal-700 h-11"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Joining...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Accept & Join
              </>
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <Card className="border-border bg-card/50 backdrop-blur">
          <CardContent className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
          </CardContent>
        </Card>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  );
}
